import { describe, expect, it } from 'vitest';

import { attachmentLabel } from './file-upload-dropzone';

describe('attachmentLabel', () => {
  it('reads the filename out of a storage URL, dropping the collision id', () => {
    expect(
      attachmentLabel(
        'https://cdn.example.r2.dev/uploads/9f8e7d6c-1a2b-4c3d-8e9f-0a1b2c3d4e5f-hero-cut.mp4',
      ),
    ).toBe('hero-cut.mp4');
  });

  it('ignores a query string and fragment', () => {
    expect(attachmentLabel('https://r2/uploads/id-file.pdf?token=abc#page=2')).toBe('id-file.pdf');
  });

  it('uses the host when a bare origin has no path', () => {
    expect(attachmentLabel('https://example.com')).toBe('example.com');
  });

  it('falls back to the whole URL when the last segment is empty', () => {
    expect(attachmentLabel('https://r2/uploads/')).toBe('https://r2/uploads/');
  });

  it('leaves a plain filename untouched', () => {
    expect(attachmentLabel('brief.pdf')).toBe('brief.pdf');
  });
});
