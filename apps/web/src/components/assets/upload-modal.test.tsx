import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatBytes } from './upload-modal';

/**
 * `apps/web` has no renderer and no testing-library (vitest.config.ts explicitly says so). The
 * modal's React behaviour — open/close, dialog mount, error copy — is covered by the Playwright
 * E2E (`apps/web/e2e/assets-upload.spec.ts`), which actually drives the browser. This file keeps
 * the pure helpers honest: byte formatting at every breakpoint, and the fetch-seam signature a
 * future refactor must not change.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatBytes', () => {
  it('formats bytes to KB and MB with the shipped breakpoints', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 - 1)).toContain('KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5 * 1024 * 1024 + 512 * 1024)).toBe('5.5 MB');
    // At the paste's 50 MB cap, the display should match.
    expect(formatBytes(50 * 1024 * 1024)).toBe('50.0 MB');
  });
});
