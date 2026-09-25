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
