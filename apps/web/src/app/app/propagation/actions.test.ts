import { auth } from '@clerk/nextjs/server';
import { demoPromotionRequests, demoTeam, setPromotionRequestStatus, type Db } from '@tas/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { approvePromotionAction, rejectPromotionAction } from './actions';

/** The actions call `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/**
 * A session is only ever asked for after validation, so the default throws: a test that expects a
 * validation failure proves the action never got that far. The live-mode tests override it.
 */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => {
    throw new Error('the action reached Clerk');
  }),
}));

/**
 * The connection is the one thing a unit test cannot have. `withAgencyScope` is replaced by a stub
 * that runs the callback against a handle whose only job is to be passed on; `listTeam` and
 * `setPromotionRequestStatus` are replaced too. Everything between — `teamPageActorFrom` in
 * `@/lib/team-actor`, which the page uses as well, and the domain's `canReviewPromotion` — runs for
 * real, which is the entire point of the authorisation tests below.
 */
vi.mock('@/lib/propagation-source', () => ({
  withAgencyScope: vi.fn((run: (db: Db, agencyId: string) => Promise<unknown>) =>
    run({} as Db, 'agency-1'),
  ),
}));

vi.mock('@tas/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tas/db')>();
  return {
    ...actual,
    listTeam: vi.fn(() => Promise.resolve(actual.demoTeam)),
    setPromotionRequestStatus: vi.fn(),
  };
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const [pending] = demoPromotionRequests;
if (pending === undefined) {
  throw new Error('the demo promotion fixtures are empty');
}

/** The seeded agency admin, and somebody on the roster who is not one. Neither name is typed here. */
const adminRow = demoTeam.find((row) => row.roles.includes('admin'));
const nonAdminRow = demoTeam.find((row) => !row.roles.includes('admin'));
if (adminRow?.clerkUserId == null || nonAdminRow?.clerkUserId == null) {
  throw new Error('the demo roster has no admin and non-admin pair with Clerk ids');
}
const adminUserId = adminRow.clerkUserId;
const nonAdminUserId = nonAdminRow.clerkUserId;

/** Live mode: a Clerk key is present and `auth()` answers with the given user. */
function signedInAs(userId: string | null): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  vi.mocked(auth).mockImplementation((() => Promise.resolve({ userId })) as never);
}

beforeEach(() => {
  vi.mocked(setPromotionRequestStatus).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(auth).mockImplementation(() => {
    throw new Error('the action reached Clerk');
  });
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to approve, with the message the disabled button shows', async () => {
    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses to reject, with the same message', async () => {
    const result = await rejectPromotionAction(
      null,
      form({ request: pending.id, note: 'Not for the template.' }),
    );

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses before it validates anything, so a junk submission gets the same answer', async () => {
    await expect(approvePromotionAction(null, form({ request: 'not-a-uuid' }))).resolves.toEqual({
      ok: false,
      error: 'Sign in required to save changes.',
    });
    await expect(rejectPromotionAction(null, form({}))).resolves.toEqual({
      ok: false,
      error: 'Sign in required to save changes.',
    });
  });

  it('never reaches Clerk or a database, and never throws', async () => {
    // The Clerk mock throws and the db write is spied on; a returned refusal is the proof.
    await expect(
      approvePromotionAction(null, form({ request: pending.id })),
    ).resolves.toMatchObject({ ok: false });
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });

  it('refuses every seeded request, in both directions', async () => {
    for (const request of demoPromotionRequests) {
      await expect(approvePromotionAction(null, form({ request: request.id }))).resolves.toEqual({
        ok: false,
        error: 'Sign in required to save changes.',
      });
      await expect(
        rejectPromotionAction(null, form({ request: request.id, note: 'No.' })),
      ).resolves.toEqual({ ok: false, error: 'Sign in required to save changes.' });
    }
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });
});

