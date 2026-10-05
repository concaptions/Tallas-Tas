import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { setCollectionCopywritingLinkInBrand } from './collections';
import { collections, copywriting } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

/**
 * `setCollectionCopywritingLinkInBrand` is the Oct 5 Linked Collection write path
 * (`docs/decisions.md` 2026-10-05): one collection per copy, written on the owner side
 * (`collections.copywriting_id`). The function reassigns: clearing any existing holder of a copy's
 * id and setting the new one, inside the brand scope. These tests prove the three semantics the
 * action depends on — pick, unlink, cross-brand refusal.
 */
const ACTOR = 'user_2TESTACTOR';

describe('setCollectionCopywritingLinkInBrand on PGlite', () => {
  it('sets the owner-side FK on the chosen collection, inside the brand', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    const brandId = childBrand.id;

    // Pick any two collections and any copy seeded for this brand.
    const [targetCollection] = await db
      .select()
      .from(collections)
      .where(eq(collections.brandId, brandId))
      .limit(1);
    if (targetCollection === undefined) throw new Error('seed has no collection');
    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.brandId, brandId))
      .limit(1);
    if (copy === undefined) throw new Error('seed has no copy');

    const ok = await setCollectionCopywritingLinkInBrand(
      db,
      brandId,
      copy.id,
      targetCollection.id,
      ACTOR,
    );

    expect(ok).toBe(true);
    const [after] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, targetCollection.id));
    expect(after?.copywritingId).toBe(copy.id);
  });

  it('reassigns: a second pick clears the first collection and sets the second', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    const brandId = childBrand.id;

    const [first, second] = await db
      .select()
      .from(collections)
      .where(eq(collections.brandId, brandId));
    if (first === undefined || second === undefined) {
      throw new Error('seed needs two collections to prove reassignment');
    }
    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.brandId, brandId))
      .limit(1);
    if (copy === undefined) throw new Error('seed has no copy');

    await setCollectionCopywritingLinkInBrand(db, brandId, copy.id, first.id, ACTOR);
    await setCollectionCopywritingLinkInBrand(db, brandId, copy.id, second.id, ACTOR);

    const rows = await db.select().from(collections).where(eq(collections.brandId, brandId));
    const firstAfter = rows.find((row) => row.id === first.id);
    const secondAfter = rows.find((row) => row.id === second.id);
    expect(firstAfter?.copywritingId).toBeNull();
    expect(secondAfter?.copywritingId).toBe(copy.id);
  });

  it('unlinks every collection pointing at this copy when the pick is null', async () => {
    const db = await testDb();
    const { childBrand } = await seed(db);
    const brandId = childBrand.id;

    const [first] = await db
      .select()
      .from(collections)
      .where(eq(collections.brandId, brandId))
      .limit(1);
    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.brandId, brandId))
      .limit(1);
    if (first === undefined || copy === undefined) throw new Error('seed is missing a fixture');

    await setCollectionCopywritingLinkInBrand(db, brandId, copy.id, first.id, ACTOR);
    await setCollectionCopywritingLinkInBrand(db, brandId, copy.id, null, ACTOR);

    const [after] = await db.select().from(collections).where(eq(collections.id, first.id));
    expect(after?.copywritingId).toBeNull();
  });

  it('returns false and changes nothing when the collection belongs to another brand', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);
    const brandId = childBrand.id;
    // The template brand gets no fixtures from `seed`, so insert one directly: a cross-brand id
    // must never match the owner-side setter's scoped where clause.
    const [foreign] = await db
      .insert(collections)
      .values({
        brandId: templateBrand.id,
        name: 'Template Collection — not the child brand',
      })
      .returning();
    const [copy] = await db
      .select()
      .from(copywriting)
      .where(eq(copywriting.brandId, brandId))
      .limit(1);
    if (foreign === undefined || copy === undefined) {
      throw new Error('setup needs a template collection and a child copy');
    }

    const ok = await setCollectionCopywritingLinkInBrand(db, brandId, copy.id, foreign.id, ACTOR);

    expect(ok).toBe(false);
    const [after] = await db.select().from(collections).where(eq(collections.id, foreign.id));
    expect(after?.copywritingId).toBeNull();
  });
});
