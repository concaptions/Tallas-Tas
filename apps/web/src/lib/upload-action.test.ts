import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isDemoMode: vi.fn<() => boolean>(),
  isR2Available: vi.fn<() => boolean>(),
  uploadToR2: vi.fn(),
}));

vi.mock('./demo-mode', () => ({
  isDemoMode: mocks.isDemoMode,
  DEMO_WRITE_REFUSAL: 'Sign in required to save changes.',
}));

vi.mock('./r2-upload', () => ({
  isR2Available: mocks.isR2Available,
  uploadToR2: mocks.uploadToR2,
}));

import { uploadFileAction } from './upload-action';
import { MAX_UPLOAD_BYTES, storageKey } from './upload';

function form(file?: File): FormData {
  const data = new FormData();
  if (file !== undefined) data.set('file', file);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('storageKey', () => {
  it('prefixes the id and reduces the filename to a safe slug', () => {
    expect(storageKey('abc123', 'Hero Cut FINAL.mp4')).toBe('uploads/abc123-hero-cut-final.mp4');
  });

  it('strips any leading path so a crafted name cannot escape the prefix', () => {
    expect(storageKey('id', '../../etc/passwd')).toBe('uploads/id-passwd');
    expect(storageKey('id', 'C:\\Windows\\evil.exe')).toBe('uploads/id-evil.exe');
  });

  it('falls back to "file" when the name reduces to nothing', () => {
    expect(storageKey('id', '@@@')).toBe('uploads/id-file');
  });
});

describe('uploadFileAction', () => {
  it('refuses in demo mode before anything else', async () => {
    mocks.isDemoMode.mockReturnValue(true);

    const result = await uploadFileAction(
      null,
      form(new File(['x'], 'a.png', { type: 'image/png' })),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });

  it('rejects a submission with no file', async () => {
    mocks.isDemoMode.mockReturnValue(false);

    const result = await uploadFileAction(null, form());

    expect(result).toEqual({ ok: false, error: 'Choose a file to upload.' });
  });

  it('rejects a file over the size limit', async () => {
    mocks.isDemoMode.mockReturnValue(false);
    const big = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'big.mov', {
      type: 'video/quicktime',
    });

    const result = await uploadFileAction(null, form(big));

    if (result.ok) throw new Error('an oversize file was accepted');
    expect(result.error).toContain('25 MB');
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });

  it('reports a clear error when R2 is not configured (the scaffold, option b)', async () => {
    mocks.isDemoMode.mockReturnValue(false);
    mocks.isR2Available.mockReturnValue(false);

    const result = await uploadFileAction(
      null,
      form(new File(['x'], 'a.png', { type: 'image/png' })),
    );

    expect(result).toEqual({ ok: false, error: 'File storage is not configured yet.' });
    expect(mocks.uploadToR2).not.toHaveBeenCalled();
  });

  it('uploads to R2 and returns the URL and name on success', async () => {
    mocks.isDemoMode.mockReturnValue(false);
    mocks.isR2Available.mockReturnValue(true);
    mocks.uploadToR2.mockResolvedValue({ ok: true, r2Key: 'uploads/x-a.png', url: 'https://r2/x' });

    const result = await uploadFileAction(
      null,
      form(new File(['x'], 'a.png', { type: 'image/png' })),
    );

    expect(result).toEqual({ ok: true, url: 'https://r2/x', name: 'a.png' });
    expect(mocks.uploadToR2).toHaveBeenCalledOnce();
  });

  it('passes an R2 failure back to the caller', async () => {
    mocks.isDemoMode.mockReturnValue(false);
    mocks.isR2Available.mockReturnValue(true);
    mocks.uploadToR2.mockResolvedValue({ ok: false, error: 'R2 upload failed: 500' });

    const result = await uploadFileAction(
      null,
      form(new File(['x'], 'a.png', { type: 'image/png' })),
    );

    expect(result).toEqual({ ok: false, error: 'R2 upload failed: 500' });
  });
});
