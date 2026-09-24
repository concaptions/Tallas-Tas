// A server-only R2 helper (node:crypto + a signed fetch), NOT a Server Action module: it is called by
// the `uploadFileAction` server action, never from a client, and it exports a sync guard and types, so
// it must not carry `'use server'` (which permits only async exports).
import { serverEnv } from '@tas/env';
import { createHmac, createHash } from 'node:crypto';

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
    body: new Uint8Array(body) as unknown as BodyInit,
  });

  if (!res.ok) return { ok: false, error: `R2 upload failed: ${String(res.status)}` };
  return { ok: true, r2Key: key, url };
}
