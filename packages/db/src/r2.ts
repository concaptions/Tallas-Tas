import { createHash, createHmac } from 'node:crypto';

import { serverEnv } from '@tas/env';

/**
 * Cloudflare R2 storage (CLAUDE.md tech stack), a hand-rolled SigV4 PUT and a plain GET — no
 * `@aws-sdk/*` dependency. It lives in `@tas/db` so the data scripts here (the Airtable → R2 URL
 * migration) can re-host files, and `apps/web`'s `lib/r2-upload.ts` re-exports it so the upload
 * Server Action shares the exact same code. Server-only (node:crypto + fetch); never client-imported.
 *
 * Every function is env-driven and safe with no credentials: `isR2Available` is false and
 * `uploadToR2` returns a clear failure, so callers degrade rather than throw when R2 is not set up.
 */

export interface R2UploadResult {
  readonly ok: true;
  readonly r2Key: string;
  readonly url: string;
}

export interface R2UploadFailure {
  readonly ok: false;
  readonly error: string;
}

export type R2UploadOutcome = R2UploadResult | R2UploadFailure;

export function isR2Available(): boolean {
  const env = serverEnv();
  return (
    env.R2_ACCOUNT_ID !== undefined &&
    env.R2_ACCESS_KEY_ID !== undefined &&
    env.R2_SECRET_ACCESS_KEY !== undefined &&
    env.R2_BUCKET !== undefined
  );
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export async function uploadToR2(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<R2UploadOutcome> {
  const env = serverEnv();
  if (!isR2Available()) return { ok: false, error: 'R2 credentials are not configured.' };

  const acct = env.R2_ACCOUNT_ID ?? '';
  const akid = env.R2_ACCESS_KEY_ID ?? '';
  const secret = env.R2_SECRET_ACCESS_KEY ?? '';
  const bucket = env.R2_BUCKET ?? '';
  const host = `${acct}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucket}/${key}`;
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amz = `${ds}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const ph = hex(new Uint8Array(body));
  const ch = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${amz}\n`;
  const sh = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const cr = `PUT\n/${bucket}/${key}\n\n${ch}\n${sh}\n${ph}`;
  const scope = `${ds}/auto/s3/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hex(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${secret}`, ds), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', sk).update(sts).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${akid}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      Host: host,
      'x-amz-content-sha256': ph,
      'x-amz-date': amz,
      Authorization: auth,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) return { ok: false, error: `R2 upload failed: ${String(res.status)}` };
  return { ok: true, r2Key: key, url };
}

export interface R2DownloadResult {
  readonly ok: true;
  readonly body: ArrayBuffer;
  readonly contentType: string;
}
export interface R2DownloadFailure {
  readonly ok: false;
  readonly error: string;
}
export type R2DownloadOutcome = R2DownloadResult | R2DownloadFailure;

/** Fetch a URL's bytes — used to pull a file from the Airtable CDN before re-hosting it to R2. */
export async function downloadFromUrl(url: string): Promise<R2DownloadOutcome> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, error: `HTTP ${String(response.status)}` };
    }
    const body = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    return { ok: true, body, contentType };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'download error' };
  }
}

/**
 * Signs a short-lived GET URL for an R2 object key (SigV4 query-param authentication, no
 * dependencies). The URL authenticates against the object and expires after `expiresSeconds`
 * (default 3600 — one hour, which matches the paste's requirement). Callers 302 to it; browsers
 * follow in-stream, so a large video streams from R2 directly without touching the Next.js server.
 *
 * Returns `null` when R2 is not configured, so the serve route can degrade (503) rather than throw.
 */
