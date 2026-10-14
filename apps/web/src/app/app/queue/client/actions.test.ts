import { demoBriefs, type BriefListRow } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getBriefById: vi.fn(),
  updateBrief: vi.fn(),
  insertActivity: vi.fn(),
}));

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));

/**
 * The two queries the write path uses, and nothing else: `toBriefRow` and the fixtures stay real, so
 * the rows under test are the ones that actually ship.
 */
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  getBriefById: mocks.getBriefById,
  updateBrief: mocks.updateBrief,
  insertActivity: mocks.insertActivity,
}));

/**
 * `withBrandScope` is where the connection and the brand resolution live. Replacing it runs the body
 * of the action against a stand-in db with a brand already resolved, which is what lets the PRD §9
 * gate be tested at all — the real helper would want Neon.
 */
vi.mock('@/lib/briefs-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/briefs-source')>()),
  withBrandScope: vi.fn(
    async (run: (db: unknown, brandId: string) => Promise<unknown>) => await run({}, 'brand-1'),
  ),
}));

import { approveCreativeAction, requestRevisionsAction } from './actions';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function fixture(id: string): BriefListRow {
  const row = demoBriefs.find((brief) => brief.id === id);
  if (row === undefined) {
    throw new Error(`no seeded brief ${id}`);
  }
  return row;
}

/** Internally Approved, client Pending for Approval: the card the board actually shows. */
const ON_THE_BOARD = fixture('77777777-7777-4777-8777-000000000001');

/** Still in design. It can never be on the board — and must still be refused if it is submitted. */
const PRE_APPROVED = fixture('77777777-7777-4777-8777-000000000002');

function configured(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  mocks.auth.mockResolvedValue({ userId: 'user_client_1' });
}

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.auth.mockReset();
  mocks.getBriefById.mockReset();
  mocks.updateBrief.mockReset();
  mocks.insertActivity.mockReset();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to approve, with the message the board shows', async () => {
    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to request revisions, with the same message', async () => {
    const result = await requestRevisionsAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses before validation, the actor lookup and any query — an id it never even reads', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await approveCreativeAction(null, form({ id: 'not-a-uuid-at-all' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.getBriefById).not.toHaveBeenCalled();
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });
});

