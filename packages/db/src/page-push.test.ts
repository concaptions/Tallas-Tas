import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { insertCustomPage, listBrandCustomPages } from './custom-interface-pages';
import { applyApprovedPromotion, setPromotionRequestStatus } from './promotion-requests';
import { createPromotionRequest, listChildBrands } from './propagation';
import { propagationRuns } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * A template page push through the review queue (B3, 2026-10-10): the request is template-side,
 * approval runs the one page propagation under a `propagation_runs` row, rejection runs nothing.
 */
async function pushScenario(): Promise<{
  db: PgliteDb;
  agencyId: string;
  templateId: string;
  childId: string;
  requestId: string;
}> {
  const db = await testDb();
  const { agency, templateBrand, childBrand } = await seed(db);
  const page = await insertCustomPage(db, {
    brandId: null,
    slug: 'partnership-ads',
    title: 'Partnership Ads Tracking',
    sourceTableKey: 'creators',
    filterConfig: { column: 'for_partnership_ads', op: 'is', value: 'true' },
    columnConfig: [{ columnKey: 'name', displayLabel: 'Creator', displayOrder: 0 }],
    sortOrder: 20,
    isVisible: false,
    isInherited: true,
    createdBy: 'admin',
    updatedBy: 'admin',
  });
  const request = await createPromotionRequest(
    db,
    {
      brandId: templateBrand.id,
      tableName: 'custom_interface_pages',
      rowId: page.id,
      fieldName: 'push',
      currentValue: 'template',
      proposedValue: JSON.stringify({ slug: page.slug, title: page.title }),
      requestedBy: 'admin',
    },
    'admin',
  );
  return {
    db,
    agencyId: agency.id,
    templateId: templateBrand.id,
    childId: childBrand.id,
    requestId: request.id,
  };
}

describe('a template page push through the review queue', () => {
  it('approve propagates the page to every child and writes one propagation_runs row', async () => {
    const { db, agencyId, templateId, childId, requestId } = await pushScenario();

    await setPromotionRequestStatus(db, agencyId, requestId, 'approved', 'admin', null);
    const result = await applyApprovedPromotion(db, agencyId, requestId, 'admin');

    // Every live child of the template (the seed has several), each with a fresh inherited row.
    const children = await listChildBrands(db, templateId);
    expect(children.length).toBeGreaterThan(0);
    expect(result).toEqual({ applied: true, childrenUpdated: children.length });
    const childPages = await listBrandCustomPages(db, childId);
    expect(childPages.map((row) => [row.slug, row.isInherited])).toEqual([
      ['partnership-ads', true],
    ]);
    const runs = await db
      .select()
      .from(propagationRuns)
      .where(eq(propagationRuns.templateBrandId, templateId));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      tableName: 'custom_interface_pages',
      trigger: 'interface',
      childrenUpdated: children.length,
      skipped: 0,
    });
  });

  it('reject propagates nothing and writes no run', async () => {
    const { db, agencyId, templateId, childId, requestId } = await pushScenario();

    await setPromotionRequestStatus(db, agencyId, requestId, 'rejected', 'admin', 'Not yet.');
    const result = await applyApprovedPromotion(db, agencyId, requestId, 'admin');

    expect(result.applied).toBe(false);
    expect(await listBrandCustomPages(db, childId)).toEqual([]);
    const runs = await db
      .select()
      .from(propagationRuns)
      .where(eq(propagationRuns.templateBrandId, templateId));
    expect(runs).toEqual([]);
  });

  it('a pending request is not applied either', async () => {
    const { db, agencyId, childId, requestId } = await pushScenario();
    const result = await applyApprovedPromotion(db, agencyId, requestId, 'admin');
    expect(result.applied).toBe(false);
    expect(await listBrandCustomPages(db, childId)).toEqual([]);
  });
});
