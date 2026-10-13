import type { Copy, CopyInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkMoveCopyAction, deleteCopyAction } from './bulk-actions';

/**
 * The Copywriting grid's two bulk writes (Ticket 8), tested at the same seams as `actions.test.ts`:
 * the Next cache, Clerk, the actor name, the brand scope, and the `@tas/db` writers as recorders.
 * What is pinned: the DEMO refusal comes before any lookup (Clerk is never asked), an expired
 * session writes nothing, Delete hands the zod-checked ids to `softDeleteCopy` and logs exactly the
 * ids the writer marked under the `copywriting` entity (a pending row's provisional id simply
 * resolves nothing), and a bulk move refuses an unknown track, an out-of-vocabulary key, and a
 * note-required `status` key (the Oct 6 Talal ruling) before anything is written — then routes each
 * row through its track's own writer: `updateCopyStatus` for the copy status, the normalised
 * `updateCopy` trio for the client approval.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the page and clicking the bar. */
  actor: string | null;
  /** How many times Clerk was asked at all — the demo refusal must leave this at zero. */
  authCalls: number;
  /** The ids the fake brand currently owns live; everything else resolves nothing. */
  live: string[];
  /** Every `softDeleteCopy` call's ids, in order. */
  deleted: (readonly string[])[];
  /** Every `updateCopyStatus` call's `{ id, status, note }` — the STATUS track's writer. */
  statusMoved: { id: string; status: string; note: string | null }[];
  /** Every `updateCopy` call's `{ id, patch }` — the CLIENT APPROVAL track's writer. */
  patched: { id: string; patch: Partial<CopyInput> }[];
  /** Every `insertActivity` call's `{ entityType, entityId, field }`. */
  logged: { entityType: string; entityId: string; field: string }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  authCalls: 0,
  live: [],
  deleted: [],
  statusMoved: [],
  patched: [],
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

vi.mock('@/lib/copy-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/copy-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    softDeleteCopy: (
      _db: Db,
      _brandId: string,
      ids: readonly string[],
    ): Promise<readonly string[]> => {
      seam.deleted.push(ids);
      // Like the real writer: another brand's id or an already-deleted row is simply absent.
      return Promise.resolve(ids.filter((id) => seam.live.includes(id)));
    },
    updateCopyStatus: (
      _db: Db,
      _brandId: string,
      id: string,
      status: string,
      note: string | null,
    ): Promise<Copy | null> => {
      seam.statusMoved.push({ id, status, note });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Copy) : null);
    },
    updateCopy: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<CopyInput>,
    ): Promise<Copy | null> => {
      seam.patched.push({ id, patch });
      return Promise.resolve(seam.live.includes(id) ? ({ id } as Copy) : null);
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

const COPY_A = '88888888-8888-4888-8888-000000000001';
const COPY_B = '88888888-8888-4888-8888-000000000002';
const FOREIGN = '99999999-9999-4999-8999-000000000001';
/** The "New copy" row's provisional id — on screen until the refresh, never in the database. */
const PENDING = 'pending:5';

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.authCalls = 0;
  seam.live = [];
  seam.deleted.length = 0;
  seam.statusMoved.length = 0;
  seam.patched.length = 0;
  seam.logged.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses the bulk delete before any lookup: Clerk is never even asked', async () => {
    const result = await deleteCopyAction([COPY_A]);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.deleted).toEqual([]);
    expect(seam.logged).toEqual([]);
  });

  it('refuses the bulk move the same way', async () => {
    const result = await bulkMoveCopyAction([COPY_A], 'status', 'approved');

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.statusMoved).toEqual([]);
    expect(seam.patched).toEqual([]);
  });
});

