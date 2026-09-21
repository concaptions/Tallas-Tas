import { describe, expect, it } from 'vitest';

import { insertAdMetric, listAdMetrics, listConceptMetrics } from './ad-metrics';
import { DEMO_BRAND_ID, demoAdMetrics } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('ad metric queries', () => {
  it('seeds demo metrics and lists them', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listAdMetrics(db, brandId);
    expect(rows).toHaveLength(demoAdMetrics.length);
  });

  it('lists metrics scoped to a concept', async () => {
    const { db, brandId } = await seeded();
    const linked = demoAdMetrics.filter(
      (a): a is typeof a & { conceptId: string } => a.conceptId !== null,
    );
    if (linked[0] === undefined) throw new Error('no linked metrics');
    const rows = await listConceptMetrics(db, brandId, linked[0].conceptId);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.conceptId).toBe(linked[0].conceptId);
    }
  });

  it('inserts a new metric and retrieves it', async () => {
    const { db, brandId } = await seeded();
    const metric = await insertAdMetric(
      db,
      brandId,
      {
        briefId: null,
        conceptId: null,
        metaAdId: '99990001',
        adName: 'TEST-AD-v1',
        spend: '100.00',
        impressions: 5000,
        clicks: 200,
        conversions: 10,
        ctr: '0.0400',
        cpc: '0.50',
        cpa: '10.00',
        roas: '3.00',
        dateRange: '2026-09-01 to 2026-09-07',
      },
      'actor_test',
    );
    expect(metric.adName).toBe('TEST-AD-v1');
    const all = await listAdMetrics(db, brandId);
    expect(all.find((r) => r.id === metric.id)).toBeDefined();
  });

  it('cross-brand isolation: another brand sees no metrics', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listAdMetrics(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
