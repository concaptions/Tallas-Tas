import { describe, expect, it, vi } from 'vitest';
import type { AssetCategory, AssetInput } from '@tas/db';

import type { R2UploadOutcome } from '@/lib/r2-upload';

import { handleUpload, type UploadHandlerDeps } from './handler';

/**
 * Upload-handler unit tests. The handler is HTTP-free, so every dependency is a plain fake and no
 * network, Clerk SDK, Postgres connection or crypto randomness is touched. The nine cases below
 * cover the paste's acceptance criteria:
 *
 *   1. demo refusal returns 403 before any dep is called
 *   2. missing brandId returns 400
 *   3. unauthenticated → 401 (resolveScope says so)
 *   4. non-entitled brand → 403
 *   5. R2 not configured → 503 with the paste's exact copy
 *   6. missing file → 400
 *   7. oversize → 413
 *   8. disallowed MIME → 415
 *   9. happy path → 200 with the asset row
 *
 * The handler reads `demoMode` through the injected dep, so the real `isDemoMode()` is bypassed.
 */

const FAKE_DB = {} as unknown as Parameters<UploadHandlerDeps['insertAsset']>[0];
const BRAND_ID = '00000000-0000-0000-0000-000000000001';

function okScopeFor(brandId: string, actorId = 'user_123'): UploadHandlerDeps['resolveScope'] {
  return vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      scope: {
        db: FAKE_DB,
        brandId,
        actorId,
        close: () => Promise.resolve(),
      },
    }),
  );
}

function fakeInsert() {
  return vi.fn<UploadHandlerDeps['insertAsset']>((_db, _brandId, values: AssetInput) =>
    Promise.resolve({
      id: 'asset_1',
      filename: values.filename,
      contentType: values.contentType,
      sizeBytes: values.sizeBytes,
      category: values.category,
      createdAt: new Date('2026-10-07T00:00:00Z'),
    }),
  );
}

function baseDeps(overrides: Partial<UploadHandlerDeps> = {}): UploadHandlerDeps {
  return {
    demoMode: () => false,
    resolveScope: okScopeFor(BRAND_ID),
    isR2Available: () => true,
    uploadToR2: (key): Promise<R2UploadOutcome> =>
      Promise.resolve({ ok: true, r2Key: key, url: `https://example.com/${key}` }),
    insertAsset: fakeInsert(),
    randomUUID: () => '11111111-1111-1111-1111-111111111111',
    nodeEnv: 'test',
    ...overrides,
  };
}

function fileWithSize(bytes: number, name = 'photo.jpg', type = 'image/jpeg'): File {
  // A Buffer-backed Blob keeps the Node test environment happy; File is available via undici.
  return new File([new Uint8Array(bytes)], name, { type });
}

