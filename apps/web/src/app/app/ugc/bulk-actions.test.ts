import type { Creator, CreatorInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkMoveCreatorsAction, deleteCreatorsAction } from './bulk-actions';

/**
 * The UGC creators grid's two bulk writes (Ticket 8), tested at the same seams as `actions.test.ts`:
 * the Next cache, Clerk, the actor name, the brand scope, and the `@tas/db` writers as recorders.
 * What is pinned: the DEMO refusal comes before any lookup (Clerk is never asked), an expired
 * session writes nothing, Delete hands the zod-checked ids to `softDeleteCreators` and logs exactly
 * the ids the writer marked under the `creator` entity, and a bulk move refuses an unknown track,
 * an out-of-vocabulary key, and a note-required client key (the Oct 6 Talal ruling) before anything
 * is written — then routes each row through its track's own writer.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and clicking the bar. */
  actor: string | null;
  /** How many times Clerk was asked at all — the demo refusal must leave this at zero. */
  authCalls: number;
  /** The ids the fake brand currently owns live; everything else resolves nothing. */
  live: string[];
  /** Every `softDeleteCreators` call's ids, in order. */
  deleted: (readonly string[])[];
  /** Every `updateCreator` call's `{ id, patch }`, in order — the INTERNAL track's writer. */
  patched: { id: string; patch: Partial<CreatorInput> }[];
  /** Every `updateCreatorClientStatus` call's `{ id, status, note }` — the CLIENT track's writer. */
  clientMoved: { id: string; status: string; note: string | null }[];
  /** Every `insertActivity` call's `{ entityType, entityId, field }`. */
  logged: { entityType: string; entityId: string; field: string }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  authCalls: 0,
  live: [],
  deleted: [],
  patched: [],
  clientMoved: [],
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

vi.mock('@/lib/ugc-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ugc-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    softDeleteCreators: (
      _db: Db,
      _brandId: string,
      ids: readonly string[],
    ): Promise<readonly string[]> => {
      seam.deleted.push(ids);
      // Like the real writer: another brand's id or an already-deleted row is simply absent.
      return Promise.resolve(ids.filter((id) => seam.live.includes(id)));
    },
    updateCreator: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<CreatorInput>,
    ): Promise<Creator | null> => {
      seam.patched.push({ id, patch });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Creator) : null);
    },
    updateCreatorClientStatus: (
      _db: Db,
      _brandId: string,
      id: string,
      status: string,
      note: string | null,
    ): Promise<Creator | null> => {
      seam.clientMoved.push({ id, status, note });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Creator) : null);
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

const CREATOR_A = '66666666-6666-4666-8666-000000000001';
const CREATOR_B = '66666666-6666-4666-8666-000000000002';
const FOREIGN = '99999999-9999-4999-8999-000000000001';

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.authCalls = 0;
  seam.live = [];
  seam.deleted.length = 0;
  seam.patched.length = 0;
  seam.clientMoved.length = 0;
  seam.logged.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses the bulk delete before any lookup: Clerk is never even asked', async () => {
    const result = await deleteCreatorsAction([CREATOR_A]);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.deleted).toEqual([]);
    expect(seam.logged).toEqual([]);
  });

  it('refuses the bulk move the same way', async () => {
    const result = await bulkMoveCreatorsAction([CREATOR_A], 'internalCreatorStatus', 'approved');

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.patched).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });
});

