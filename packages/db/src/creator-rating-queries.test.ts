import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  getRegistryAvgRating,
  loadCreatorPerformanceHistory,
  updateCreatorPerformanceRating,
} from './creator-rating-queries';
import { insertRegistryCreator } from './creator-registry-queries';
import { insertCreator } from './creators';
import { creators } from './schema';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb } from './testing';

const ACTOR = 'user_rater';

/** One registry entry linked from a creator in each of the two seeded brands. */
async function linkedPair() {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  const registry = await insertRegistryCreator(db, { name: 'Pool person' });
  const link = { name: 'Pool person', registryCreatorId: registry.id };
  const a = await insertCreator(db, childBrand.id, link, ACTOR);
  const b = await insertCreator(db, templateBrand.id, link, ACTOR);
  return { db, registryId: registry.id, brandA: childBrand.id, brandB: templateBrand.id, a, b };
}

describe('updateCreatorPerformanceRating', () => {
  it('stores the rating, note, actor and moment on the brand row', async () => {
    const { db, brandA, a } = await linkedPair();
    const now = new Date('2026-10-08T12:00:00Z');

    const row = await updateCreatorPerformanceRating(
      db,
      brandA,
      a.id,
      4,
      'quick turnaround',
      ACTOR,
      now,
    );

    expect(row).toMatchObject({
      performanceRating: 4,
      performanceNote: 'quick turnaround',
      performanceRatedAt: now,
      performanceRatedBy: ACTOR,
      updatedBy: ACTOR,
    });
  });

  it('is scoped to the brand: another brand cannot rate this brand’s row', async () => {
    const { db, brandA, brandB, a } = await linkedPair();

    expect(await updateCreatorPerformanceRating(db, brandB, a.id, 1, null, ACTOR)).toBeNull();
    const [untouched] = await withBrand(db, brandA).select(creators, eq(creators.id, a.id));
    expect(untouched?.performanceRating).toBeNull();
  });

  it('lets Postgres refuse a rating outside 1..5, so a bad write never lands', async () => {
    const { db, brandA, a } = await linkedPair();

    await expect(
      updateCreatorPerformanceRating(db, brandA, a.id, 6, null, ACTOR),
    ).rejects.toThrow();
    await expect(
      updateCreatorPerformanceRating(db, brandA, a.id, 0, null, ACTOR),
    ).rejects.toThrow();
  });
});

describe('the registry roll-up (trigger from migration 0056)', () => {
  it('starts null and follows each per-brand rating, rounding half up', async () => {
    const { db, registryId, brandA, brandB, a, b } = await linkedPair();
    expect(await getRegistryAvgRating(db, registryId)).toBeNull();

    await updateCreatorPerformanceRating(db, brandA, a.id, 4, null, ACTOR);
    expect(await getRegistryAvgRating(db, registryId)).toBe(4);

    await updateCreatorPerformanceRating(db, brandB, b.id, 5, null, ACTOR);
    expect(await getRegistryAvgRating(db, registryId)).toBe(5);

    await updateCreatorPerformanceRating(db, brandB, b.id, 1, null, ACTOR);
    expect(await getRegistryAvgRating(db, registryId)).toBe(3);
  });

  it('drops a soft-deleted brand row out of the average', async () => {
    const { db, registryId, brandA, brandB, a, b } = await linkedPair();
    await updateCreatorPerformanceRating(db, brandA, a.id, 2, null, ACTOR);
    await updateCreatorPerformanceRating(db, brandB, b.id, 5, null, ACTOR);
    expect(await getRegistryAvgRating(db, registryId)).toBe(4);

    await withBrand(db, brandB).softDelete(creators, eq(creators.id, b.id));

    expect(await getRegistryAvgRating(db, registryId)).toBe(2);
  });

  it('moves with the link when a brand row is re-pointed at another registry entry', async () => {
    const { db, registryId, brandA, a } = await linkedPair();
    const other = await insertRegistryCreator(db, { name: 'Someone else' });
    await updateCreatorPerformanceRating(db, brandA, a.id, 3, null, ACTOR);

    await withBrand(db, brandA).update(
      creators,
      { registryCreatorId: other.id },
      eq(creators.id, a.id),
    );

    expect(await getRegistryAvgRating(db, registryId)).toBeNull();
    expect(await getRegistryAvgRating(db, other.id)).toBe(3);
  });
});

describe('loadCreatorPerformanceHistory', () => {
  it('lists every live linked brand by name, rated or not, and skips soft-deleted rows', async () => {
    const { db, registryId, brandA, brandB, a, b } = await linkedPair();
    await updateCreatorPerformanceRating(db, brandA, a.id, 5, 'star of the batch', ACTOR);

    const history = await loadCreatorPerformanceHistory(db, registryId);

    expect(history.map((row) => row.brandId).sort()).toEqual([brandA, brandB].sort());
    const rated = history.find((row) => row.creatorId === a.id);
    const unrated = history.find((row) => row.creatorId === b.id);
    expect(rated).toMatchObject({ rating: 5, note: 'star of the batch', ratedBy: ACTOR });
    expect(rated?.ratedAt).toBeInstanceOf(Date);
    expect(unrated).toMatchObject({ rating: null, note: null, ratedAt: null, ratedBy: null });
    expect(history.every((row) => row.brandName.length > 0)).toBe(true);

    await withBrand(db, brandB).softDelete(creators, eq(creators.id, b.id));
    expect(
      (await loadCreatorPerformanceHistory(db, registryId)).map((row) => row.creatorId),
    ).toEqual([a.id]);
  });
});
