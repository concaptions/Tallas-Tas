import type { Concept, ConceptInput, ConceptListRow, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkMoveConceptsAction, deleteConceptsAction } from './bulk-actions';

/**
 * The Concepts grid's two bulk writes (Ticket 8), tested at the same seams as `actions.test.ts`:
 * the Next cache, Clerk, the actor name, the brand scope, and the `@tas/db` writers as recorders.
 * What is pinned: the DEMO refusal comes before any lookup (Clerk is never asked), an expired
 * session writes nothing, Delete hands the zod-checked ids to `softDeleteConcepts` and logs exactly
 * the ids the writer marked under the `concept` entity, a bulk move refuses an unknown track or an
 * out-of-vocabulary key before anything is written, and — non-negotiable 4 — a CLIENT move re-runs
 * the gate per row on the server: a row whose internal status is not Approved is refused with the
 * gate's own reason and `updateConceptClientStatus` is never reached for it.
 */

/** One stored row the fake brand owns live, as the per-row gate reads it. */
interface SeamRow {
  readonly id: string;
  readonly name: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
}

interface Seam {
  /** Null stands for a session that expired between rendering the page and clicking the bar. */
  actor: string | null;
  /** How many times Clerk was asked at all — the demo refusal must leave this at zero. */
  authCalls: number;
  /** The rows the fake brand currently owns live; any other id resolves nothing. */
  rows: SeamRow[];
  /** Every `softDeleteConcepts` call's ids, in order. */
  deleted: (readonly string[])[];
  /** Every `updateConcept` call's `{ id, patch }`, in order. */
  moved: { id: string; patch: Partial<ConceptInput> }[];
  /** Every `updateConceptClientStatus` call's `{ id, status, note }`, in order. */
  clientMoved: { id: string; status: string; note: string | null }[];
  /** Every `insertActivity` call's `{ entityType, entityId, field }`. */
  logged: { entityType: string; entityId: string; field: string }[];
}

const seam = vi.hoisted<Seam>(() => ({
  actor: 'user_2TESTACTOR',
  authCalls: 0,
  rows: [],
  deleted: [],
  moved: [],
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

vi.mock('@/lib/concepts-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/concepts-source')>()),
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    getConceptById: (_db: Db, _brandId: string, id: string): Promise<ConceptListRow | null> => {
      const row = seam.rows.find((candidate) => candidate.id === id);
      return Promise.resolve(row === undefined ? null : (row as unknown as ConceptListRow));
    },
    softDeleteConcepts: (
      _db: Db,
      _brandId: string,
      ids: readonly string[],
    ): Promise<readonly string[]> => {
      seam.deleted.push(ids);
      // Like the real writer: another brand's id or an already-deleted row is simply absent.
      return Promise.resolve(ids.filter((id) => seam.rows.some((row) => row.id === id)));
    },
    updateConcept: (
      _db: Db,
      _brandId: string,
      id: string,
      patch: Partial<ConceptInput>,
    ): Promise<Concept | null> => {
      seam.moved.push({ id, patch });
      return Promise.resolve(seam.rows.some((row) => row.id === id) ? ({ id } as Concept) : null);
    },
    updateConceptClientStatus: (
      _db: Db,
      _brandId: string,
      id: string,
      status: string,
      note: string | null,
    ): Promise<Concept | null> => {
      seam.clientMoved.push({ id, status, note });
      return Promise.resolve(seam.rows.some((row) => row.id === id) ? ({ id } as Concept) : null);
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

const CONCEPT_A = '66666666-6666-4666-8666-000000000001';
const CONCEPT_B = '66666666-6666-4666-8666-000000000002';
const FOREIGN = '99999999-9999-4999-8999-000000000001';

function row(id: string, name: string, internalStatus: string, clientStatus: string): SeamRow {
  return { id, name, internalStatus, clientStatus };
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.authCalls = 0;
  seam.rows = [];
  seam.deleted.length = 0;
  seam.moved.length = 0;
  seam.clientMoved.length = 0;
  seam.logged.length = 0;
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses the bulk delete before any lookup: Clerk is never even asked', async () => {
    const result = await deleteConceptsAction([CONCEPT_A]);

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.deleted).toEqual([]);
    expect(seam.logged).toEqual([]);
  });

  it('refuses the bulk move the same way', async () => {
    const result = await bulkMoveConceptsAction([CONCEPT_A], 'internalStatus', 'approved');

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.authCalls).toBe(0);
    expect(seam.moved).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });
});

