// The R2 storage helper now lives in `@tas/db` (`packages/db/src/r2.ts`) so the data scripts there
// can re-host attachments (Sprint 10) and this app shares the exact same SigV4 code — one copy, no
// duplication. This module re-exports it under the names the upload Server Action already imports.
export {
  isR2Available,
  uploadToR2,
  type R2UploadFailure,
  type R2UploadOutcome,
  type R2UploadResult,
} from '@tas/db';
