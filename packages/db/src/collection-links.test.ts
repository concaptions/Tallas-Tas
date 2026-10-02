import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getCollectionById, insertCollection, listCollections } from './collections';
import { angles, collections, copywriting } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/**
 * The angle↔collection and copywriting↔collection links have exactly ONE store: the columns
 * `collections.angle_id` and `collections.copywriting_id`.
 *
 * WHY THIS FILE EXISTS. The template-base audit
 * (`docs/audits/template-base-diff-2026-10-02.md`) reports the same two Airtable links twice and
 * reaches opposite verdicts: §1 and §4 call `Copywriting › Collection` and `Angles › Collection`
 * **MISSING**, while §9 maps their inverse sides — `(Internal) Collections › Ads Copywriting copy`
 * and `(Internal) Collections › Angles` — to these two columns and declares Collections "0 missing,
 * 0 extra". The base metadata settles it: the pairs are reciprocal (`Angles.Collection`
 * fldNoiIB7Wt2899R5 ↔ `Collections.Angles` fldyhctoyBzoilkJM, and `Copywriting.Collection`
 * fldcBR6KPyWH78h4r ↔ `Collections.Ads Copywriting copy` fldorCMW3TO42mGlv, each naming the other
 * as its `inverseLinkFieldId`). Two names for one relationship, already stored. §9 is right; §1 and
 * §4 are wrong. `docs/audits/template-base-diff-2026-10-02-corrections.md` records the correction.
 *
 * So these tests pin the decision rather than a new table: the FK columns are canonical, and the
 * `angle_collections` / `copywriting_collections` junctions that a first pass added as a second
 * store are withdrawn. Two stores for one Airtable link would have diverged silently — the
 * collections Server Action writes the FKs and nothing would have written the junctions.
 *
 * The two gaps that remain are deliberate and recorded, not asserted away: each column is a single
 * uuid where Airtable allows many (audit §9's many→one collapse), and `copywriting_id` carries no
 * Postgres FK constraint. Both are pinned below as the current truth so that changing either is a
 * visible decision. See `docs/decisions/data-loss-blockers-2026-10-02.md`.
 */

/** Table names present in the public schema, from `information_schema`. */
async function tableExists(db: PgliteDb, table: string): Promise<boolean> {
  const { rows } = await db.execute<{ count: number }>(
    sql`select count(*)::int as count from information_schema.tables
        where table_schema = 'public' and table_name = ${table}`,
  );
  return (rows[0]?.count ?? 0) > 0;
}

/** Column names of one table, sorted. */
async function columnNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ column_name: string }>(
    sql`select column_name from information_schema.columns
        where table_schema = 'public' and table_name = ${table}`,
  );
  return rows.map((row) => row.column_name).sort();
}

/** The seeded child brand's first angle, first copy and first collection. */
async function seeded() {
  const db = await testDb();
  const result = await seed(db);
  const [angle, copy, collection] = [result.angles[0], result.copy[0], result.collections[0]];
  if (angle === undefined || copy === undefined || collection === undefined) {
    throw new Error('seed returned no angle, copy or collection');
  }
  return { db, result, angle, copy, collection };
}