describe('with Clerk configured', () => {
  it('refuses an empty selection without touching the database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await deleteCreatorsAction([])).toEqual({
      ok: false,
      error: 'Select at least one creator first.',
    });
    expect(await bulkMoveCreatorsAction([], 'internalCreatorStatus', 'approved')).toEqual({
      ok: false,
      error: 'Select at least one creator first.',
    });
    expect(seam.deleted).toEqual([]);
    expect(seam.patched).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    const expired = { ok: false, error: 'Your session has expired. Sign in again to save.' };
    expect(await deleteCreatorsAction([CREATOR_A])).toEqual(expired);
    expect(await bulkMoveCreatorsAction([CREATOR_A], 'clientStatus', 'approved')).toEqual(expired);
    expect(seam.deleted).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });

  it('hands the ids to softDeleteCreators and reports the honest subset, each logged as a creator', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A, CREATOR_B];

    const result = await deleteCreatorsAction([CREATOR_A, CREATOR_B, FOREIGN]);

    // The writer received the whole zod-checked list; the scope dropped the foreign id.
    expect(seam.deleted).toEqual([[CREATOR_A, CREATOR_B, FOREIGN]]);
    expect(result).toEqual({ ok: true, deleted: [CREATOR_A, CREATOR_B] });
    // One activity row per row actually marked — never one for the id that resolved nothing.
    expect(seam.logged).toEqual([
      { entityType: 'creator', entityId: CREATOR_A, field: 'deletedAt' },
      { entityType: 'creator', entityId: CREATOR_B, field: 'deletedAt' },
    ]);
  });

  it('refuses an unknown track before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A];

    const result = await bulkMoveCreatorsAction([CREATOR_A], 'internalAssetsStatus', 'approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status track.' });
    expect(seam.patched).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });

  it('refuses a client-track key on the internal track: the vocabularies never cross', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A];

    const result = await bulkMoveCreatorsAction(
      [CREATOR_A],
      'internalCreatorStatus',
      'filming_in_progress',
    );

    expect(result).toEqual({ ok: false, error: 'That is not a status on this track.' });
    expect(seam.patched).toEqual([]);
  });

  it('refuses a label where a key belongs: a tampered form writes nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A];

    const result = await bulkMoveCreatorsAction([CREATOR_A], 'clientStatus', 'Approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status on this track.' });
    expect(seam.clientMoved).toEqual([]);
  });

  it('refuses the note-required client keys in bulk — those are set one creator at a time', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A, CREATOR_B];

    for (const key of ['revisions_needed', 'disapproved']) {
      const result = await bulkMoveCreatorsAction([CREATOR_A, CREATOR_B], 'clientStatus', key);
      expect(result).toEqual({
        ok: false,
        error:
          'Revisions Needed and Disapproved need a short reason — set them one creator at a time.',
      });
    }
    expect(seam.clientMoved).toEqual([]);
  });

  it('moves the internal track through updateCreator per row, the gone id reported as refused', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A, CREATOR_B];

    const result = await bulkMoveCreatorsAction(
      [CREATOR_A, FOREIGN, CREATOR_B],
      'internalCreatorStatus',
      'approved',
    );

    expect(seam.patched).toEqual([
      { id: CREATOR_A, patch: { internalCreatorStatus: 'approved' } },
      { id: FOREIGN, patch: { internalCreatorStatus: 'approved' } },
      { id: CREATOR_B, patch: { internalCreatorStatus: 'approved' } },
    ]);
    expect(seam.clientMoved).toEqual([]);
    expect(result).toEqual({
      ok: true,
      moved: [CREATOR_A, CREATOR_B],
      refused: [{ id: FOREIGN, name: FOREIGN, reason: 'That creator is no longer available.' }],
    });
  });

  it('moves the client track through updateCreatorClientStatus per row, with no note to store', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [CREATOR_A];

    const result = await bulkMoveCreatorsAction([CREATOR_A, FOREIGN], 'clientStatus', 'approved');

    expect(seam.clientMoved).toEqual([
      { id: CREATOR_A, status: 'approved', note: null },
      { id: FOREIGN, status: 'approved', note: null },
    ]);
    expect(seam.patched).toEqual([]);
    expect(result).toEqual({
      ok: true,
      moved: [CREATOR_A],
      refused: [{ id: FOREIGN, name: FOREIGN, reason: 'That creator is no longer available.' }],
    });
  });
});
