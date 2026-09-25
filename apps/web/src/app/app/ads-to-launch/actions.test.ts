import { demoBriefs, type BriefListRow } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getBriefById: vi.fn(),
  transitionBriefLaunch:
    vi.fn<
      (
        db: unknown,
        brandId: string,
        id: string,
        move: Record<string, unknown>,
        actor: string,
      ) => Promise<unknown>
    >(),
  setLaunchPriority:
    vi.fn<
      (
        db: unknown,
        brandId: string,
        id: string,
        priority: number,
        actor: string,
      ) => Promise<unknown>
    >(),
}));

/** `revalidatePath` only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));

/**
 * The two queries the write path uses; `toBriefRow` and the fixtures stay real. That the scoped
 * read and the compare-and-set never reach another brand is proven against Postgres in
 * `packages/db/src/launch-queue.test.ts`; here the question is what the ACTION decides.
 */
vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  getBriefById: mocks.getBriefById,
  transitionBriefLaunch: mocks.transitionBriefLaunch,
  setLaunchPriority: mocks.setLaunchPriority,
}));

/** Runs the action body against a stand-in db with the actor's brand already resolved. */
vi.mock('@/lib/briefs-source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/briefs-source')>()),
  withBrandScope: vi.fn(
    async (run: (db: unknown, brandId: string) => Promise<unknown>) => await run({}, 'brand-1'),
  ),
}));

import {
  markAsLaunchedAction,
  markAsPausedAction,
  resumeLaunchedAction,
  updateLaunchPriorityAction,
} from './actions';

const ID = '77777777-7777-4777-8777-000000000001';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function stored(internalStatus: string, clientStatus: string): BriefListRow {
  const base = demoBriefs.find((brief) => brief.id === ID);
  if (base === undefined) throw new Error('no seeded brief');
  return { ...base, type: 'Video', internalStatus, clientStatus };
}

function configured(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  mocks.auth.mockResolvedValue({ userId: 'user_buyer_1' });
  mocks.transitionBriefLaunch.mockImplementation(
    (_db: unknown, _brandId: string, id: string, move: Record<string, unknown>) =>
      Promise.resolve({ id, clientStatus: move.clientStatus }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.auth.mockReset();
  mocks.getBriefById.mockReset();
  mocks.transitionBriefLaunch.mockReset();
  mocks.setLaunchPriority.mockReset();
});

describe('in demo mode', () => {
  it('refuses every move before touching anything', async () => {
    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });
});

describe('markAsLaunchedAction', () => {
  it('launches a client-approved creative on BOTH tracks and stamps launched_at (PRD §9)', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));

    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result).toMatchObject({ ok: true, id: ID, clientStatus: 'launched' });
    const call = mocks.transitionBriefLaunch.mock.calls[0];
    if (call === undefined) throw new Error('no transition was written');
    const [, brandId, id, move, actor] = call;
    expect(brandId).toBe('brand-1');
    expect(id).toBe(ID);
    expect(actor).toBe('user_buyer_1');
    expect(move).toMatchObject({
      fromClientStatus: 'approved',
      fromInternalStatus: 'approved',
      clientStatus: 'launched',
      internalStatus: 'launched',
    });
    expect(move.launchedAt).toBeInstanceOf(Date);
  });

  it('refuses a creative the client has not approved, and writes nothing', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'pending_for_approval'));

    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result).toEqual({ ok: false, error: 'That is not the next step for this creative.' });
    expect(mocks.transitionBriefLaunch).not.toHaveBeenCalled();
  });

  it('refuses while the internal gate is shut, whatever the stored client status says', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('ad_submitted', 'approved'));

    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result.ok).toBe(false);
    expect(mocks.transitionBriefLaunch).not.toHaveBeenCalled();
  });

  it("refuses another brand's brief: the scoped read finds nothing, so nothing is written", async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(null);

    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result).toEqual({ ok: false, error: 'That creative is no longer available.' });
    expect(mocks.transitionBriefLaunch).not.toHaveBeenCalled();
  });

  it('reports a lost race instead of claiming success when the compare-and-set matches nothing', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));
    mocks.transitionBriefLaunch.mockResolvedValue(null);

    const result = await markAsLaunchedAction(null, form({ id: ID }));

    expect(result).toEqual({
      ok: false,
      error: 'This creative changed while you were looking at it. Reload and try again.',
    });
  });

  it('takes the target from the action, never from the form', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));

    await markAsLaunchedAction(null, form({ id: ID, clientStatus: 'paused' }));

    const move = mocks.transitionBriefLaunch.mock.calls[0]?.[3];
    expect(move?.clientStatus).toBe('launched');
  });

  it('refuses a malformed id before any read', async () => {
    configured();

    const result = await markAsLaunchedAction(null, form({ id: 'not-a-uuid' }));

    expect(result).toEqual({ ok: false, error: 'This creative could not be identified.' });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });
});