function fd(fields: Record<string, string | File>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

describe('handleUpload', () => {
  it('refuses in demo mode before any dep is called', async () => {
    const resolve = okScopeFor(BRAND_ID);
    const upload = vi.fn();
    const insert = fakeInsert();
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        demoMode: () => true,
        resolveScope: resolve,
        uploadToR2: upload as UploadHandlerDeps['uploadToR2'],
        insertAsset: insert,
      }),
    );
    expect(outcome.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('400s when brandId is missing', async () => {
    const outcome = await handleUpload(
      fd({ category: 'reference', file: fileWithSize(16) }),
      baseDeps(),
    );
    expect(outcome.status).toBe(400);
  });

  it('401s when the actor is not signed in', async () => {
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        resolveScope: () =>
          Promise.resolve({ ok: false as const, status: 401 as const, error: 'Sign in required.' }),
      }),
    );
    expect(outcome.status).toBe(401);
  });

  it('403s when the brand is not accessible to the actor', async () => {
    const outcome = await handleUpload(
      fd({ brandId: 'other-brand', category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        resolveScope: () =>
          Promise.resolve({
            ok: false as const,
            status: 403 as const,
            error: 'That brand is not accessible from this workspace.',
          }),
      }),
    );
    expect(outcome.status).toBe(403);
  });

  it('503s with the paste copy when R2 is not configured', async () => {
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({ isR2Available: () => false }),
    );
    expect(outcome.status).toBe(503);
    if (outcome.status === 503) {
      expect(outcome.body.error).toContain('Storage not configured');
    }
  });

  it('400s when the file field is missing', async () => {
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference' }),
      baseDeps(),
    );
    expect(outcome.status).toBe(400);
  });

  it('413s a file over the 50 MB cap', async () => {
    const outcome = await handleUpload(
      fd({
        brandId: BRAND_ID,
        category: 'reference',
        // 50 MB + 1 byte; the File backing array need not be real content.
        file: fileWithSize(50 * 1024 * 1024 + 1),
      }),
      baseDeps(),
    );
    expect(outcome.status).toBe(413);
  });

  it('415s a disallowed MIME type', async () => {
    const outcome = await handleUpload(
      fd({
        brandId: BRAND_ID,
        category: 'reference',
        file: fileWithSize(16, 'notes.txt', 'text/plain'),
      }),
      baseDeps(),
    );
    expect(outcome.status).toBe(415);
  });

  it('400s a category that is not in the shipped enum', async () => {
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'finished_ad', file: fileWithSize(16) }),
      baseDeps(),
    );
    expect(outcome.status).toBe(400);
  });

  it('502s when R2 upload fails, with detail only outside production', async () => {
    const outcomeDev = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        uploadToR2: () =>
          Promise.resolve<R2UploadOutcome>({ ok: false, error: 'R2 upload failed: 500' }),
        nodeEnv: 'development',
      }),
    );
    expect(outcomeDev.status).toBe(502);
    if (outcomeDev.status === 502) expect(outcomeDev.body.detail).toContain('R2 upload failed');

    const outcomeProd = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        uploadToR2: () => Promise.resolve<R2UploadOutcome>({ ok: false, error: 'secret-ish' }),
        nodeEnv: 'production',
      }),
    );
    expect(outcomeProd.status).toBe(502);
    if (outcomeProd.status === 502) expect(outcomeProd.body.detail).toBeUndefined();
  });

  it('happy path: inserts the row and returns 200 with the shipped shape', async () => {
    const insert = fakeInsert();
    const upload = vi.fn<UploadHandlerDeps['uploadToR2']>((key) =>
      Promise.resolve({ ok: true as const, r2Key: key, url: `https://cdn.test/${key}` }),
    );
    const outcome = await handleUpload(
      fd({
        brandId: BRAND_ID,
        category: 'reference',
        caption: '  A caption   ',
        file: fileWithSize(16, 'a photo!.jpg', 'image/jpeg'),
      }),
      baseDeps({ insertAsset: insert, uploadToR2: upload }),
    );
    expect(outcome.status).toBe(200);
    if (outcome.status !== 200) return;
    expect(outcome.body.asset).toMatchObject({
      id: 'asset_1',
      filename: 'a_photo_.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 16,
      category: 'reference' satisfies AssetCategory,
    });
    expect(upload).toHaveBeenCalledWith(
      `assets/${BRAND_ID}/11111111-1111-1111-1111-111111111111/a_photo_.jpg`,
      expect.anything(),
      'image/jpeg',
    );
    expect(insert).toHaveBeenCalledTimes(1);
    const [, , values] = insert.mock.calls[0] ?? [];
    expect(values).toMatchObject({ caption: 'A caption', conceptId: null, creatorId: null });
  });

  it('closes the scope even on failure (R2 upload fail)', async () => {
    const close = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const outcome = await handleUpload(
      fd({ brandId: BRAND_ID, category: 'reference', file: fileWithSize(16) }),
      baseDeps({
        resolveScope: () =>
          Promise.resolve({
            ok: true as const,
            scope: { db: FAKE_DB, brandId: BRAND_ID, actorId: 'user_1', close },
          }),
        uploadToR2: () => Promise.resolve<R2UploadOutcome>({ ok: false, error: 'nope' }),
      }),
    );
    expect(outcome.status).toBe(502);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