describe('with Clerk configured', () => {
  it('refuses an empty selection without touching the database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await deleteCopyAction([])).toEqual({
      ok: false,
      error: 'Select at least one copy first.',
    });
    expect(await bulkMoveCopyAction([], 'status', 'approved')).toEqual({
      ok: false,
      error: 'Select at least one copy first.',
    });
    expect(seam.deleted).toEqual([]);
    expect(seam.statusMoved).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    const expired = { ok: false, error: 'Your session has expired. Sign in again to save.' };
    expect(await deleteCopyAction([COPY_A])).toEqual(expired);
    expect(await bulkMoveCopyAction([COPY_A], 'clientApprovalStatus', 'approved')).toEqual(expired);
    expect(seam.deleted).toEqual([]);
    expect(seam.patched).toEqual([]);
  });

  it('hands the ids to softDeleteCopy and reports the honest subset, each logged as copywriting', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A, COPY_B];

    const result = await deleteCopyAction([COPY_A, PENDING, COPY_B, FOREIGN]);

    // The writer received the whole zod-checked list; the scope dropped the foreign id and the
    // pending row's provisional id alike — neither names a live row of the brand.
    expect(seam.deleted).toEqual([[COPY_A, PENDING, COPY_B, FOREIGN]]);
    expect(result).toEqual({ ok: true, deleted: [COPY_A, COPY_B] });
    // One activity row per row actually marked — never one for an id that resolved nothing.
    expect(seam.logged).toEqual([
      { entityType: 'copywriting', entityId: COPY_A, field: 'deletedAt' },
      { entityType: 'copywriting', entityId: COPY_B, field: 'deletedAt' },
    ]);
  });

  it('refuses an unknown track before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A];

    const result = await bulkMoveCopyAction([COPY_A], 'internalStatus', 'approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status track.' });
    expect(seam.statusMoved).toEqual([]);
    expect(seam.patched).toEqual([]);
  });

  it('refuses a client-approval key on the status track: the vocabularies never cross', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A];

    const result = await bulkMoveCopyAction([COPY_A], 'status', 'pending_for_approval');

    expect(result).toEqual({ ok: false, error: 'That is not a status on this track.' });
    expect(seam.statusMoved).toEqual([]);
  });

  it('refuses a label where a key belongs: a tampered form writes nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A];

    const result = await bulkMoveCopyAction([COPY_A], 'clientApprovalStatus', 'Approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status on this track.' });
    expect(seam.patched).toEqual([]);
  });

  it('refuses the note-required status keys in bulk — those are set one copy at a time', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A, COPY_B];

    for (const key of ['revisions_needed', 'disapproved']) {
      const result = await bulkMoveCopyAction([COPY_A, COPY_B], 'status', key);
      expect(result).toEqual({
        ok: false,
        error:
          'Revisions Needed and Disapproved need a short reason — set them one copy at a time.',
      });
    }
    expect(seam.statusMoved).toEqual([]);
  });

  it('moves the status track through updateCopyStatus per row, the gone id reported as refused', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A, COPY_B];

    const result = await bulkMoveCopyAction([COPY_A, FOREIGN, COPY_B], 'status', 'approved');

    expect(seam.statusMoved).toEqual([
      { id: COPY_A, status: 'approved', note: null },
      { id: FOREIGN, status: 'approved', note: null },
      { id: COPY_B, status: 'approved', note: null },
    ]);
    expect(seam.patched).toEqual([]);
    expect(result).toEqual({
      ok: true,
      moved: [COPY_A, COPY_B],
      refused: [{ id: FOREIGN, name: FOREIGN, reason: 'That copy is no longer available.' }],
    });
  });

  it('moves the client approval through the updateCopy trio, legacy spellings normalised first', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.live = [COPY_A];

    // The retired four-value spelling is read and STORED AS its mapped key (2026-10-10 vocabulary).
    const result = await bulkMoveCopyAction(
      [COPY_A, FOREIGN],
      'clientApprovalStatus',
      'pending_client_approval',
    );

    expect(seam.patched).toHaveLength(2);
    for (const [index, id] of [COPY_A, FOREIGN].entries()) {
      const call = seam.patched[index];
      expect(call?.id).toBe(id);
      expect(call?.patch.clientApprovalStatus).toBe('pending_for_approval');
      expect(call?.patch.clientApprovalNote).toBeNull();
      expect(call?.patch.clientApprovalStatusUpdatedAt).toBeInstanceOf(Date);
    }
    expect(seam.statusMoved).toEqual([]);
    expect(result).toEqual({
      ok: true,
      moved: [COPY_A],
      refused: [{ id: FOREIGN, name: FOREIGN, reason: 'That copy is no longer available.' }],
    });
  });
});
