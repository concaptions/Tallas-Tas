import type { Angle, AngleInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkMoveAnglesAction, deleteAnglesAction } from './bulk-actions';

/**
 * The Angles grid's two bulk writes (Ticket 8), tested at the same seams as `actions.test.ts`:
 * the Next cache, Clerk, the actor name, the brand scope, and the `@tas/db` writers as recorders.
 * What is pinned: the DEMO refusal comes before any lookup (Clerk is never asked), an expired
 * session writes nothing, Delete hands the zod-checked ids to `softDeleteAngles` and logs exactly
 * the ids the writer marked under the `angle` entity, and a bulk move refuses an unknown track or
 * an out-of-vocabulary status key before anything is written.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and clicking the bar. */
  actor: string | null;
  /** How many times Clerk was asked at all — the demo refusal must leave this at zero. */
  authCalls: number;
  /** The ids the fake brand currently owns live; everything else resolves nothing. */
  live: string[];
  /** Every `softDeleteAngles` call's ids, in order. */
  deleted: (readonly string[])[];
  /** Every `updateAngle` call's `{ id, patch }`, in order. */
  moved: { id: string; patch: Partial<AngleInput> }[];
  /** Every `insertActivity` call's `{ entityType, entityId, field }`. */
  logged: { entityType: string; entityId: string; field: string }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  authCalls: 0,
  live: [],
  deleted: [],
  moved: [],
  logged: [],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => {
    seam.authCalls += 1;
    return Promise.resolve({ userId: seam.actor });
  },
}));

vi.mock('@/lib/actor', () => ({
  currentActor: () => Promise.resolve({ fullName: 'Test Actor' }),
}));

vi.mock('@/lib/angles-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/angles-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    softDeleteAngles: (
      _db: Db,
      _brandId: string,
      ids: readonly string[],
    ): Promise<readonly string[]> => {
      seam.deleted.push(ids);
      // Like the real writer: another brand's id or an already-deleted row is simply absent.
      return Promise.resolve(ids.filter((id) => seam.live.includes(id)));
    },
    updateAngle: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<AngleInput>,
    ): Promise<Angle | null> => {
      seam.moved.push({ id, patch });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Angle) : null);
    },
    insertActivity: (
      _db: Db,
      _brandId: string,
      entityType: string,
      entityId: string,
      changes: readonly { field: string }[],
    ): Promise<never[]> => {
      for (const change of changes) {
        seam.logged.push({ entityType, entityId, field: change.field });
      }
      return Promise.resolve([]);
    },
  };
});

const ANGLE_A = '55555555-5555-4555-8555-000000000001';
const ANGLE_B = '55555555-5555-4555-8555-000000000002';
const FOREIGN = '99999999-9999-4999-8999-000000000001';

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.authCalls = 0;
  seam.live = [];
  seam.deleted.length = 0;
  seam.moved.length = 0;
  seam.logged.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses the bulk delete before any lookup: Clerk is never even asked', async () => {
    const result = await deleteAnglesAction([ANGLE_A]);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.deleted).toEqual([]);
    expect(seam.logged).toEqual([]);
  });

  it('refuses the bulk move the same way', async () => {
    const result = await bulkMoveAnglesAction([ANGLE_A], 'status', 'approved');

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.moved).toEqual([]);
  });
});

describe('with Clerk configured', () => {
  it('refuses an empty selection without touching the database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await deleteAnglesAction([])).toEqual({
      ok: false,
      error: 'Select at least one angle first.',
    });
    expect(await bulkMoveAnglesAction([], 'status', 'approved')).toEqual({
      ok: false,
      error: 'Select at least one angle first.',
    });
    expect(seam.deleted).toEqual([]);
    expect(seam.moved).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    const expired = { ok: false, error: 'Your session has expired. Sign in again to save.' };
    expect(await deleteAnglesAction([ANGLE_A])).toEqual(expired);
    expect(await bulkMoveAnglesAction([ANGLE_A], 'status', 'approved')).toEqual(expired);
    expect(seam.deleted).toEqual([]);
    expect(seam.moved).toEqual([]);
  });

  it('hands the ids to softDeleteAngles and reports the honest subset, each logged as an angle', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [ANGLE_A, ANGLE_B];

    const result = await deleteAnglesAction([ANGLE_A, ANGLE_B, FOREIGN]);

    // The writer received the whole zod-checked list; the scope dropped the foreign id.
    expect(seam.deleted).toEqual([[ANGLE_A, ANGLE_B, FOREIGN]]);
    expect(result).toEqual({ ok: true, deleted: [ANGLE_A, ANGLE_B] });
    // One activity row per row actually marked — never one for the id that resolved nothing.
    expect(seam.logged).toEqual([
      { entityType: 'angle', entityId: ANGLE_A, field: 'deletedAt' },
      { entityType: 'angle', entityId: ANGLE_B, field: 'deletedAt' },
    ]);
  });

  it('refuses an unknown track before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [ANGLE_A];

    const result = await bulkMoveAnglesAction([ANGLE_A], 'winning', 'approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status track.' });
    expect(seam.moved).toEqual([]);
  });

  it('refuses a status outside the angleStatuses keys before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [ANGLE_A];

    // The LABEL, not the key: a picker that posted its display text would be a tampered form.
    const result = await bulkMoveAnglesAction([ANGLE_A], 'status', 'Approved');

    expect(result).toEqual({ ok: false, error: 'That is not one of the angle statuses.' });
    expect(seam.moved).toEqual([]);
  });

  it('moves each row through updateAngle and reports the id that resolved nothing as refused', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [ANGLE_A, ANGLE_B];

    const result = await bulkMoveAnglesAction([ANGLE_A, FOREIGN, ANGLE_B], 'status', 'approved');

    expect(seam.moved).toEqual([
      { id: ANGLE_A, patch: { status: 'approved' } },
      { id: FOREIGN, patch: { status: 'approved' } },
      { id: ANGLE_B, patch: { status: 'approved' } },
    ]);
    expect(result).toEqual({
      ok: true,
      moved: [ANGLE_A, ANGLE_B],
      refused: [{ id: FOREIGN, name: FOREIGN, reason: 'That angle is no longer available.' }],
    });
  });
});
