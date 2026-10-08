import { describe, expect, it } from 'vitest';

import {
  MAX_REGISTRY_PIC_BYTES,
  REGISTRY_PIC_PREFIX,
  checkRegistryImage,
  registryPicKey,
} from './registry-media';

describe('checkRegistryImage', () => {
  it('accepts the common image types and strips charset parameters', () => {
    expect(checkRegistryImage('image/jpeg', 10)).toEqual({
      ok: true,
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(checkRegistryImage('IMAGE/PNG; charset=binary', 10)).toMatchObject({
      ok: true,
      extension: 'png',
    });
    expect(checkRegistryImage('image/webp', 10)).toMatchObject({ ok: true, extension: 'webp' });
  });

  it('rejects a non-image, an empty body and anything over 2MB — but takes exactly 2MB', () => {
    const failure = (contentType: string, bytes: number): string => {
      const result = checkRegistryImage(contentType, bytes);
      if (result.ok) throw new Error(`${contentType} at ${String(bytes)} bytes was accepted`);
      return result.error;
    };
    expect(failure('text/html', 10)).toContain('not an image');
    expect(failure('application/octet-stream', 10)).toContain('not an image');
    expect(failure('image/jpeg', 0)).toBe('empty body');
    expect(checkRegistryImage('image/jpeg', MAX_REGISTRY_PIC_BYTES).ok).toBe(true);
    expect(failure('image/jpeg', MAX_REGISTRY_PIC_BYTES + 1)).toContain('too large');
  });
});

describe('registryPicKey', () => {
  it('keeps every registry photo under the creator-registry prefix, by registry id', () => {
    expect(registryPicKey('reg-1', 'jpg', 'file')).toBe(`${REGISTRY_PIC_PREFIX}/reg-1/file.jpg`);
    expect(registryPicKey('reg-1', 'png')).toMatch(
      new RegExp(`^${REGISTRY_PIC_PREFIX}/reg-1/[0-9a-f-]{36}\\.png$`, 'u'),
    );
  });
});
