import { describe, expect, it } from 'vitest';

import { getCompetitorAdById, insertCompetitorAd, listCompetitorAds } from './competitor-ads';
import { DEMO_BRAND_ID, demoCompetitorAds } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('competitor ad queries', () => {
  it('seeds and lists competitor ads', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listCompetitorAds(db, brandId);
    expect(rows).toHaveLength(demoCompetitorAds.length);
  });

  it('gets a single ad by id', async () => {
    const { db, brandId } = await seeded();
    const first = demoCompetitorAds[0];
    if (first === undefined) throw new Error('no demo competitor ads');
    const row = await getCompetitorAdById(db, brandId, first.id);
    expect(row).not.toBeNull();
    if (row === null) throw new Error('unreachable');
    expect(row.advertiserName).toBe(first.advertiserName);
  });

  it('inserts a new competitor ad', async () => {
    const { db, brandId } = await seeded();
    const ad = await insertCompetitorAd(
      db,
      brandId,
      {
        platform: 'meta',
        advertiserName: 'Test Brand',
        adUrl: 'https://example.com/ad/1',
        headline: 'Test headline',
        bodyText: null,
        format: 'video',
        estimatedSpend: null,
        daysActive: 7,
        firstSeen: '2026-09-01',
        lastSeen: null,
        notes: null,
      },
      'actor_test',
    );
    expect(ad.advertiserName).toBe('Test Brand');
  });

  it('cross-brand isolation', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listCompetitorAds(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
