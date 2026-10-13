import type { Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteProductsAction } from './bulk-actions';

/**
 * The Products bulk delete past validation, with the page's usual seams mocked (Next cache, Clerk,
 * the actor name, the brand scope, the `@tas/db` writer as a recorder) — the same harness as the
 * sheet's `review-actions.test.ts`. What is pinned: the DEMO refusal comes before any lookup, an
 * expired session writes nothing, the writer gets the validated ids and its answer is the honest
 * `deleted` count, and every marked row is logged under the `product` entity.
 */
interface Seam {
  actor: string | null;
  /** The ids the brand owns; the writer mock marks only these, like the scoped delete does. */
  live: string[];
  deleted: string[][];
  activity: { entity: string; id: string; field: string }[];
  scopeCalls: number;
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  live: [],
  deleted: [],
  activity: [],
  scopeCalls: 0,
}));

const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));
vi.mock('@/lib/actor', () => ({
  currentActor: () => Promise.resolve({ fullName: 'Test Actor' }),
}));
vi.mock('@/lib/products-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/products-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> => {
    seam.scopeCalls += 1;
    return run({} as Db, 'brand-under-test');
  },
}));
vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    softDeleteProducts: (_db: Db, _brandId: string, ids: readonly string[]) => {
      seam.deleted.push([...ids]);
      return Promise.resolve(ids.filter((id) => seam.live.includes(id)));
    },
    insertActivity: (
      _db: Db,
      _brandId: string,
      entityType: string,
      entityId: string,
      changes: readonly { field: string; oldValue: string | null; newValue: string | null }[],
    ) => {
      for (const change of changes) {
        seam.activity.push({ entity: entityType, id: entityId, field: change.field });
      }
      return Promise.resolve([]);
    },
  };
});

const PRODUCT_A = '22222222-2222-4222-8222-000000000001';
const PRODUCT_B = '22222222-2222-4222-8222-000000000002';

function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.live = [];
  seam.deleted.length = 0;
  seam.activity.length = 0;
  seam.scopeCalls = 0;
  revalidatePath.mockClear();
});

describe('in demo mode', () => {
  it('refuses before any lookup: no scope is opened, nothing is written', async () => {
    const result = await deleteProductsAction([PRODUCT_A]);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.scopeCalls).toBe(0);
    expect(seam.deleted).toEqual([]);
  });
});

describe('deleteProductsAction', () => {
  it('refuses an expired session and writes nothing', async () => {
    live();
    seam.actor = null;

    const result = await deleteProductsAction([PRODUCT_A]);

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.deleted).toEqual([]);
  });

  it('refuses an empty selection', async () => {
    live();
    expect(await deleteProductsAction([])).toEqual({
      ok: false,
      error: 'Select at least one product first.',
    });
    expect(seam.scopeCalls).toBe(0);
  });

  it('hands the writer the validated ids and reports the honestly deleted ones', async () => {
    live();
    seam.live = [PRODUCT_A, PRODUCT_B];

    const result = await deleteProductsAction([PRODUCT_A, PRODUCT_B, 'gone']);

    // The writer saw the whole list; its answer — the brand's live rows alone — is the result.
    expect(seam.deleted).toEqual([[PRODUCT_A, PRODUCT_B, 'gone']]);
    expect(result).toEqual({ ok: true, deleted: [PRODUCT_A, PRODUCT_B] });
    expect(revalidatePath).toHaveBeenCalledWith('/app/products');
  });

  it('logs each marked row under the product entity, deletedAt only', async () => {
    live();
    seam.live = [PRODUCT_A];

    await deleteProductsAction([PRODUCT_A, PRODUCT_B]);

    expect(seam.activity).toEqual([{ entity: 'product', id: PRODUCT_A, field: 'deletedAt' }]);
  });
});
