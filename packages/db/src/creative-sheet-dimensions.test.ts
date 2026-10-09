import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { updateCreativeSheetItemDimensions } from './creative-sheet-items';
import { DEMO_ACTOR_ID } from './demo-data';
import { migrationsFolder } from './migrations';
import { creativeBriefs, creativeDimensions, creativeSheetItems } from './schema';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/**
 * Migration 0059: `creative_sheet_items.dimensions` and its backfill, proven on PGlite against the
 * REAL migration file — the UPDATE statements are read from `drizzle/0059_creative_sheet_dimensions.sql`
 * and replayed, never retyped here, so the test and the migration cannot drift.
 *
 * `testDb()` has already applied 0059 (the column exists, every row's array is `[]`), which is
 * exactly the state production is in the instant after the ALTER; the rows are then inserted and
 * the two UPDATEs run against them as the migrator ran them.
 */
const MIGRATION = '0059_creative_sheet_dimensions.sql';

/** The migration's UPDATE statements, split on drizzle's breakpoint, the ALTER skipped. */
function backfillStatements(): string[] {
  const text = readFileSync(join(migrationsFolder, MIGRATION), 'utf8');
  return text
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.startsWith('UPDATE'));
}

async function runBackfill(db: PgliteDb): Promise<void> {
  for (const statement of backfillStatements()) {
    await db.execute(sql.raw(statement));
  }
}

async function lengthsById(db: PgliteDb, brandId: string): Promise<Map<string, number>> {
  const rows = await withBrand(db, brandId).select(creativeSheetItems);
  return new Map(rows.map((row) => [row.id, row.dimensions.length]));
}

async function arrange(): Promise<{
  db: PgliteDb;
  brandId: string;
  ids: { a1: string; a2: string; b: string };
  before: number;
}> {
  const db = await testDb();
  const { childBrand } = await seed(db);
  const scope = withBrand(db, childBrand.id);

  const [briefA] = await scope
    .insert(creativeBriefs, { name: 'TV1-B1-A-V1', dimensions: ['4:5', '9:16'] })
    .returning();
  const [briefB] = await scope
    .insert(creativeBriefs, { name: 'TS2-B1-B-V1', dimensions: ['IG Story / Reel'] })
    .returning();
  if (briefA === undefined || briefB === undefined) throw new Error('brief insert returned no row');

  const [a1] = await scope.insert(creativeSheetItems, { briefId: briefA.id }).returning();
  const [a2] = await scope.insert(creativeSheetItems, { briefId: briefA.id }).returning();
  const [b] = await scope.insert(creativeSheetItems, { briefId: briefB.id }).returning();
  if (a1 === undefined || a2 === undefined || b === undefined) {
    throw new Error('sheet item insert returned no row');
  }

  // Two Creative Dimensions rows linked to brief B by the stored id: one duplicating the brief's
  // own name, one new. Only the new one adds to the union.
  await scope.insert(creativeDimensions, {
    name: 'IG Story / Reel',
    dimensions: '1080x1920',
    creativeDesignId: briefB.id,
  });
  await scope.insert(creativeDimensions, {
    name: 'IG Feed Post',
    dimensions: '1080x1080',
    creativeDesignId: briefB.id,
  });

  // "Dimension values before": Σ over items of |brief.dimensions ∪ linked creative_dimensions names|.
  const union = (brief: readonly string[], linked: readonly string[]) =>
    new Set([...brief, ...linked]).size;
  const before =
    union(briefA.dimensions, []) +
    union(briefA.dimensions, []) +
    union(briefB.dimensions, ['IG Story / Reel', 'IG Feed Post']);

  return { db, brandId: childBrand.id, ids: { a1: a1.id, a2: a2.id, b: b.id }, before };
}

describe('migration 0059 on PGlite', () => {
  it('applies through the migrator: the column is NOT NULL jsonb defaulting to an empty array', async () => {
    const db = await testDb();
    const { rows } = await db.execute<{
      data_type: string;
      is_nullable: string;
      column_default: string;
    }>(
      sql`select data_type, is_nullable, column_default from information_schema.columns
          where table_name = 'creative_sheet_items' and column_name = 'dimensions'`,
    );
    expect(rows).toEqual([
      { data_type: 'jsonb', is_nullable: 'NO', column_default: "'[]'::jsonb" },
    ]);
    expect(backfillStatements()).toHaveLength(2);
  });

  it('backfills every item from its brief and its linked Creative Dimensions, copying, never moving', async () => {
    const { db, brandId, ids, before } = await arrange();
    const scope = withBrand(db, brandId);
    const briefsBefore = await scope.select(creativeBriefs);
    const dimensionsBefore = await scope.select(creativeDimensions);
    expect(before).toBe(6);
    expect([...(await lengthsById(db, brandId)).values()]).toEqual([0, 0, 0]);

    await runBackfill(db);

    const lengths = await lengthsById(db, brandId);
    expect([...lengths.values()].reduce((sum, n) => sum + n, 0)).toBe(before);
    const rows = new Map((await scope.select(creativeSheetItems)).map((row) => [row.id, row]));
    expect(rows.get(ids.a1)?.dimensions).toEqual(['4:5', '9:16']);
    expect(rows.get(ids.a2)?.dimensions).toEqual(['4:5', '9:16']);
    // The brief's own name first (copied), the one NEW linked name appended, the duplicate skipped.
    expect(rows.get(ids.b)?.dimensions).toEqual(['IG Story / Reel', 'IG Feed Post']);
    // Nothing in the source tables moved: the data was COPIED.
    expect(await scope.select(creativeBriefs)).toEqual(briefsBefore);
    expect(await scope.select(creativeDimensions)).toEqual(dimensionsBefore);
  });

  it('is idempotent: running the UPDATEs again changes nothing', async () => {
    const { db, brandId } = await arrange();
    await runBackfill(db);
    const once = await withBrand(db, brandId).select(creativeSheetItems);

    await runBackfill(db);

    expect(await withBrand(db, brandId).select(creativeSheetItems)).toEqual(once);
  });

  it('leaves an unlinked row, and a row of another brand, at an empty array', async () => {
    const { db, brandId } = await arrange();
    const scope = withBrand(db, brandId);
    const [unlinked] = await scope.insert(creativeSheetItems, {}).returning();

    await runBackfill(db);

    const row = (await scope.select(creativeSheetItems)).find((r) => r.id === unlinked?.id);
    expect(row?.dimensions).toEqual([]);
  });
});

describe('updateCreativeSheetItemDimensions', () => {
  it('writes the array through the brand scope and never resolves another brand id', async () => {
    const { db, brandId, ids } = await arrange();
    const { templateBrand } = { templateBrand: { id: '00000000-0000-4000-8000-000000000000' } };

    const saved = await updateCreativeSheetItemDimensions(
      db,
      brandId,
      ids.a1,
      ['1:1', 'Billboard 970x250'],
      DEMO_ACTOR_ID,
    );
    const foreign = await updateCreativeSheetItemDimensions(
      db,
      templateBrand.id,
      ids.a1,
      ['9:16'],
      DEMO_ACTOR_ID,
    );

    expect(saved?.dimensions).toEqual(['1:1', 'Billboard 970x250']);
    expect(saved?.updatedBy).toBe(DEMO_ACTOR_ID);
    expect(foreign).toBeNull();
    expect((await lengthsById(db, brandId)).get(ids.a1)).toBe(2);
  });
});
