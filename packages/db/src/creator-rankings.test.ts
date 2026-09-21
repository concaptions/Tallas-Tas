import { describe, expect, it } from 'vitest';

import { insertCreatorRanking, listCreatorRankings } from './creator-rankings';
import { DEMO_BRAND_ID, demoCreatorRankings } from './demo-data';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('creator ranking queries', () => {
  it('seeds and lists rankings sorted by rank', async () => {
    const { db, brandId } = await seeded();
    expect(brandId).toBe(DEMO_BRAND_ID);
    const rows = await listCreatorRankings(db, brandId);
    expect(rows).toHaveLength(demoCreatorRankings.length);
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (prev === undefined || curr === undefined) throw new Error('unreachable');
      expect(prev.rank).toBeLessThanOrEqual(curr.rank);
    }
  });

  it('inserts a new ranking', async () => {
    const { db, brandId } = await seeded();
    const first = demoCreatorRankings[0];
    if (first === undefined) throw new Error('no demo rankings');
    const ranking = await insertCreatorRanking(
      db,
      brandId,
      {
        creatorId: first.creatorId,
        creatorName: 'Test Creator',
        totalAds: 2,
        totalSpend: '500.00',
        totalConversions: 25,
        avgRoas: '4.00',
        avgCpa: '20.00',
        rank: 4,
        periodLabel: 'Oct 2026',
      },
      'actor_test',
    );
    expect(ranking.creatorName).toBe('Test Creator');
  });

  it('cross-brand isolation', async () => {
    const { db, otherBrandId } = await seeded();
    const rows = await listCreatorRankings(db, otherBrandId);
    expect(rows).toHaveLength(0);
  });
});