describe('markAsPausedAction and resumeLaunchedAction', () => {
  it('pauses a live ad on the client track only and keeps launched_at', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('launched', 'launched'));

    const result = await markAsPausedAction(null, form({ id: ID }));

    expect(result).toMatchObject({ ok: true, clientStatus: 'paused' });
    const move = mocks.transitionBriefLaunch.mock.calls[0]?.[3];
    expect(move).toMatchObject({ clientStatus: 'paused', internalStatus: 'launched' });
    expect(move).not.toHaveProperty('launchedAt');
  });

  it('resumes a paused ad back to Launched', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('launched', 'paused'));

    const result = await resumeLaunchedAction(null, form({ id: ID }));

    expect(result).toMatchObject({ ok: true, clientStatus: 'launched' });
  });

  it('refuses to pause what is not live and to resume what is not paused', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));
    expect((await markAsPausedAction(null, form({ id: ID }))).ok).toBe(false);

    mocks.getBriefById.mockResolvedValue(stored('launched', 'launched'));
    expect((await resumeLaunchedAction(null, form({ id: ID }))).ok).toBe(false);

    expect(mocks.transitionBriefLaunch).not.toHaveBeenCalled();
  });
});

describe('updateLaunchPriorityAction', () => {
  it('refuses in demo mode before touching anything', async () => {
    const result = await updateLaunchPriorityAction(null, form({ id: ID, priority: '2' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });

  it('sets a valid priority (1–10) on a ready creative', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));
    mocks.setLaunchPriority.mockResolvedValue({ id: ID });

    const result = await updateLaunchPriorityAction(null, form({ id: ID, priority: '3' }));

    expect(result).toMatchObject({ ok: true, id: ID, priority: 3 });
    const call = mocks.setLaunchPriority.mock.calls[0];
    if (call === undefined) throw new Error('no priority was written');
    const [, brandId, id, priority, actor] = call;
    expect(brandId).toBe('brand-1');
    expect(id).toBe(ID);
    expect(priority).toBe(3);
    expect(actor).toBe('user_buyer_1');
  });

  it('rejects a priority outside 1–10, before any read or write', async () => {
    configured();

    const tooHigh = await updateLaunchPriorityAction(null, form({ id: ID, priority: '11' }));
    const zero = await updateLaunchPriorityAction(null, form({ id: ID, priority: '0' }));
    const notNumber = await updateLaunchPriorityAction(null, form({ id: ID, priority: 'first' }));

    for (const result of [tooHigh, zero, notNumber]) {
      expect(result).toEqual({
        ok: false,
        error: 'That is not a valid priority for this creative.',
      });
    }
    expect(mocks.getBriefById).not.toHaveBeenCalled();
    expect(mocks.setLaunchPriority).not.toHaveBeenCalled();
  });

  it('rejects a malformed id before any read', async () => {
    configured();

    const result = await updateLaunchPriorityAction(
      null,
      form({ id: 'not-a-uuid', priority: '2' }),
    );

    expect(result).toEqual({ ok: false, error: 'That is not a valid priority for this creative.' });
    expect(mocks.getBriefById).not.toHaveBeenCalled();
  });

  it("refuses another brand's brief: the scoped read finds nothing, so nothing is written", async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(null);

    const result = await updateLaunchPriorityAction(null, form({ id: ID, priority: '2' }));

    expect(result).toEqual({ ok: false, error: 'That creative is no longer available.' });
    expect(mocks.setLaunchPriority).not.toHaveBeenCalled();
  });

  it('reports a lost race when the compare-and-set matches nothing (already launched)', async () => {
    configured();
    mocks.getBriefById.mockResolvedValue(stored('approved', 'approved'));
    mocks.setLaunchPriority.mockResolvedValue(null);

    const result = await updateLaunchPriorityAction(null, form({ id: ID, priority: '2' }));

    expect(result).toEqual({
      ok: false,
      error: 'This creative changed while you were looking at it. Reload and try again.',
    });
  });
});
