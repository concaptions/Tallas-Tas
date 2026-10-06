// The R2 storage helper now lives in `@tas/db` (`packages/db/src/r2.ts`) so the data scripts there
// can re-host attachments (Sprint 10) and this app shares the exact same SigV4 code — one copy, no
// duplication. This module re-exports it under the names the upload Server Action already imports.
export {
  deleteFromR2,
  isR2Available,
  presignedGetUrl,
  uploadToR2,
  type R2DeleteFailure,
  type R2DeleteOutcome,
  type R2DeleteResult,
  type R2UploadFailure,
  type R2UploadOutcome,
  type R2UploadResult,
} from '@tas/db';

/** The MIME prefixes/types the Asset Library accepts. See the paste rule in TASK commit 3. */
export const ASSET_MIME_ALLOWLIST = ['image/', 'video/', 'application/pdf'] as const;

/** 50 MB — the paste's size cap. Converted to bytes once, imported by the API route and the UI. */
export const ASSET_MAX_BYTES = 50 * 1024 * 1024;

/** True when `contentType` is one of the paste-allowed MIME classes. */
export function isAllowedAssetMime(contentType: string): boolean {
  const t = contentType.toLowerCase();
  return ASSET_MIME_ALLOWLIST.some((prefix) =>
    prefix.endsWith('/') ? t.startsWith(prefix) : t === prefix,
  );
}

/**
 * Strip anything that is not `[A-Za-z0-9._-]` from a filename and cap it at 128 characters, so the
 * R2 object key is predictable and does not need URL-encoding at the storage layer. An empty result
 * falls back to `file` so the key always has a name segment.
 */
export function sanitizeAssetFilename(input: string): string {
  const base = input.split(/[\\/]/u).pop() ?? input;
  const cleaned = base.replace(/[^A-Za-z0-9._-]/gu, '_');
  const capped = cleaned.slice(0, 128);
  return capped === '' ? 'file' : capped;
}

/**
 * Compose the R2 object key the Asset Library writes under. `assets/<brandId>/<uuid>/<filename>`
 * — the UUID segment keeps two uploads with the same name from colliding, and the brand prefix
 * makes a per-brand listing cheap in R2 later. `filename` must already be sanitized.
 */
export function composeAssetKey(brandId: string, uuid: string, filename: string): string {
  return `assets/${brandId}/${uuid}/${filename}`;
}
