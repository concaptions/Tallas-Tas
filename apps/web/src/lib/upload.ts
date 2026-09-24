/**
 * The pure, non-action half of file upload. It lives apart from `upload-action.ts` because that file
 * carries the `'use server'` directive, which may export ONLY async functions — a sync helper, a
 * constant or a type there is a build error. Everything that is not the action itself is here, so both
 * the action and the client dropzone can import it.
 */

/** The ceiling a single attachment may weigh. Mirrors R2's comfortable single-PUT size. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export interface UploadSuccess {
  readonly ok: true;
  /** The public R2 URL the dropzone stores and the form submits. */
  readonly url: string;
  /** The original filename, for the chip label. */
  readonly name: string;
}

export interface UploadFailure {
  readonly ok: false;
  readonly error: string;
}

export type UploadResult = UploadSuccess | UploadFailure;

/**
 * The object key a file is stored under: a collision-proof id, then the filename reduced to a safe
 * slug so the key stays readable without letting a crafted name escape the prefix. Pure and tested;
 * the action supplies the id from `randomUUID`.
 */
export function storageKey(id: string, filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'file';
  return `uploads/${id}-${slug}`;
}
