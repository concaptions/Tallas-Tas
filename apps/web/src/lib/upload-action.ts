'use server';

import { randomUUID } from 'node:crypto';

import { isDemoMode, DEMO_WRITE_REFUSAL } from './demo-mode';
import { isR2Available, uploadToR2 } from './r2-upload';
import { MAX_UPLOAD_BYTES, storageKey, type UploadResult } from './upload';

/**
 * The one file-upload Server Action, behind `FileUploadDropzone`. It follows the same shape as every
 * other write in this app (PRD §5.10 attachments): refuse in DEMO MODE before anything else, validate,
 * then go through the storage helper.
 *
 * STORAGE IS CLOUDFLARE R2 (CLAUDE.md tech stack), through the hand-rolled SigV4 uploader in
 * `r2-upload.ts` — option (b) of the scaffold: when no R2 credentials are configured the action
 * returns a clear error rather than writing to a local disk that does not exist on Vercel. No
 * credentials exist on the dev machine, so a real upload is listed under "Pending human verification"
 * in the runbook; the guard, the validation and the key are all testable without them.
 *
 * This file carries `'use server'`, so it may export ONLY this async function — the size limit, the
 * key builder and the result type live in `./upload` and are imported here and by the dropzone.
 */
export async function uploadFileAction(
  _previous: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  if (isDemoMode()) {
    return { ok: false, error: DEMO_WRITE_REFUSAL };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'That file is larger than the 25 MB limit.' };
  }
  if (!isR2Available()) {
    return { ok: false, error: 'File storage is not configured yet.' };
  }

  const key = storageKey(randomUUID(), file.name);
  const outcome = await uploadToR2(
    key,
    await file.arrayBuffer(),
    file.type === '' ? 'application/octet-stream' : file.type,
  );
  if (!outcome.ok) {
    return { ok: false, error: outcome.error };
  }
  return { ok: true, url: outcome.url, name: file.name };
}
