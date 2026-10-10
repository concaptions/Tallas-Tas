import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  listBrandCustomPages,
  listMergedPages,
  listTemplateCustomPages,
  loadCustomPageRender,
} from '../custom-interface-pages';
import { brands, creators } from '../schema';
import { seed } from '../seed';
import { testDb } from '../testing';
import { PARTNERSHIP_PAGE_SLUG, seedPartnershipPage } from './seed-partnership-page';

/** Partnership Ads Tracking (B5): one hidden template module page, switched on for Gratsi alone. */
async function scenario() {
  const db = await testDb();
  const { childBrand } = await seed(db);
  // The demo seed already carries Gratsi (the one client running partnership ads today).
  const [gratsi] = await db.select().from(brands).where(eq(brands.slug, 'gratsi')).limit(1);
  if (!gratsi) throw new Error('seed gratsi');
  await db.insert(creators).values([
    {
      brandId: gratsi.id,
      name: 'Ana',
      forPartnershipAds: true,
      partnershipActivity: 'Active',
      creatorCost: 1200,
    },
    { brandId: gratsi.id, name: 'Ben', forPartnershipAds: false },
  ]);
  return { db, gratsi, other: childBrand };
}

describe('seedPartnershipPage', () => {
  it('seeds the template module page hidden, and a visible Gratsi row tracking it — idempotently', async () => {
    const { db, gratsi } = await scenario();

    const first = await seedPartnershipPage(db);
    const second = await seedPartnershipPage(db);

    expect(first.templateInserted).toBe(true);
    expect(second).toEqual({ ...first, templateInserted: false });
    const template = (await listTemplateCustomPages(db)).find(
      (p) => p.slug === PARTNERSHIP_PAGE_SLUG,
    );
    expect(template).toMatchObject({
      pageKind: 'module',
      moduleKey: 'partnership_ads',
      isVisible: false,
    });
    expect(template?.columnConfig.map((c) => c.columnKey)).not.toContain(
      'partnership_price_per_30_days',
    );
    const gratsiRows = await listBrandCustomPages(db, gratsi.id);
    expect(gratsiRows).toHaveLength(1);
    expect(gratsiRows[0]).toMatchObject({
      slug: PARTNERSHIP_PAGE_SLUG,
      isVisible: true,
      templateRowId: template?.id,
      overriddenFields: ['is_visible'],
    });
  });

  it("shows the page in Gratsi's nav and not in another brand's", async () => {
    const { db, gratsi, other } = await scenario();
    await seedPartnershipPage(db);
    const visibleFor = async (brandId: string) =>
      (await listMergedPages(db, brandId)).filter((p) => p.isVisible).map((p) => p.slug);
    expect(await visibleFor(gratsi.id)).toEqual([PARTNERSHIP_PAGE_SLUG]);
    expect(await visibleFor(other.id)).toEqual([]);
  });

  it('renders only partnership creators, with client-safe columns', async () => {
    const { db, gratsi } = await scenario();
    await seedPartnershipPage(db);

    const render = await loadCustomPageRender(db, gratsi.id, PARTNERSHIP_PAGE_SLUG);
    // The route applies the page's filter (`rowMatchesFilter`, pinned in the domain); here the
    // same rule is spelled out: a boolean cell reads as 'true' / 'false'.
    expect(render?.page.filterConfig).toEqual({
      column: 'for_partnership_ads',
      op: 'is',
      value: 'true',
    });
    const rows = (render?.rows ?? []).filter(
      (row) => String(row['for_partnership_ads']) === 'true',
    );

    expect(rows.map((row) => row['name'])).toEqual(['Ana']);
    expect(rows[0]).not.toHaveProperty('creator_cost');
    expect(rows[0]).not.toHaveProperty('partnership_price_per_30_days');
    expect(rows[0]).toHaveProperty('partnership_activity', 'Active');
  });

  it('seeds the template row and reports when Gratsi does not exist', async () => {
    const db = await testDb();
    const result = await seedPartnershipPage(db);
    expect(result.gratsiBrandId).toBeNull();
    expect(result.gratsiEnabled).toBe(false);
    expect((await listTemplateCustomPages(db)).map((p) => p.slug)).toEqual([PARTNERSHIP_PAGE_SLUG]);
  });
});
