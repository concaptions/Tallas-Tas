import type { CreatorInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { updateCreatorAction } from './actions';

/**
 * The UGC panel's save, run against the real zod shape and the real `fieldsOf`. Three seams are
 * mocked and nothing else: the Next cache (only exists inside a request), Clerk, and the brand
 * scope, which would open a Neon connection. The `@tas/db` write and the two junction syncs are
 * replaced by recorders so a test can read the exact patch the query layer received — that is how
 * "Payment Date" is proven to arrive as a Date, "Creator Info Request" as trimmed text or NULL,
 * "Creator Cost (USD)" proven to land in `creator_cost` and "Paid by TAS (USD)" in `cost_usd`, a
 * status proven to be refused outside the domain vocabulary, and "Slack Notified" and the
 * scanner's two partnership columns proven NOT to be writable from this form at all.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the panel and submitting it. */
  actor: string | null;
  /** Every `updateCreator` call's `{ id, patch }`, in order. */
  updated: { id: string; patch: Partial<CreatorInput> }[];
}

const seam = vi.hoisted<Seam>(() => ({ actor: 'user_2TESTACTOR', updated: [] }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

vi.mock('@/lib/ugc-source', () => ({
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  updateCreator: (
    _db: Db,
    _brandId: string,
    id: string,
    patch: Partial<CreatorInput>,
  ): Promise<{ id: string }> => {
    seam.updated.push({ id, patch });
    return Promise.resolve({ id });
  },
  syncCreatorConcepts: (): Promise<void> => Promise.resolve(),
  syncCreatorProducts: (): Promise<void> => Promise.resolve(),
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

const CREATOR_ID = 'cccccccc-cccc-4ccc-8ccc-000000000001';

/** A creator as the panel submits it, every Gratsi parity field filled or deliberately empty. */
const filled = {
  id: CREATOR_ID,
  name: 'Danielle Okonkwo',
  gender: 'Female',
  ethnicity: 'Black Canadian',
  ageBracket: '25-34',
  platform: 'instagram',
  profilePicUrl: '',
  videoIntroUrl: 'https://vimeo.com/niagarasleep/danielle-okonkwo-intro',
  internalCreatorStatus: 'approved',
  clientStatus: 'filming_in_progress',
  clientNote: 'She is the one.',
  creatorLink: 'https://www.instagram.com/danielle.sleeps.late',
  shippingLocation: 'Hamilton, ON',
  trackingNumber: '',
  rawAssetsUrl: '',
  internalBrief: '',
  instagramUsername: '@danielle.sleeps.late',
  facebookProfileUrl: '',
  partnershipPeriodDays: '60',
  extensionDays: '',
  continueWorkingWith: 'yes',
  creatorCost: '630',
  costUsd: '350',
  budgetPer60s: '420',
  partnershipPricePer30Days: '750',
  paymentDate: '2026-09-12',
  dateOfManagement: '2026-06-18',
  creatorInfoRequest: 'Please send your shipping address and the handle to whitelist.',
  partnershipNotes: '',
};

/** Clerk configured is what makes it live mode; demo mode is the absence of the key. */
function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

function onlyUpdate(): { id: string; patch: Partial<CreatorInput> } {
  const [call] = seam.updated;
  if (call === undefined || seam.updated.length !== 1) {
    throw new Error(`expected exactly one update, saw ${String(seam.updated.length)}`);
  }
  return call;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.updated = [];
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to save, before validation or any write', async () => {
    const result = await updateCreatorAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.updated).toEqual([]);
  });
});

describe('with Clerk configured · Payment Date', () => {
  it('reaches the patch as a Date at UTC midnight of the day the input posted', async () => {
    live();

    const result = await updateCreatorAction(null, form(filled));

    expect(result).toMatchObject({ ok: true, id: CREATOR_ID });
    const { id, patch } = onlyUpdate();
    expect(id).toBe(CREATOR_ID);
    expect(patch.paymentDate).toEqual(new Date('2026-09-12T00:00:00.000Z'));
  });

  it('clears to NULL when the input is emptied', async () => {
    live();

    await updateCreatorAction(null, form({ ...filled, paymentDate: '' }));

    expect(onlyUpdate().patch.paymentDate).toBeNull();
  });

  it('stores NULL, not an Invalid Date, for a value no date input would post', async () => {
    live();

    await updateCreatorAction(null, form({ ...filled, paymentDate: 'not-a-date' }));

    expect(onlyUpdate().patch.paymentDate).toBeNull();
  });
});

describe('with Clerk configured · Creator Info Request', () => {
  it('writes the textarea verbatim, trimmed', async () => {
    live();

    await updateCreatorAction(
      null,
      form({ ...filled, creatorInfoRequest: `  ${filled.creatorInfoRequest}  ` }),
    );

    expect(onlyUpdate().patch.creatorInfoRequest).toBe(filled.creatorInfoRequest);
  });

  it('stores an emptied textarea as NULL, never as an empty string', async () => {
    live();

    await updateCreatorAction(null, form({ ...filled, creatorInfoRequest: '   ' }));

    expect(onlyUpdate().patch.creatorInfoRequest).toBeNull();
  });

  it('is optional: a form that never posts the field still saves, with NULL', async () => {
    live();
    const withoutRequest = Object.fromEntries(
      Object.entries(filled).filter(([key]) => key !== 'creatorInfoRequest'),
    );

    const result = await updateCreatorAction(null, form(withoutRequest));

    expect(result.ok).toBe(true);
    expect(onlyUpdate().patch.creatorInfoRequest).toBeNull();
  });
});

describe('with Clerk configured · Slack Notified and the scanner columns', () => {
  it('are never written from this form, even when the request smuggles the keys', async () => {
    live();

    await updateCreatorAction(
      null,
      form({
        ...filled,
        slackNotified: 'true',
        partnershipActivity: 'active',
        partnershipActivatedAt: '2026-07-22',
      }),
    );

    const { patch } = onlyUpdate();
    expect(patch).not.toHaveProperty('slackNotified');
    expect(patch).not.toHaveProperty('partnershipActivity');
    expect(patch).not.toHaveProperty('partnershipActivatedAt');
  });
});

describe('with Clerk configured · the two cost columns', () => {
  it('lands Creator Cost in creator_cost and Paid by TAS in cost_usd, never swapped', async () => {
    live();

    await updateCreatorAction(null, form(filled));

    const { patch } = onlyUpdate();
    expect(patch.creatorCost).toBe(630);
    expect(patch.costUsd).toBe(350);
    expect(patch.budgetPer60s).toBe(420);
  });

  it('clears either to NULL when its input is emptied', async () => {
    live();

    await updateCreatorAction(null, form({ ...filled, creatorCost: '', costUsd: '' }));

    const { patch } = onlyUpdate();
    expect(patch.creatorCost).toBeNull();
    expect(patch.costUsd).toBeNull();
  });
});

describe('with Clerk configured · the status tracks', () => {
  it('writes a key the domain knows on each track', async () => {
    live();

    await updateCreatorAction(null, form(filled));

    const { patch } = onlyUpdate();
    expect(patch.internalCreatorStatus).toBe('approved');
    expect(patch.clientStatus).toBe('filming_in_progress');
  });

  it('leaves a track alone when the form posts nothing for it', async () => {
    live();

    await updateCreatorAction(
      null,
      form({ ...filled, internalCreatorStatus: '', clientStatus: '' }),
    );

    const { patch } = onlyUpdate();
    expect(patch).not.toHaveProperty('internalCreatorStatus');
    expect(patch).not.toHaveProperty('clientStatus');
  });

  it('refuses a value outside the track vocabulary and writes nothing', async () => {
    live();

    // A client-track key is not an internal-track key, and vice versa.
    const crossed = await updateCreatorAction(
      null,
      form({ ...filled, internalCreatorStatus: 'filming_in_progress' }),
    );
    const unknown = await updateCreatorAction(
      null,
      form({ ...filled, clientStatus: 'shortlisted' }),
    );

    expect(crossed.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    expect(seam.updated).toEqual([]);
  });
});

describe('with Clerk configured · Continue Working With?', () => {
  it('stores yes as true, no as false and undecided as NULL', async () => {
    live();

    await updateCreatorAction(null, form(filled));
    await updateCreatorAction(null, form({ ...filled, continueWorkingWith: 'no' }));
    await updateCreatorAction(null, form({ ...filled, continueWorkingWith: 'undecided' }));
    await updateCreatorAction(null, form({ ...filled, continueWorkingWith: '' }));

    expect(seam.updated.map((call) => call.patch.continueWorkingWith)).toEqual([
      true,
      false,
      null,
      null,
    ]);
  });

  it('refuses an answer that is not one of the three', async () => {
    live();

    const result = await updateCreatorAction(
      null,
      form({ ...filled, continueWorkingWith: 'maybe' }),
    );

    expect(result.ok).toBe(false);
    expect(seam.updated).toEqual([]);
  });
});

describe('with Clerk configured · the partnership window and the management date', () => {
  it('reads the period as whole days and an emptied extension as zero, never NULL', async () => {
    live();

    await updateCreatorAction(null, form(filled));
    await updateCreatorAction(
      null,
      form({ ...filled, partnershipPeriodDays: '', extensionDays: '30' }),
    );

    const [first, second] = seam.updated;
    expect(first?.patch.partnershipPeriodDays).toBe(60);
    expect(first?.patch.extensionDays).toBe(0);
    expect(second?.patch.partnershipPeriodDays).toBeNull();
    expect(second?.patch.extensionDays).toBe(30);
  });

  it('reaches the patch as a Date, and as NULL when emptied', async () => {
    live();

    await updateCreatorAction(null, form(filled));
    await updateCreatorAction(null, form({ ...filled, dateOfManagement: '' }));

    const [first, second] = seam.updated;
    expect(first?.patch.dateOfManagement).toEqual(new Date('2026-06-18T00:00:00.000Z'));
    expect(second?.patch.dateOfManagement).toBeNull();
  });

  it('writes the handle, the Facebook profile and the partnership notes as trimmed text or NULL', async () => {
    live();

    await updateCreatorAction(
      null,
      form({ ...filled, facebookProfileUrl: '  https://www.facebook.com/danielle  ' }),
    );

    const { patch } = onlyUpdate();
    expect(patch.instagramUsername).toBe('@danielle.sleeps.late');
    expect(patch.facebookProfileUrl).toBe('https://www.facebook.com/danielle');
    expect(patch.partnershipNotes).toBeNull();
    expect(patch.clientNote).toBe('She is the one.');
    expect(patch.profilePicUrl).toBeNull();
    expect(patch.videoIntroUrl).toBe(filled.videoIntroUrl);
  });
});

describe('with Clerk configured · the rest of the contract', () => {
  it('answers an expired session with a typed failure and writes nothing', async () => {
    live();
    seam.actor = null;

    const result = await updateCreatorAction(null, form(filled));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.updated).toEqual([]);
  });
});