describe('with Clerk configured', () => {
  it('refuses an empty selection without touching the database', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    expect(await deleteConceptsAction([])).toEqual({
      ok: false,
      error: 'Select at least one concept first.',
    });
    expect(await bulkMoveConceptsAction([], 'internalStatus', 'approved')).toEqual({
      ok: false,
      error: 'Select at least one concept first.',
    });
    expect(seam.deleted).toEqual([]);
    expect(seam.moved).toEqual([]);
  });

  it('refuses to write for an expired session', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.actor = null;

    const expired = { ok: false, error: 'Your session has expired. Sign in again to save.' };
    expect(await deleteConceptsAction([CONCEPT_A])).toEqual(expired);
    expect(await bulkMoveConceptsAction([CONCEPT_A], 'internalStatus', 'approved')).toEqual(
      expired,
    );
    expect(seam.deleted).toEqual([]);
    expect(seam.moved).toEqual([]);
  });

  it('hands the ids to softDeleteConcepts and reports the honest subset, each logged as a concept', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [
      row(CONCEPT_A, 'B1-A-Theme', 'draft', 'pending_for_approval'),
      row(CONCEPT_B, 'B2-B-Theme', 'approved', 'pending_for_approval'),
    ];

    const result = await deleteConceptsAction([CONCEPT_A, CONCEPT_B, FOREIGN]);

    // The writer received the whole zod-checked list; the scope dropped the foreign id.
    expect(seam.deleted).toEqual([[CONCEPT_A, CONCEPT_B, FOREIGN]]);
    expect(result).toEqual({ ok: true, deleted: [CONCEPT_A, CONCEPT_B] });
    // One activity row per row actually marked — never one for the id that resolved nothing.
    expect(seam.logged).toEqual([
      { entityType: 'concept', entityId: CONCEPT_A, field: 'deletedAt' },
      { entityType: 'concept', entityId: CONCEPT_B, field: 'deletedAt' },
    ]);
  });

  it('refuses an unknown track before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [row(CONCEPT_A, 'B1-A-Theme', 'draft', 'pending_for_approval')];

    const result = await bulkMoveConceptsAction([CONCEPT_A], 'status', 'approved');

    expect(result).toEqual({ ok: false, error: 'That is not a status track.' });
    expect(seam.moved).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });

  it('refuses a key outside each track’s vocabulary before anything is written', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [row(CONCEPT_A, 'B1-A-Theme', 'draft', 'pending_for_approval')];

    // `on_hold` left the internal list on 2026-10-12; the LABEL is not a client key either.
    expect(await bulkMoveConceptsAction([CONCEPT_A], 'internalStatus', 'on_hold')).toEqual({
      ok: false,
      error: 'That is not a status on the internal track.',
    });
    expect(
      await bulkMoveConceptsAction([CONCEPT_A], 'clientStatus', 'Pending for Approval'),
    ).toEqual({ ok: false, error: 'That is not a status on the client track.' });
    expect(seam.moved).toEqual([]);
    expect(seam.clientMoved).toEqual([]);
  });

  it('moves the internal track per row through updateConcept, refusing a move the machine does not allow', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [
      row(CONCEPT_A, 'B1-A-Theme', 'draft', 'pending_for_approval'),
      row(CONCEPT_B, 'B2-B-Theme', 'approved', 'pending_for_approval'),
    ];

    const result = await bulkMoveConceptsAction(
      [CONCEPT_A, CONCEPT_B, FOREIGN],
      'internalStatus',
      'sent_to_editor_or_designer',
    );

    // Only the legal move reached the writer: `approved` is terminal, the foreign id resolved nothing.
    expect(seam.moved).toEqual([
      { id: CONCEPT_A, patch: { internalStatus: 'sent_to_editor_or_designer' } },
    ]);
    expect(result).toEqual({
      ok: true,
      moved: [CONCEPT_A],
      refused: [
        {
          id: CONCEPT_B,
          name: 'B2-B-Theme',
          reason: 'That is not the next step on the internal track.',
        },
        { id: FOREIGN, name: FOREIGN, reason: 'That concept is no longer available.' },
      ],
    });
  });

  it('refuses a client move behind the closed gate per row, and writes nothing for it', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [row(CONCEPT_A, 'B1-A-Theme', 'draft', 'pending_for_approval')];

    const result = await bulkMoveConceptsAction([CONCEPT_A], 'clientStatus', 'approved');

    expect(result).toEqual({
      ok: true,
      moved: [],
      refused: [
        {
          id: CONCEPT_A,
          name: 'B1-A-Theme',
          reason: 'The client track opens once internal status reaches Approved.',
        },
      ],
    });
    expect(seam.clientMoved).toEqual([]);
    expect(seam.moved).toEqual([]);
  });

  it('moves the client track through updateConceptClientStatus once the gate is open', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    seam.rows = [
      row(CONCEPT_A, 'B1-A-Theme', 'approved', 'pending_for_approval'),
      row(CONCEPT_B, 'B2-B-Theme', 'draft', 'pending_for_approval'),
    ];

    const result = await bulkMoveConceptsAction([CONCEPT_A, CONCEPT_B], 'clientStatus', 'approved');

    // The open-gated row went through the client-status writer, note-less; the shut one never did.
    expect(seam.clientMoved).toEqual([{ id: CONCEPT_A, status: 'approved', note: null }]);
    expect(result).toEqual({
      ok: true,
      moved: [CONCEPT_A],
      refused: [
        {
          id: CONCEPT_B,
          name: 'B2-B-Theme',
          reason: 'The client track opens once internal status reaches Approved.',
        },
      ],
    });
  });
});