describe('validation, with Clerk configured', () => {
  it('rejects an id that is not a uuid, before any session or database call', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await approvePromotionAction(null, form({ request: 'row-1' }));

    if (result.ok) {
      throw new Error('a non-uuid request id was accepted');
    }
    expect(result.fieldErrors?.request).toBe('That request could not be identified.');
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });

  it('rejects a submission with no request at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await rejectPromotionAction(null, form({ note: 'Nope.' }));

    if (result.ok) {
      throw new Error('a submission with no request was accepted');
    }
    expect(result.fieldErrors?.request).toBe('That request could not be identified.');
  });

  it('refuses a rejection with no reason', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await rejectPromotionAction(null, form({ request: pending.id, note: '   ' }));

    if (result.ok) {
      throw new Error('a rejection with no reason was accepted');
    }
    expect(result.fieldErrors?.note).toBe('A rejection needs a reason.');
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });

  it('refuses a reason longer than the column is meant to carry', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');

    const result = await rejectPromotionAction(
      null,
      form({ request: pending.id, note: 'x'.repeat(501) }),
    );

    if (result.ok) {
      throw new Error('an oversized reason was accepted');
    }
    expect(result.fieldErrors?.note).toMatch(/under 500 characters/u);
  });

  it('does not require a note to approve', async () => {
    signedInAs(adminUserId);
    vi.mocked(setPromotionRequestStatus).mockResolvedValue({ ...pending, status: 'approved' });

    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result.ok).toBe(true);
    expect(vi.mocked(setPromotionRequestStatus).mock.calls[0]?.[5]).toBeNull();
  });
});

describe('authorisation, with Clerk configured', () => {
  it('refuses a signed-in non-admin, however the form was filled in', async () => {
    signedInAs(nonAdminUserId);

    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result).toEqual({
      ok: false,
      error: 'Only an agency Admin can approve or reject a promotion request.',
    });
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });

  it('refuses a non-admin rejection too, so a disabled button is not the only guard', async () => {
    signedInAs(nonAdminUserId);

    const result = await rejectPromotionAction(
      null,
      form({ request: pending.id, note: 'Off-brand.' }),
    );

    expect(result).toEqual({
      ok: false,
      error: 'Only an agency Admin can approve or reject a promotion request.',
    });
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });

  it('refuses somebody with no roster row at all', async () => {
    signedInAs('user_not_on_this_roster');

    await expect(approvePromotionAction(null, form({ request: pending.id }))).resolves.toEqual({
      ok: false,
      error: 'Only an agency Admin can approve or reject a promotion request.',
    });
  });

  it('refuses an expired session before it reads the roster', async () => {
    signedInAs(null);

    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to review this request.',
    });
    expect(setPromotionRequestStatus).not.toHaveBeenCalled();
  });
});

describe('the write, with an admin signed in', () => {
  it('approves the request and answers with the domain’s label', async () => {
    signedInAs(adminUserId);
    vi.mocked(setPromotionRequestStatus).mockResolvedValue({ ...pending, status: 'approved' });

    const result = await approvePromotionAction(
      null,
      form({ request: pending.id, note: 'Every brand phrases it this way already.' }),
    );

    expect(result).toMatchObject({
      ok: true,
      requestId: pending.id,
      status: 'approved',
      statusLabel: 'Approved',
    });
    expect(vi.mocked(setPromotionRequestStatus).mock.calls[0]?.slice(1, 6)).toEqual([
      'agency-1',
      pending.id,
      'approved',
      adminUserId,
      'Every brand phrases it this way already.',
    ]);
  });

  it('rejects the request and carries the reason into the review note', async () => {
    signedInAs(adminUserId);
    vi.mocked(setPromotionRequestStatus).mockResolvedValue({ ...pending, status: 'rejected' });

    const result = await rejectPromotionAction(
      null,
      form({ request: pending.id, note: '  Brand-specific, not a template change.  ' }),
    );

    expect(result).toMatchObject({ ok: true, status: 'rejected', statusLabel: 'Rejected' });
    expect(vi.mocked(setPromotionRequestStatus).mock.calls[0]?.[5]).toBe(
      'Brand-specific, not a template change.',
    );
  });

  it('answers with a typed failure when the request is no longer pending', async () => {
    signedInAs(adminUserId);
    vi.mocked(setPromotionRequestStatus).mockResolvedValue(null);

    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result).toEqual({
      ok: false,
      error: 'That request is no longer waiting for a decision.',
    });
  });

  it('never throws to the client when the write itself fails', async () => {
    signedInAs(adminUserId);
    vi.mocked(setPromotionRequestStatus).mockRejectedValue(new Error('connection reset'));

    const result = await approvePromotionAction(null, form({ request: pending.id }));

    expect(result).toEqual({ ok: false, error: 'That decision could not be saved. Try again.' });
  });
});
