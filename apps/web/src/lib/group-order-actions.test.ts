import type { Db, GroupOrderEntry } from '@tas/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Server-action layer tests for Phase B5 group ordering. The DAO itself is covered by
 * `packages/db/src/group-orders.test.ts` on PGlite; here we pin the Clerk/brand/role contract and
 * the demo-mode refusal.
 */

interface Seam {
  clerkUserId: string | null;
  role: string | null;
  resolvedUserId: string | null;
  resolvedBrandId: string | null;
  stored: Map<string, GroupOrderEntry[]>;
  saved: { scopeKey: string; order: readonly GroupOrderEntry[] }[];
  cleared: string[];
}

const seam = vi.hoisted<Seam>(() => ({
  clerkUserId: 'user_2ACTOR',
  role: 'admin',
  resolvedUserId: 'uuid_user_admin',
  resolvedBrandId: 'uuid_brand_1',
  stored: new Map<string, GroupOrderEntry[]>(),
  saved: [],
  cleared: [],
}));

function scopeKey(viewId: string | null): string {
  return [
    seam.resolvedUserId ?? 'NO_USER',
    seam.resolvedBrandId ?? 'NO_BRAND',
    viewId ?? 'GLOBAL',
    'briefs',
    'internal_status',
  ].join('|');
}

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.clerkUserId }),
}));
vi.mock('@tas/env', () => ({
  serverEnv: () => ({ DATABASE_URL: 'postgres://test' }),
  clientEnv: () => ({}),
}));
vi.mock('@/lib/request-db', () => ({
  requestConnection: () => ({ db: {} as Db, close: () => Promise.resolve() }),
}));
vi.mock('./data-source', () => ({
  inDemoMode: () => false,
  resolveLiveBrandId: () => Promise.resolve(seam.resolvedBrandId),
  loadViewerRole: () => Promise.resolve(seam.role),
}));
vi.mock('./demo-mode', () => ({
  DEMO_WRITE_REFUSAL: 'Sign in required to save changes.',
}));
vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    resolveUserIdByClerk: () => Promise.resolve(seam.resolvedUserId),
    getGroupOrder: (input: { viewId: string | null }) =>
      Promise.resolve(seam.stored.get(scopeKey(input.viewId)) ?? null),
    saveGroupOrder: (input: { viewId: string | null; order: readonly GroupOrderEntry[] }) => {
      const key = scopeKey(input.viewId);
      seam.saved.push({ scopeKey: key, order: input.order });
      seam.stored.set(key, [...input.order]);
      return Promise.resolve();
    },
    clearGroupOrder: (input: { viewId: string | null }) => {
      const key = scopeKey(input.viewId);
      seam.cleared.push(key);
      seam.stored.delete(key);
      return Promise.resolve();
    },
  };
});

beforeEach(() => {
  seam.clerkUserId = 'user_2ACTOR';
  seam.role = 'admin';
  seam.resolvedUserId = 'uuid_user_admin';
  seam.resolvedBrandId = 'uuid_brand_1';
  seam.stored.clear();
  seam.saved.length = 0;
  seam.cleared.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const SCOPE = {
  tableKey: 'briefs',
  fieldKey: 'internal_status',
  viewId: null as string | null,
};

const ORDER: GroupOrderEntry[] = [
  { value: 'draft', position: 0, pinned: true },
  { value: 'approved', position: 1, pinned: false },
];

const VIEW_ID = '00000000-0000-4000-8000-000000000001';

describe('saveGroupOrderAction', () => {
  it('round-trips save → get through the server-action layer', async () => {
    const { getGroupOrderAction, saveGroupOrderAction } = await import('./group-order-actions');
    const save = await saveGroupOrderAction({ ...SCOPE, order: ORDER });
    expect(save).toEqual({ ok: true });
    const read = await getGroupOrderAction(SCOPE);
    expect(read).toEqual(ORDER);
  });

  it('a client role is refused — only internal queue-steering roles may save', async () => {
    seam.role = 'client';
    const { saveGroupOrderAction } = await import('./group-order-actions');
    const result = await saveGroupOrderAction({ ...SCOPE, order: ORDER });
    expect(result.ok).toBe(false);
    expect(seam.saved).toHaveLength(0);
  });

  it('a video_editor is refused (role not in allowlist)', async () => {
    seam.role = 'video_editor';
    const { saveGroupOrderAction } = await import('./group-order-actions');
    const result = await saveGroupOrderAction({ ...SCOPE, order: ORDER });
    expect(result.ok).toBe(false);
  });

  it('strategist and csm are allowed', async () => {
    const { saveGroupOrderAction } = await import('./group-order-actions');
    for (const role of ['strategist', 'csm', 'media_buyer', 'admin'] as const) {
      seam.role = role;
      seam.saved.length = 0;
      const result = await saveGroupOrderAction({ ...SCOPE, order: ORDER });
      expect(result).toEqual({ ok: true });
      expect(seam.saved).toHaveLength(1);
    }
  });

  it('refuses with no Clerk session', async () => {
    seam.clerkUserId = null;
    const { saveGroupOrderAction } = await import('./group-order-actions');
    const result = await saveGroupOrderAction({ ...SCOPE, order: ORDER });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid order payload (negative position)', async () => {
    const { saveGroupOrderAction } = await import('./group-order-actions');
    const result = await saveGroupOrderAction({
      ...SCOPE,
      order: [{ value: 'draft', position: -1, pinned: false }],
    });
    expect(result.ok).toBe(false);
  });
});

describe('getGroupOrderAction', () => {
  it('view-specific overrides global for the same scope', async () => {
    const { getGroupOrderAction, saveGroupOrderAction } = await import('./group-order-actions');
    await saveGroupOrderAction({ ...SCOPE, viewId: null, order: ORDER });
    const perView: GroupOrderEntry[] = [
      { value: 'approved', position: 0, pinned: false },
      { value: 'draft', position: 1, pinned: false },
    ];
    await saveGroupOrderAction({ ...SCOPE, viewId: VIEW_ID, order: perView });

    expect(await getGroupOrderAction({ ...SCOPE, viewId: VIEW_ID })).toEqual(perView);
    expect(await getGroupOrderAction({ ...SCOPE, viewId: null })).toEqual(ORDER);
  });
});

describe('clearGroupOrderAction', () => {
  it('removes the row; subsequent get returns null', async () => {
    const { clearGroupOrderAction, getGroupOrderAction, saveGroupOrderAction } =
      await import('./group-order-actions');
    await saveGroupOrderAction({ ...SCOPE, order: ORDER });
    const result = await clearGroupOrderAction(SCOPE);
    expect(result).toEqual({ ok: true });
    expect(seam.cleared).toHaveLength(1);
    expect(await getGroupOrderAction(SCOPE)).toBeNull();
  });

  it('is role-gated: a designer cannot clear', async () => {
    seam.role = 'designer';
    const { clearGroupOrderAction } = await import('./group-order-actions');
    const result = await clearGroupOrderAction(SCOPE);
    expect(result.ok).toBe(false);
    expect(seam.cleared).toHaveLength(0);
  });
});
