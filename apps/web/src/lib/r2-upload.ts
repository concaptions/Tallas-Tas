// The R2 storage helper now lives in `@tas/db` (`packages/db/src/r2.ts`) so the data scripts there
// can re-host attachments (Sprint 10) and this app shares the exact same SigV4 code — one copy, no
// duplication. This module re-exports it under the names the upload Server Action already imports.
//
// SERVER-ONLY: the `@tas/db` re-exports pull in `pg` and `pg-connection-string`, which cannot be
// bundled for the browser. The client-safe constants and helpers (ASSET_MAX_BYTES, the MIME check,
// `sanitizeAssetFilename`, `composeAssetKey`) live in `./r2-constants.ts` and are re-exported here
// for the server callers, so a client component that only needs the constants can import directly
// from `./r2-constants.ts` and never touch Postgres.
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

export {
  ASSET_MAX_BYTES,
  ASSET_MIME_ALLOWLIST,
  composeAssetKey,
  isAllowedAssetMime,
  sanitizeAssetFilename,
} from './r2-constants';
