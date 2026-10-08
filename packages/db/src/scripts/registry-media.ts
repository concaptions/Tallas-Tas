import { randomUUID } from 'node:crypto';

import { downloadFromUrl, uploadToR2 } from '../r2';

/** Registry photos live under one prefix so the bucket stays legible and a lifecycle rule can target them. */
export const REGISTRY_PIC_PREFIX = 'creator-registry';
export const MAX_REGISTRY_PIC_BYTES = 2 * 1024 * 1024;

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type ImageCheck =
  | { readonly ok: true; readonly contentType: string; readonly extension: string }
  | { readonly ok: false; readonly error: string };

/** Accepts only a real image type under the size cap; the content type is normalised (no params). */
export function checkRegistryImage(contentType: string, byteLength: number): ImageCheck {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  const extension = EXTENSION_BY_TYPE[type];
  if (extension === undefined)
    return { ok: false, error: `not an image (${type || 'no content type'})` };
  if (byteLength === 0) return { ok: false, error: 'empty body' };
  if (byteLength > MAX_REGISTRY_PIC_BYTES) {
    return {
      ok: false,
      error: `too large (${String(byteLength)} bytes > ${String(MAX_REGISTRY_PIC_BYTES)})`,
    };
  }
  return { ok: true, contentType: type, extension };
}

export function registryPicKey(
  registryCreatorId: string,
  extension: string,
  id: string = randomUUID(),
): string {
  return `${REGISTRY_PIC_PREFIX}/${registryCreatorId}/${id}.${extension}`;
}

export type StorePicOutcome =
  | { readonly ok: true; readonly url: string; readonly r2Key: string }
  | { readonly ok: false; readonly error: string };

/** Download a source image, validate it, and re-host it under the registry prefix in R2. */
export async function storeRegistryProfilePic(
  registryCreatorId: string,
  sourceUrl: string,
): Promise<StorePicOutcome> {
  const downloaded = await downloadFromUrl(sourceUrl);
  if (!downloaded.ok) return { ok: false, error: `download failed: ${downloaded.error}` };
  const checked = checkRegistryImage(downloaded.contentType, downloaded.body.byteLength);
  if (!checked.ok) return { ok: false, error: checked.error };
  const uploaded = await uploadToR2(
    registryPicKey(registryCreatorId, checked.extension),
    downloaded.body,
    checked.contentType,
  );
  if (!uploaded.ok) return { ok: false, error: uploaded.error };
  return { ok: true, url: uploaded.url, r2Key: uploaded.r2Key };
}