export function presignedGetUrl(key: string, expiresSeconds = 3600): string | null {
  const env = serverEnv();
  if (!isR2Available()) return null;

  const acct = env.R2_ACCOUNT_ID ?? '';
  const akid = env.R2_ACCESS_KEY_ID ?? '';
  const secret = env.R2_SECRET_ACCESS_KEY ?? '';
  const bucket = env.R2_BUCKET ?? '';
  const host = `${acct}.r2.cloudflarestorage.com`;
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amz = `${ds}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const scope = `${ds}/auto/s3/aws4_request`;
  const sh = 'host';

  // The encoded key is used both inside the canonical URI (what the signer saw) and inside the final
  // URL. Slashes in the object key must stay unescaped (S3 convention), so each segment is encoded
  // separately.
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');

  const params = new URLSearchParams();
  params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  params.set('X-Amz-Credential', `${akid}/${scope}`);
  params.set('X-Amz-Date', amz);
  params.set('X-Amz-Expires', String(expiresSeconds));
  params.set('X-Amz-SignedHeaders', sh);
  // URLSearchParams sorts stably alphabetically on access, but SigV4 wants the canonical query
  // string sorted by key. We sort by name below rather than rely on insertion order.
  const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalQuery = sorted
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  // "UNSIGNED-PAYLOAD" is the SigV4 presign convention for GET: the body hash is not pre-known.
  const cr = `GET\n/${bucket}/${encodedKey}\n${canonicalQuery}\n${canonicalHeaders}\n${sh}\nUNSIGNED-PAYLOAD`;
  const sts = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hex(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${secret}`, ds), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', sk).update(sts).digest('hex');

  return `https://${host}/${bucket}/${encodedKey}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

export interface R2DeleteResult {
  readonly ok: true;
}
export interface R2DeleteFailure {
  readonly ok: false;
  readonly error: string;
  /** HTTP status when R2 returned one; `null` for a network error or missing credentials. */
  readonly status: number | null;
}
export type R2DeleteOutcome = R2DeleteResult | R2DeleteFailure;

/**
 * Deletes one object from R2. SigV4-signed DELETE, no SDK. Returns `ok: true` for 204 and for 404
 * — a missing object is a successful delete (the point was that it is gone), which is what the
 * Server Action depends on to be idempotent.
 */
export async function deleteFromR2(key: string): Promise<R2DeleteOutcome> {
  const env = serverEnv();
  if (!isR2Available()) {
    return { ok: false, error: 'R2 credentials are not configured.', status: null };
  }

  const acct = env.R2_ACCOUNT_ID ?? '';
  const akid = env.R2_ACCESS_KEY_ID ?? '';
  const secret = env.R2_SECRET_ACCESS_KEY ?? '';
  const bucket = env.R2_BUCKET ?? '';
  const host = `${acct}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = `https://${host}/${bucket}/${encodedKey}`;
  const now = new Date();
  const ds = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amz = `${ds}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const ph = hex(''); // empty body
  const ch = `host:${host}\nx-amz-content-sha256:${ph}\nx-amz-date:${amz}\n`;
  const sh = 'host;x-amz-content-sha256;x-amz-date';
  const cr = `DELETE\n/${bucket}/${encodedKey}\n\n${ch}\n${sh}\n${ph}`;
  const scope = `${ds}/auto/s3/aws4_request`;
  const sts = `AWS4-HMAC-SHA256\n${amz}\n${scope}\n${hex(cr)}`;
  const sk = hmac(hmac(hmac(hmac(`AWS4${secret}`, ds), 'auto'), 's3'), 'aws4_request');
  const sig = createHmac('sha256', sk).update(sts).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${akid}/${scope}, SignedHeaders=${sh}, Signature=${sig}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Host: host,
        'x-amz-content-sha256': ph,
        'x-amz-date': amz,
        Authorization: auth,
      },
    });

    // 204 (deleted) and 404 (already gone) are both successful outcomes for a delete.
    if (res.status === 204 || res.status === 404 || res.ok) {
      return { ok: true };
    }
    return { ok: false, error: `R2 delete failed: ${String(res.status)}`, status: res.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'R2 delete error',
      status: null,
    };
  }
}
