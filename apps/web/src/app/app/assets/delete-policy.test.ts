import { describe, expect, it, vi } from 'vitest';
import type { AssetListRow } from '@tas/db';

import { DEMO_WRITE_REFUSAL } from '@/lib/demo-mode';

import { runDelete, type DeleteDeps, type DeleteScope } from './delete-policy';

/**
 * Delete-policy unit tests. The paste's acceptance criteria map one-to-one to a case here:
 *
 *   demo refusal | missing id | signed out | wrong role | missing asset | R2 unreachable (continues)
 *   | happy path | scope-close under failure
 */

const ASSET: AssetListRow = {
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

function fd(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}

function baseScope(overrides: Partial<DeleteScope> = {}): DeleteScope {
  return {
    getAsset: () => Promise.resolve(ASSET),
    softDelete: () => Promise.resolve({ ...ASSET, deletedAt: new Date() }),
    close: () => Promise.resolve(),
    ...overrides,
  };
}

function baseDeps(overrides: Partial<DeleteDeps> = {}): DeleteDeps {
  return {
    isDemoMode: () => false,
    auth: () => Promise.resolve('user_1'),
    role: () => Promise.resolve('admin'),
    openScope: () => Promise.resolve(baseScope()),
    isR2Available: () => true,
    deleteFromR2: () => Promise.resolve({ ok: true as const }),
    revalidatePath: () => undefined,
    warn: () => undefined,
    ...overrides,
  };
}

describe('runDelete', () => {
  it('refuses in demo mode without touching any scope', async () => {
    const open = vi.fn<DeleteDeps['openScope']>();
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({ isDemoMode: () => true, openScope: open }),
    );
    expect(outcome).toEqual({ ok: false, error: DEMO_WRITE_REFUSAL });
    expect(open).not.toHaveBeenCalled();
  });

  it('400-shaped refusal when id is missing', async () => {
    const outcome = await runDelete(fd({}), baseDeps());
    expect(outcome).toEqual({ ok: false, error: 'Missing id' });
  });

  it('refuses an unauthenticated caller', async () => {
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({ auth: () => Promise.resolve(null) }),
    );
    expect(outcome).toEqual({ ok: false, error: 'Not authenticated' });
  });

  it('refuses a role other than admin/csm with the role-specific message', async () => {
    for (const role of ['strategist', 'video_editor', 'designer', 'media_buyer', 'client', null]) {
      const outcome = await runDelete(
        fd({ id: 'asset-1' }),
        baseDeps({ role: () => Promise.resolve(role) }),
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.error).toMatch(/Admin or Client Success Manager/u);
    }
  });

  it('allows csm as well as admin', async () => {
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({ role: () => Promise.resolve('csm') }),
    );
    expect(outcome.ok).toBe(true);
  });

  it('returns no-longer-available when the id resolves to no asset for this brand', async () => {
    const outcome = await runDelete(
      fd({ id: 'ghost' }),
      baseDeps({
        openScope: () => Promise.resolve(baseScope({ getAsset: () => Promise.resolve(null) })),
      }),
    );
    expect(outcome).toEqual({ ok: false, error: 'That asset is no longer available.' });
  });

  it('skips R2 when it is unavailable (never calls deleteFromR2)', async () => {
    const r2 = vi.fn<DeleteDeps['deleteFromR2']>(() => Promise.resolve({ ok: true as const }));
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({ isR2Available: () => false, deleteFromR2: r2 }),
    );
    expect(outcome.ok).toBe(true);
    expect(r2).not.toHaveBeenCalled();
  });

  it('warns but still soft-deletes when R2 delete fails non-idempotently', async () => {
    const warn = vi.fn<(message: string) => void>();
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({
        deleteFromR2: () => Promise.resolve({ ok: false as const, error: 'HTTP 500', status: 500 }),
        warn,
      }),
    );
    expect(outcome.ok).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('R2 delete failed'));
  });

  it('happy path: soft-deletes, revalidates, and returns ok with id', async () => {
    const revalidate = vi.fn<() => void>();
    const scope = baseScope();
    const outcome = await runDelete(
      fd({ id: 'asset-1' }),
      baseDeps({ openScope: () => Promise.resolve(scope), revalidatePath: revalidate }),
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.id).toBe('asset-1');
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('closes the scope even if softDelete throws', async () => {
    const close = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const throwingScope = baseScope({
      softDelete: () => Promise.reject(new Error('db down')),
      close,
    });
    await expect(
      runDelete(
        fd({ id: 'asset-1' }),
        baseDeps({
          openScope: () => Promise.resolve(throwingScope),
        }),
      ),
    ).rejects.toThrow('db down');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