describe('the angle and copywriting links on collections', () => {
  it('stores both links as columns on collections, and no junction table shadows them', async () => {
    const db = await testDb();

    const columns = await columnNames(db, 'collections');
    expect(columns).toContain('angle_id');
    expect(columns).toContain('copywriting_id');

    // The withdrawn second store. A junction here would be the same Airtable relationship written
    // twice, which is the divergence this file exists to prevent.
    expect(await tableExists(db, 'angle_collections')).toBe(false);
    expect(await tableExists(db, 'copywriting_collections')).toBe(false);

    // The junctions that are NOT duplicates still stand: each is a link the template base carries
    // on one side only, with no column anywhere else.
    expect(await tableExists(db, 'concept_collections')).toBe(true);
    expect(await tableExists(db, 'angle_products')).toBe(true);
  });

  it('round-trips an angle and a copy through the collection query functions', async () => {
    const { db, result, angle, copy } = await seeded();
    const brandId = result.childBrand.id;

    const created = await insertCollection(
      db,
      brandId,
      { name: 'Autumn Launch', angleId: angle.id, copywritingId: copy.id },
      result.admin.id,
    );

    const read = await getCollectionById(db, brandId, created.id);
    expect(read?.angleId).toBe(angle.id);
    expect(read?.copywritingId).toBe(copy.id);
    // `getCollectionById` resolves the angle side to a name for the panel; the copy side has no
    // resolver in `packages/db`, which is why `collections/fields.ts` joins it in the app layer.
    expect(read?.angleName).toBe(angle.name);

    const listed = await listCollections(db, brandId);
    expect(listed.find((row) => row.id === created.id)?.angleId).toBe(angle.id);
  });

  it('keeps one brand out of another: a collection is only readable under its own brand', async () => {
    const { db, result, angle, copy } = await seeded();
    const childId = result.childBrand.id;
    const otherId = result.templateBrand.id;

    const mine = await insertCollection(
      db,
      childId,
      { name: 'Child Collection', angleId: angle.id, copywritingId: copy.id },
      result.admin.id,
    );

    const [otherAngle] = await db
      .insert(angles)
      .values({ brandId: otherId, name: 'Template Angle' })
      .returning();
    const [otherCopy] = await db.insert(copywriting).values({ brandId: otherId }).returning();
    if (otherAngle === undefined || otherCopy === undefined) {
      throw new Error('the second brand’s fixtures were not inserted');
    }
    const theirs = await insertCollection(
      db,
      otherId,
      { name: 'Template Collection', angleId: otherAngle.id, copywritingId: otherCopy.id },
      result.admin.id,
    );

    expect(await getCollectionById(db, otherId, mine.id)).toBeNull();
    expect(await getCollectionById(db, childId, theirs.id)).toBeNull();

    const childRows = await listCollections(db, childId);
    expect(childRows.map((row) => row.id)).toContain(mine.id);
    expect(childRows.map((row) => row.id)).not.toContain(theirs.id);
    expect(childRows.map((row) => row.angleId)).not.toContain(otherAngle.id);
  });

  it('pins the two known gaps: one angle per collection, and copywriting_id is unconstrained', async () => {
    const { db, result, angle, copy, collection } = await seeded();

    // GAP 1 — many→one. Airtable's `Angles` field is a multi-link; the column holds one id, so a
    // second angle replaces the first rather than joining it. Widening this to a junction is the
    // blocked step recorded in `docs/decisions/data-loss-blockers-2026-10-02.md`.
    const [secondAngle] = await db
      .insert(angles)
      .values({ brandId: result.childBrand.id, name: 'Second Angle' })
      .returning();
    if (secondAngle === undefined) throw new Error('the second angle was not inserted');

    await db
      .update(collections)
      .set({ angleId: angle.id })
      .where(eq(collections.id, collection.id));
    await db
      .update(collections)
      .set({ angleId: secondAngle.id })
      .where(eq(collections.id, collection.id));
    const [afterSecond] = await db
      .select({ angleId: collections.angleId })
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(afterSecond?.angleId).toBe(secondAngle.id);

    // GAP 2 — `angle_id` references `angles`, so an unknown id is refused...
    const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
    await expect(
      db.update(collections).set({ angleId: UNKNOWN_ID }).where(eq(collections.id, collection.id)),
    ).rejects.toThrow();

    // ...but `copywriting_id` is a bare uuid with no `references()`, so an unknown id is accepted.
    // Asserted as the current truth: adding the constraint is DDL on a table with production rows.
    await db
      .update(collections)
      .set({ copywritingId: UNKNOWN_ID })
      .where(eq(collections.id, collection.id));
    const [afterUnknown] = await db
      .select({ copywritingId: collections.copywritingId })
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(afterUnknown?.copywritingId).toBe(UNKNOWN_ID);

    // A real copy id of course still stores.
    await db
      .update(collections)
      .set({ copywritingId: copy.id })
      .where(eq(collections.id, collection.id));
    const [afterReal] = await db
      .select({ copywritingId: collections.copywritingId })
      .from(collections)
      .where(eq(collections.id, collection.id));
    expect(afterReal?.copywritingId).toBe(copy.id);
  });
});
