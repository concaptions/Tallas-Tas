'use client';

import { FileUploadDropzone } from '@/components/file-upload-dropzone';
import type { UploadResult } from '@/lib/upload';

/**
 * The attachment dropzone (UI governance rule 4). A client story so it can pass a stub upload in place
 * of the real Server Action: every drop resolves to a fake R2 URL, so the drag target, the uploading
 * state, the file chips (filename in `font-mono`) and remove all show without storage configured. The
 * disabled variant is the demo surface every write on a brief wears.
 */
async function stubUpload(
  _previous: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get('file');
  const name = file instanceof File ? file.name : 'attachment';
  return Promise.resolve({
    ok: true,
    url: `https://cdn.example.r2.dev/uploads/demo-${name}`,
    name,
  });
}

export function FileUploadDropzoneStory() {
  return (
    <FileUploadDropzone
      name="demoAttachment"
      label="Design files"
      accept="image/*,.pdf"
      value={[
        'https://cdn.example.r2.dev/uploads/9f8e7d6c-1a2b-4c3d-8e9f-0a1b2c3d4e5f-hero-cut.mp4',
      ]}
      action={stubUpload}
    />
  );
}

export function FileUploadDropzoneDisabledStory() {
  return (
    <FileUploadDropzone
      name="demoAttachmentDisabled"
      label="Design files (demo mode)"
      disabled
      action={stubUpload}
    />
  );
}
