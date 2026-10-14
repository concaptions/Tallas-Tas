import { describe, expect, it } from 'vitest';

import {
  insertRegistryCreator,
  listRegistryCreatorBrandHistory,
  listRegistryCreators,
} from './creator-registry-queries';
import { insertCreator } from './creators';
import { seed } from './seed';
import { testDb } from './testing';

const ACTOR = 'user_tester';

/**
 * Oct 14 pre-Thursday QA (item 47): the Creator Pool card and the per-brand creator detail panel
 * read brand counts off two different sources. The card used to read `creator_registry.total_brands`,
 * a cached column, while the panel reads `creators` joined to `brands` where `registry_creator_id`
 * matches and `deleted_at IS NULL`. Those two disagree the moment the cache falls behind an insert
 * or soft-delete -- which is how Talal saw "5 brands" on the card and "No brand history yet" on
 * the panel at the same time.
 *
 * The fix makes `listRegistryCreators` compute `totalBrands` LIVE from the same join the panel
 * reads, so both report the same number. This test seeds a registry creator with three brand
 * entries and asserts both sides read 3 -- card parity with detail panel over the same shape of
 * data a production row has.
 */
describe('listRegistryCreators brand-count parity (Oct 14 pre-Thursday QA #47)', () => {
  it('reports totalBrands as the live join count, matching listRegistryCreatorBrandHistory', async () => {
    const db = await testDb();
    const { childBrand, rosterBrands } = await seed(db);
    const [secondBrand, thirdBrand] = rosterBrands;
    if (secondBrand === undefined || thirdBrand === undefined) {
      throw new Error('seed roster is missing a brand for the three-brand test');
    }
    const brandIds = [childBrand.id, secondBrand.id, thirdBrand.id] as const;

    const registry = await insertRegistryCreator(db, { name: 'Three-brand creator' });
    for (const brandId of brandIds) {
      await insertCreator(
        db,
        brandId,
        { name: 'Three-brand creator', registryCreatorId: registry.id },
        ACTOR,
      );
    }

    const list = await listRegistryCreators(db);
    const row = list.find((entry) => entry.id === registry.id);
    expect(row?.totalBrands, 'the Creator Pool card source reads 3 brands').toBe(3);

    const history = await listRegistryCreatorBrandHistory(db, registry.id);
    expect(history, 'the detail panel source returns 3 brand rows').toHaveLength(3);
  });
});
