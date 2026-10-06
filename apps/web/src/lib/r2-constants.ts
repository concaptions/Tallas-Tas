/**
 * Client-safe constants shared between `r2-upload.ts` (server-only, pulls in `@tas/db`) and
 * `upload-modal.tsx` (client-only, must not pull in `pg`). Everything here is a pure value or a
 * pure helper — no imports from `@tas/db` or `@tas/env`.
 */

/** The MIME prefixes/types the Asset Library accepts. */
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
