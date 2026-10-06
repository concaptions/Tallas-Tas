import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The hand-rolled SigV4 client. These tests exercise the three branches `apps/web`'s upload /
 * serve / delete routes depend on — "R2 not configured" (every function degrades), "happy path"
 * (the HTTP shape going out), and "already gone" (delete is idempotent). The signature math itself
 * is pinned by `uploadToR2`'s existing shipped behaviour; this file adds coverage for the two new
 * helpers (`presignedGetUrl`, `deleteFromR2`) so the pipeline fails loudly if anything in the SigV4
 * code drifts.
 *
 * `@tas/env` is mocked rather than `process.env` manipulated — CLAUDE.md: environment access is
 * only through `packages/env`, enforced by the no-restricted-properties lint rule.
 */

const envMocks = vi.hoisted(() => ({
  serverEnv: vi.fn<() => Record<string, string | undefined>>(() => ({})),
}));

vi.mock('@tas/env', () => ({ serverEnv: envMocks.serverEnv }));

const UNSET_ENV = {};
const CONFIGURED_ENV = {
  R2_ACCOUNT_ID: 'test-acct',
  R2_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  R2_SECRET_ACCESS_KEY: 'secretexamplesecretexamplesecret',
  R2_BUCKET: 'tas-test',
};

beforeEach(() => {
  envMocks.serverEnv.mockReturnValue(UNSET_ENV);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Imports go after the mock so the module reads the hoisted stub.
import { deleteFromR2, isR2Available, presignedGetUrl, uploadToR2 } from './r2';

describe('isR2Available', () => {
  it('is false when no R2 variables are set', () => {
    expect(isR2Available()).toBe(false);
  });

  it('is true when all four R2 variables are set', () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    expect(isR2Available()).toBe(true);
  });

  it('is false when only some R2 variables are set', () => {
    envMocks.serverEnv.mockReturnValue({
      R2_ACCOUNT_ID: 'test-acct',
      R2_ACCESS_KEY_ID: 'AKIA',
    });
    expect(isR2Available()).toBe(false);
  });
});

describe('presignedGetUrl', () => {
  it('returns null when R2 is not configured', () => {
    expect(presignedGetUrl('assets/foo/bar.jpg')).toBeNull();
  });

  it('returns a signed https URL under the account hostname with the bucket in the path', () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    const url = presignedGetUrl('assets/foo/bar.jpg');
    expect(url).not.toBeNull();
    expect(url).toContain('https://test-acct.r2.cloudflarestorage.com/tas-test/assets/foo/bar.jpg');
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Expires=3600');
    expect(url).toContain('X-Amz-Signature=');
  });

  it('honours a custom expiry (seconds)', () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    const url = presignedGetUrl('a/b/c.pdf', 60) ?? '';
    expect(url).toContain('X-Amz-Expires=60');
  });

  it('keeps slashes in the key unescaped but encodes other characters', () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    const url = presignedGetUrl('assets/brand-1/uuid/my file.jpg') ?? '';
    expect(url).toContain('/assets/brand-1/uuid/my%20file.jpg');
  });
});

describe('deleteFromR2', () => {
  it('refuses when R2 is not configured, without touching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const outcome = await deleteFromR2('assets/anything/x.jpg');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/not configured/u);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns ok for a 204 response', async () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const outcome = await deleteFromR2('assets/brand/x.jpg');
    expect(outcome.ok).toBe(true);
  });

  it('returns ok for a 404 response (already gone — idempotent delete)', async () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    const outcome = await deleteFromR2('assets/brand/x.jpg');
    expect(outcome.ok).toBe(true);
  });

  it('returns a failure with status for a 500 response', async () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    const outcome = await deleteFromR2('assets/brand/x.jpg');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(500);
      expect(outcome.error).toContain('500');
    }
  });

  it('returns a failure (status null) on a network error', async () => {
    envMocks.serverEnv.mockReturnValue(CONFIGURED_ENV);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ETIMEDOUT'));
    const outcome = await deleteFromR2('assets/brand/x.jpg');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBeNull();
      expect(outcome.error).toContain('ETIMEDOUT');
    }
  });
});

describe('uploadToR2 (degradation only)', () => {
  it('refuses without R2 configured', async () => {
    const outcome = await uploadToR2('x', new ArrayBuffer(1), 'image/png');
    expect(outcome.ok).toBe(false);
  });
});