describe('with Clerk configured', () => {
  it('rejects a submission whose brief id is not an id at all', async () => {
    configured();

    const result = await approveCreativeAction(null, form({ id: 'the-first-card' }));

    expect(result).toEqual({ ok: false, error: 'This creative could not be identified.' });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });

  it('rejects a submission with no brief id', async () => {
    configured();

    const result = await requestRevisionsAction(null, form({}));

    expect(result).toEqual({ ok: false, error: 'This creative could not be identified.' });
  });

  /**
   * PRD §9 is a rule about the DATA, not only about which cards render. The loader already withholds
   * this brief, so no card for it exists — the action must refuse it anyway, because a submission can
   * arrive without a card.
   */
  it('refuses an approval on a brief the internal track has not approved, and writes nothing', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(PRE_APPROVED);

    const result = await approveCreativeAction(null, form({ id: PRE_APPROVED.id }));

    expect(result).toEqual({
      ok: false,
      error: 'The client track opens once internal status reaches Approved.',
    });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('refuses a revision request on the same brief, for the same reason', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(PRE_APPROVED);

    const result = await requestRevisionsAction(null, form({ id: PRE_APPROVED.id }));

    expect(result).toEqual({
      ok: false,
      error: 'The client track opens once internal status reaches Approved.',
    });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('approves a brief that is on the board, storing the status the action table names', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(ON_THE_BOARD);
    mocks.updateBrief.mockResolvedValue({ ...ON_THE_BOARD, clientStatus: 'approved' });

    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toMatchObject({ ok: true, id: ON_THE_BOARD.id, clientStatus: 'approved' });
    // Approve does NOT reset QA (only moves into `revisions_needed` do), so the patch stays
    // the one-key shape it was before the Oct 14 follow-up #2 fix.
    expect(mocks.updateBrief).toHaveBeenCalledWith(
      {},
      'brand-1',
      ON_THE_BOARD.id,
      { clientStatus: 'approved' },
      'user_client_1',
    );
  });

  /**
   * PRD §9's other branch out of Pending for Approval. It used to be unreachable — `CLIENT_STATUS`
   * had no `revisions_needed` key, so this action answered "not the next step" from every state and
   * the button could never succeed. D-027 added the status and the edge; this pins the move.
   */
  it('sends a creative back for changes, storing Revisions Needed and resetting QA', async () => {
    configured();
    const seeded = {
      ...ON_THE_BOARD,
      qaVideoEditor: true,
      qaDesigner: true,
      qaStrategist: false,
    };
    mocks.getBriefById.mockResolvedValue(seeded);
    mocks.updateBrief.mockResolvedValue({
      ...seeded,
      clientStatus: 'revisions_needed',
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
    });

    const result = await requestRevisionsAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toMatchObject({
      ok: true,
      id: ON_THE_BOARD.id,
      clientStatus: 'revisions_needed',
    });
    // Oct 14 follow-up #2: the QA reset lands in the SAME write the status moves in — the
    // same rule the brief page applies through `statusPatch`. The two writers now share one
    // source of truth via `qaResetFor`.
    expect(mocks.updateBrief).toHaveBeenCalledWith(
      {},
      'brand-1',
      ON_THE_BOARD.id,
      {
        qaVideoEditor: false,
        qaDesigner: false,
        qaStrategist: false,
        clientStatus: 'revisions_needed',
      },
      'user_client_1',
    );
    // The activity ledger records the status move AND the two QA ticks that changed, so a
    // reader can see what the client's "Request Revisions" caused.
    expect(mocks.insertActivity).toHaveBeenCalledTimes(1);
    const [, brandArg, entityType, entityId, diff] = mocks.insertActivity.mock.calls[0] as [
      unknown,
      string,
      string,
      string,
      ReadonlyArray<{ field: string; oldValue: string | null; newValue: string | null }>,
    ];
    expect(brandArg).toBe('brand-1');
    expect(entityType).toBe('creative_brief');
    expect(entityId).toBe(ON_THE_BOARD.id);
    expect(diff).toEqual([
      { field: 'clientStatus', oldValue: 'pending_for_approval', newValue: 'revisions_needed' },
      { field: 'qaVideoEditor', oldValue: 'true', newValue: 'false' },
      { field: 'qaDesigner', oldValue: 'true', newValue: 'false' },
    ]);
  });

  /**
   * The card no longer draws a control the state machine refuses, but a submission can arrive without
   * a card. An Approve on a creative the client already approved must still be refused here.
   */
  it('refuses a move the state machine has no edge for, rather than inventing one', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue({ ...ON_THE_BOARD, clientStatus: 'approved' });

    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({
      ok: false,
      error: 'That is not the next step on the client track.',
    });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('refuses a revision request on a creative already sitting in Revisions Needed', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue({ ...ON_THE_BOARD, clientStatus: 'revisions_needed' });

    const result = await requestRevisionsAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({
      ok: false,
      error: 'That is not the next step on the client track.',
    });
    expect(mocks.updateBrief).not.toHaveBeenCalled();
  });

  it('answers with a typed failure when the brief is gone, and never throws', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(null);

    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({ ok: false, error: 'That creative is no longer available.' });
  });

  it('turns a query that throws into a typed failure rather than an exception at the client', async () => {
    configured();
    mocks.getBriefById.mockRejectedValue(new Error('connection reset'));

    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({
      ok: false,
      error: 'The client status could not be saved. Try again.',
    });
  });

  it('refuses when the session has gone away between render and submit', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await approveCreativeAction(null, form({ id: ON_THE_BOARD.id }));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });
});
