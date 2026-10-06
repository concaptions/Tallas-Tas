import { describe, expect, it, vi } from 'vitest';
import type { AssetListRow } from '@tas/db';

import { handleServe, type ServeHandlerDeps } from './handler';

/**
 * Serve-handler unit tests. The three branches the paste requires:
 *
 *   1. presigned URL available  → 302 to it
 *   2. no signer, public URL    → 302 to the public URL (dep seam, for a future ticket)
 *   3. neither available        → 503 "Storage not configured"
 *
 * Plus auth and access refusals: 401 for a signed-out caller, 403 for a wrong-brand or missing id
 * (the two are indistinguishable to the client, by design).
 */

const EXAMPLE_ASSET: AssetListRow = {
  id: 'asset-1',
  brandId: 'brand-1',
  filename: 'photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024,
  r2Key: 'assets/brand-1/uuid/photo.jpg',
  url: 'https://ignored',
  category: 'reference',
  conceptId: null,
  creatorId: null,
  caption: null,
  legacyAirtableId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
  deletedAt: null,
};

function baseDeps(overrides: Partial<ServeHandlerDeps> = {}): ServeHandlerDeps {
  return {
    authenticated: () => Promise.resolve(true),
    loadAsset: () => Promise.resolve(EXAMPLE_ASSET),
    presignedGetUrl: (key) => `https://signed.test/${key}?sig=abc`,
    ...overrides,
  };
}

describe('handleServe', () => {
  it('401s a signed-out caller before loading the asset', async () => {
    const loadAsset = vi.fn<ServeHandlerDeps['loadAsset']>(() => Promise.resolve(EXAMPLE_ASSET));
    const outcome = await handleServe(
      'asset-1',
      baseDeps({ authenticated: () => Promise.resolve(false), loadAsset }),
    );
    expect(outcome).toEqual({
      kind: 'json',
      status: 401,
      body: { error: 'Sign in required.' },
    });
    expect(loadAsset).not.toHaveBeenCalled();
  });

  it('403s a missing or wrong-brand id (not 404 — probes cannot distinguish)', async () => {
    const outcome = await handleServe(
      'asset-ghost',
      baseDeps({ loadAsset: () => Promise.resolve(null) }),
    );
    expect(outcome).toEqual({
      kind: 'json',
      status: 403,
      body: { error: 'That asset is not available.' },
    });
  });

  it('302s to a presigned URL when R2 is configured', async () => {
    const outcome = await handleServe('asset-1', baseDeps());
    expect(outcome.kind).toBe('redirect');
    if (outcome.kind === 'redirect') {
      expect(outcome.url).toContain('https://signed.test/assets/brand-1/uuid/photo.jpg');
    }
  });

  it('falls back to a public URL when no signer is available', async () => {
    const outcome = await handleServe(
      'asset-1',
      baseDeps({
        presignedGetUrl: () => null,
        publicUrl: (key) => `https://cdn.example/${key}`,
      }),
    );
    expect(outcome).toEqual({
      kind: 'redirect',
      url: 'https://cdn.example/assets/brand-1/uuid/photo.jpg',
    });
  });

  it('503s with the paste copy when storage is not configured and no fallback exists', async () => {
    const outcome = await handleServe('asset-1', baseDeps({ presignedGetUrl: () => null }));
    expect(outcome).toEqual({
      kind: 'json',
      status: 503,
      body: { error: 'Storage not configured — set R2 credentials in the environment.' },
    });
  });

  it('asks the signer for a 1-hour expiry by default', async () => {
    const signer = vi.fn<ServeHandlerDeps['presignedGetUrl']>((key) => `https://signed/${key}`);
    await handleServe('asset-1', baseDeps({ presignedGetUrl: signer }));
    expect(signer).toHaveBeenCalledWith(EXAMPLE_ASSET.r2Key, 3600);
  });
});
