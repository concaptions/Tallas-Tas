import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateCreatorAction } from './actions';

/** The action calls `revalidatePath`, which only exists inside a Next request. */
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** A connection would only ever be attempted after validation; nothing here should get that far. */
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn((): never => {
    throw new Error('the action reached Clerk');
  }),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** A save of every track and every §5.8.1 field at once, all of it legal. */
const filled = {
  id: '99999999-9999-4999-8999-000000000001',
  internalCreatorStatus: 'approved',
  clientStatus: 'filming_in_progress',
  internalAssetsStatus: 'pending_for_cs_approval',
  clientNote: 'Loved the first cut, can we see it without the voiceover?',
  instagramUsername: 'danielle.sleeps.late',
  forPartnershipAds: 'true',
  partnershipActivity: 'active',
  partnershipActivatedAt: '2026-07-22T09:00:00.000Z',
  partnershipPeriodDays: '60',
  continueWorkingWith: 'true',
  extensionDays: '30',
  partnershipPricePer30Days: '750',
  partnershipNotes: 'Extension signed, paperwork with finance.',
  facebookProfileUrl: 'https://www.facebook.com/danielle.okonkwo.creator',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to save, with the message the tooltip shows, before it looks at the id', async () => {
    const result = await updateCreatorAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });

  it('refuses a submission that is not even valid, rather than reporting the fields', async () => {
    const result = await updateCreatorAction(null, form({ ...filled, clientStatus: 'nonsense' }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
  });
});

describe('with Clerk configured', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function configured(): void {
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
  }

  it('rejects a submission whose id is missing', async () => {
    configured();

    const result = await updateCreatorAction(null, form({ clientStatus: 'approved' }));

    expect(result).toEqual({ ok: false, error: 'This creator could not be identified.' });
  });

  it('rejects a client status that is not in the vocabulary, before any actor or database call', async () => {
    configured();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, clientStatus: 'nearly_done' }),
    );

    if (result.ok) {
      throw new Error('an unknown client status was accepted');
    }
    expect(result.fieldErrors?.clientStatus).toBe('That is not one of the client statuses.');
  });

  it('rejects a status borrowed from a neighbouring track', async () => {
    configured();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, internalCreatorStatus: 'due_shipment' }),
    );

    if (result.ok) {
      throw new Error('a client-track status was accepted on the internal track');
    }
    expect(result.fieldErrors?.internalCreatorStatus).toBeDefined();
  });

  it('rejects a partnership activity outside Active / Not Active / Ended', async () => {
    configured();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, partnershipActivity: 'paused' }),
    );

    if (result.ok) {
      throw new Error('an unknown partnership activity was accepted');
    }
    expect(result.fieldErrors?.partnershipActivity).toBeDefined();
  });

  it('rejects a period that is not a whole number of days', async () => {
    configured();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, partnershipPeriodDays: 'sixty' }),
    );

    if (result.ok) {
      throw new Error('a non-numeric period was accepted');
    }
    expect(result.fieldErrors?.partnershipPeriodDays).toBe(
      'That needs to be a whole number of days.',
    );
  });

  it('rejects an activation date it cannot read', async () => {
    configured();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, partnershipActivatedAt: 'last Tuesday' }),
    );

    if (result.ok) {
      throw new Error('an unreadable activation date was accepted');
    }
    expect(result.fieldErrors?.partnershipActivatedAt).toBe(
      'That is not a date this form can read.',
    );
  });

  it('rejects a partnership flag that is neither true nor false', async () => {
    configured();

    const result = await updateCreatorAction(null, form({ ...filled, forPartnershipAds: 'on' }));

    if (result.ok) {
      throw new Error('a checkbox value was accepted as a boolean');
    }
    expect(result.fieldErrors?.forPartnershipAds).toBe('That is not a yes or a no.');
  });

  it('accepts the undecided third state of Continue Working With, and reaches the actor lookup', async () => {
    configured();

    // Everything is legal, so the action gets past validation and dies at the mocked Clerk call,
    // which the catch turns into the generic message: proof that nothing above refused it.
    const result = await updateCreatorAction(null, form({ ...filled, continueWorkingWith: '' }));

    expect(result).toEqual({ ok: false, error: 'The creator could not be saved. Try again.' });
  });
});
