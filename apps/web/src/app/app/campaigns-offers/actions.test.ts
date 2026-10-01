import type { CampaignInput, Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCampaignAction, updateCampaignAction } from './actions';

/**
 * The Campaigns & Offers route's two mutations, run against the real zod shape and the real
 * `parse`. Three seams are mocked and nothing else: the Next cache (only exists inside a request),
 * Clerk, and the brand scope, which would open a Neon connection. The two `@tas/db` writes are
 * replaced by recorders so a test can read the exact `CampaignInput` the query layer received —
 * that is how "Promotional Ideas" is proven to travel from the form to the row, and how an empty
 * textarea is proven to arrive as NULL rather than as an empty string.
 */

interface Seam {
  /** Null stands for a session that expired between rendering the panel and submitting it. */
  actor: string | null;
  /** Every `insertCampaign` call's values, in order. */
  inserted: CampaignInput[];
  /** Every `updateCampaign` call's `{ id, patch }`, in order. */
  updated: { id: string; patch: Partial<CampaignInput> }[];
}

const seam = vi.hoisted<Seam>(() => ({ actor: 'user_2TESTACTOR', inserted: [], updated: [] }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (): Promise<{ userId: string | null }> => Promise.resolve({ userId: seam.actor }),
}));

vi.mock('@/lib/campaigns-source', () => ({
  withBrandScope: <T>(run: (db: Db, brandId: string) => Promise<T>): Promise<T | null> =>
    run({} as Db, 'brand-under-test'),
}));

vi.mock('@tas/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tas/db')>()),
  insertCampaign: (_db: Db, _brandId: string, values: CampaignInput): Promise<{ id: string }> => {
    seam.inserted.push(values);
    return Promise.resolve({ id: 'campaign-created' });
  },
  updateCampaign: (
    _db: Db,
    _brandId: string,
    id: string,
    patch: Partial<CampaignInput>,
  ): Promise<{ id: string }> => {
    seam.updated.push({ id, patch });
    return Promise.resolve({ id });
  },
}));

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

/** A campaign as the panel submits it, every text column filled. */
const filled = {
  holiday: 'BFCM',
  discountOffer: '20%OFF',
  code: 'BFCM26',
  officialDate: '2026-11-27',
  country: 'US',
  description: 'Black Friday / Cyber Monday — blanket and mask bundles at 20% off site-wide.',
  promotionalIdeas: 'Gift with purchase on the bundle; early access for the VIP list.',
  confirmedByClient: 'true',
  launched: '',
  adsLaunchDate: '2026-11-20',
  adsEndDate: '2026-12-02',
  productId: '',
};

const CAMPAIGN_ID = 'dddddddd-dddd-4ddd-8ddd-000000000001';

/** Clerk configured is what makes it live mode; demo mode is the absence of the key. */
function live(): void {
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_configured');
}

function onlyInsert(): CampaignInput {
  const [values] = seam.inserted;
  if (values === undefined || seam.inserted.length !== 1) {
    throw new Error(`expected exactly one insert, saw ${String(seam.inserted.length)}`);
  }
  return values;
}

function onlyUpdate(): { id: string; patch: Partial<CampaignInput> } {
  const [call] = seam.updated;
  if (call === undefined || seam.updated.length !== 1) {
    throw new Error(`expected exactly one update, saw ${String(seam.updated.length)}`);
  }
  return call;
}

afterEach(() => {
  vi.unstubAllEnvs();
  seam.actor = 'user_2TESTACTOR';
  seam.inserted = [];
  seam.updated = [];
});

describe('in demo mode (no Clerk publishable key)', () => {
  it('refuses to create, before validation or any write', async () => {
    const result = await createCampaignAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.inserted).toEqual([]);
  });

  it('refuses to update, before it even looks at the id', async () => {
    const result = await updateCampaignAction(null, form({ ...filled, id: CAMPAIGN_ID }));

    expect(result).toEqual({ ok: false, error: 'Sign in required to save changes.' });
    expect(seam.updated).toEqual([]);
  });
});

describe('with Clerk configured · Promotional Ideas', () => {
  it('writes the textarea verbatim on create, trimmed, beside the generated name', async () => {
    live();

    const result = await createCampaignAction(
      null,
      form({ ...filled, promotionalIdeas: `  ${filled.promotionalIdeas}  ` }),
    );

    expect(result).toMatchObject({ ok: true, id: 'campaign-created' });
    expect(onlyInsert()).toMatchObject({
      name: 'BFCM-20%OFF-BFCM26',
      description: filled.description,
      promotionalIdeas: filled.promotionalIdeas,
    });
  });

  it('stores an emptied textarea as NULL, never as an empty string', async () => {
    live();

    await createCampaignAction(null, form({ ...filled, promotionalIdeas: '   ' }));

    expect(onlyInsert().promotionalIdeas).toBeNull();
  });

  it('is optional: a form that never posts the field still saves, with NULL', async () => {
    live();
    const withoutIdeas = form(filled);
    withoutIdeas.delete('promotionalIdeas');

    const result = await createCampaignAction(null, withoutIdeas);

    expect(result.ok).toBe(true);
    expect(onlyInsert().promotionalIdeas).toBeNull();
  });

  it('reaches the update patch under the campaign id the form carried', async () => {
    live();

    const result = await updateCampaignAction(
      null,
      form({ ...filled, id: CAMPAIGN_ID, promotionalIdeas: 'Creator unboxing series.' }),
    );

    expect(result).toMatchObject({ ok: true, id: CAMPAIGN_ID });
    const { id, patch } = onlyUpdate();
    expect(id).toBe(CAMPAIGN_ID);
    expect(patch.promotionalIdeas).toBe('Creator unboxing series.');
  });

  it('clears the column on update when the textarea is emptied', async () => {
    live();

    await updateCampaignAction(null, form({ ...filled, id: CAMPAIGN_ID, promotionalIdeas: '' }));

    expect(onlyUpdate().patch.promotionalIdeas).toBeNull();
  });
});

describe('with Clerk configured · the rest of the contract', () => {
  it('rejects an update whose id is missing, before any write', async () => {
    live();

    const result = await updateCampaignAction(null, form(filled));

    expect(result).toEqual({ ok: false, error: 'This campaign could not be identified.' });
    expect(seam.updated).toEqual([]);
  });

  it('answers an expired session with a typed failure and writes nothing', async () => {
    live();
    seam.actor = null;

    const result = await createCampaignAction(null, form(filled));

    expect(result).toEqual({
      ok: false,
      error: 'Your session has expired. Sign in again to save.',
    });
    expect(seam.inserted).toEqual([]);
  });
});
