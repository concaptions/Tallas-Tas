import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCampaignById,
  insertCampaign,
  listCampaigns,
  updateCampaign,
  type CampaignInput,
} from './campaigns';
import { demoCampaigns } from './demo-data';
import type { CampaignOffer } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * The Campaigns & Offers query layer on PGlite (PRD §5.3). The focus is `promotional_ideas`,
 * Airtable "Promotional Ideas" (rich text), added by migration 0038 and read and written through
 * these functions only: the row that `listCampaigns` returns carries it, `insertCampaign` and
 * `updateCampaign` write it, and every one of them stays inside the scoped brand.
 */

const ACTOR = 'user_2TESTACTOR';

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/** Every writable column filled, so a round-trip proves each one survives insert and select. */
function input(overrides: Partial<CampaignInput> = {}): CampaignInput {
  return {
    name: 'Mothers Day-15%OFF-MUM27',
    holiday: 'Mothers Day',
    discountOffer: '15%OFF',
    code: 'MUM27',
    officialDate: '2027-05-09',
    country: 'UK',
    description: 'Gift bundles for Mothers Day, blanket and mask together.',
    promotionalIdeas: 'Free gift wrap; a handwritten card at checkout; creator gifting in April.',
    confirmedByClient: false,
    launched: false,
    adsLaunchDate: '2027-04-25',
    adsEndDate: '2027-05-10',
    productId: null,
    ...overrides,
  };
}

describe('CampaignInput', () => {
  it('carries promotionalIdeas as a nullable string, derived from the table', () => {
    expectTypeOf<CampaignInput>().toHaveProperty('promotionalIdeas');
    expectTypeOf<CampaignInput['promotionalIdeas']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<CampaignOffer['promotionalIdeas']>().toEqualTypeOf<string | null>();
  });
});

describe('promotional_ideas through the campaign query layer', () => {
  it('round-trips from insertCampaign to the listCampaigns row and getCampaignById', async () => {
    const { db, brandId } = await seeded();

    const created = await insertCampaign(db, brandId, input(), ACTOR);

    expect(created.promotionalIdeas).toBe(
      'Free gift wrap; a handwritten card at checkout; creator gifting in April.',
    );
    const listed = (await listCampaigns(db, brandId)).find((row) => row.id === created.id);
    expect(listed?.promotionalIdeas).toBe(created.promotionalIdeas);
    expect(listed?.description).toBe(created.description);
    const fetched = await getCampaignById(db, brandId, created.id);
    expect(fetched?.promotionalIdeas).toBe(created.promotionalIdeas);
  });

  it('is NULL when the insert leaves it out, as the demo fixtures do', async () => {
    const { db, brandId } = await seeded();

    const created = await insertCampaign(db, brandId, input({ promotionalIdeas: null }), ACTOR);
    const seededRows = await listCampaigns(db, brandId);

    expect(created.promotionalIdeas).toBeNull();
    expect(demoCampaigns.every((row) => row.promotionalIdeas === null)).toBe(true);
    expect(
      seededRows.filter((row) => row.id !== created.id).map((row) => row.promotionalIdeas),
    ).toEqual(demoCampaigns.map(() => null));
  });

  it('updateCampaign writes a new value, then clears it back to NULL, touching nothing else', async () => {
    const { db, brandId } = await seeded();
    const created = await insertCampaign(db, brandId, input(), ACTOR);

    const written = await updateCampaign(
      db,
      brandId,
      created.id,
      { promotionalIdeas: 'Creator unboxing series.' },
      'user_2EDITOR',
    );
    expect(written?.promotionalIdeas).toBe('Creator unboxing series.');
    expect(written?.description).toBe(created.description);
    expect(written?.updatedBy).toBe('user_2EDITOR');

    const cleared = await updateCampaign(
      db,
      brandId,
      created.id,
      { promotionalIdeas: null },
      'user_2EDITOR',
    );
    expect(cleared?.promotionalIdeas).toBeNull();
    expect(cleared?.name).toBe('Mothers Day-15%OFF-MUM27');
  });
});

describe('campaigns through withBrand', () => {
  it('lists, fetches and updates a campaign in its own brand only', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const created = await insertCampaign(db, brandId, input(), ACTOR);

    expect((await listCampaigns(db, otherBrandId)).map((row) => row.id)).not.toContain(created.id);
    expect(await getCampaignById(db, otherBrandId, created.id)).toBeNull();
    expect(
      await updateCampaign(db, otherBrandId, created.id, { promotionalIdeas: 'leak' }, ACTOR),
    ).toBeNull();
    expect((await getCampaignById(db, brandId, created.id))?.promotionalIdeas).toBe(
      input().promotionalIdeas,
    );
  });

  it('stamps the actor on insert and orders the list newest edit first', async () => {
    const { db, brandId } = await seeded();

    const created = await insertCampaign(db, brandId, input(), ACTOR);
    const [newest] = await listCampaigns(db, brandId);

    expect(created.createdBy).toBe(ACTOR);
    expect(created.updatedBy).toBe(ACTOR);
    expect(created.brandId).toBe(brandId);
    expect(newest?.id).toBe(created.id);
  });
});
