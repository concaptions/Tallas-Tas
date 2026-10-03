import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCreativeSheetItemById,
  insertCreativeSheetItem,
  listCreativeSheetItems,
  updateCreativeSheetItem,
  type CreativeSheetItemInput,
  type CreativeSheetItemListRow,
} from './creative-sheet-items';
import { DEMO_BRAND_ID, demoBriefs } from './demo-data';
import { demoCreativeSheetItems } from './demo-creative-sheet-items';
import { creativeBriefs, creativeSheetItems, type CreativeSheetItem } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';
import { creativeSheetName } from './formulas';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The fixture's derived keys: `brandId` (the scope's) plus everything `withBrief` computes. */
type Derived =
  | 'brandId'
  | 'name'
  | 'briefName'
  | 'briefType'
  | 'briefPlatform'
  | 'briefFunnel'
  | 'briefPerformance'
  | 'briefDesignFileUrl';

/** A fixture reduced to the columns the table stores, the way `seed.ts`'s `scoped` strips a row. */
function storedColumns(row: CreativeSheetItemListRow): Omit<CreativeSheetItemListRow, Derived> {
  const rest: Record<string, unknown> = { ...row };
  delete rest['brandId'];
  delete rest['name'];
  delete rest['briefName'];
  delete rest['briefType'];
  delete rest['briefPlatform'];
  delete rest['briefFunnel'];
  delete rest['briefPerformance'];
  delete rest['briefDesignFileUrl'];
  return rest as Omit<CreativeSheetItemListRow, Derived>;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{
  db: PgliteDb;
  brandId: string;
  otherBrandId: string;
  briefId: string;
}> {
  const db = await testDb();
  const { childBrand, templateBrand, briefs } = await seed(db);
  const [brief] = briefs;
  if (brief === undefined) throw new Error('seed produced no briefs');
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id, briefId: brief.id };
}

describe('creative_sheet_items migration on PGlite', () => {
  it('creates the table with its brand, template-row and brief indexes', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'creative_sheet_items')).toEqual([
      'creative_sheet_items_brand_id_idx',
      'creative_sheet_items_brief_id_idx',
      'creative_sheet_items_pkey',
      'creative_sheet_items_template_row_id_idx',
    ]);
  });

  it('inserts and reads a sheet row through withBrand, invisible to another brand', async () => {
    const db = await testDb();
    const { childBrand, templateBrand, briefs } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [item] = await scope
      .insert(creativeSheetItems, {
        briefId: briefs[0]?.id,
        internalStatus: 'ad_submitted',
        status: 'pending_for_approval',
        clientComments: 'Tighten the first three seconds.',
        used: true,
      })
      .returning();
    const [standalone] = await scope.insert(creativeSheetItems, {}).returning();

    expect(item).toEqual(
      expect.objectContaining({
        brandId: childBrand.id,
        briefId: briefs[0]?.id,
        internalStatus: 'ad_submitted',
        status: 'pending_for_approval',
        clientComments: 'Tighten the first three seconds.',
        used: true,
        qaVideoEditor: false,
        qaDesigner: false,
        qaStrategist: false,
        deniedRevisionsNeeded: false,
        spellCheckRequested: false,
        winning: null,
      }),
    );
    // No stored name: Airtable's "Name" formula is computed from created_at + the brief's name.
    expect(item).not.toHaveProperty('name');
    // The "Creative Name" link is nullable, like creative_briefs.concept_id.
    expect(standalone?.briefId).toBeNull();
    expect((await scope.select(creativeSheetItems)).map((row) => row.id).sort()).toEqual(
      [item?.id, standalone?.id].sort(),
    );
    expect(await withBrand(db, templateBrand.id).select(creativeSheetItems)).toEqual([]);
  });
});

describe('creativeSheetItemName', () => {
  it('is the UTC month of created_at, a hyphen and the brief name — the Airtable formula', () => {
    expect(creativeSheetName(new Date('2026-10-01T08:00:00.000Z'), 'TV1-B1-Unboxing-V3')).toBe(
      'October-TV1-B1-Unboxing-V3',
    );
    expect(creativeSheetName(new Date('2026-09-30T23:59:00.000Z'), 'RS1-B4-V3')).toBe(
      'September-RS1-B4-V3',
    );
  });

  it('names a row with no brief by its month alone, never with a dangling separator', () => {
    /*
     * The TRAILING HYPHEN is Airtable's answer, and the ruling is to mirror Airtable: its formula is
     * `DATETIME_FORMAT({Created},"MMMM") & "-" & {Creative Name}`, and `&` concatenates an absent
     * value as an empty string. The deleted `creativeSheetItemName` dropped the separator as a
     * tidiness, which made two readings of one record disagree — the bug class the formulas module
     * exists to prevent.
     */
    expect(creativeSheetName(new Date('2026-10-01T07:00:00.000Z'), null)).toBe('October-');
    expect(creativeSheetName(new Date('2026-01-15T12:00:00.000Z'), '')).toBe('January-');
  });
});

describe('creative sheet queries', () => {
  it('lists a brand’s rows newest edit first, named and joined to their briefs', async () => {
    const { db, brandId, briefId } = await seeded();
    const brief = demoBriefs.find((row) => row.id === briefId);
    if (brief === undefined) throw new Error('seeded brief is not a fixture');

    const linked = await insertCreativeSheetItem(
      db,
      brandId,
      { briefId, internalStatus: 'approved', status: 'pending_for_approval', used: true },
      'user_test',
    );
    const standalone = await insertCreativeSheetItem(db, brandId, {}, 'user_test');

    const rows = await listCreativeSheetItems(db, brandId);

    expect(rows.map((row) => row.id)).toEqual([standalone.id, linked.id]);
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));

    const [first, second] = rows;
    expect(second).toMatchObject({
      name: creativeSheetName(linked.createdAt, brief.name),
      briefName: brief.name,
      briefType: brief.type,
      briefPlatform: brief.platform,
      briefFunnel: brief.funnel,
      briefPerformance: brief.performance,
      briefDesignFileUrl: brief.designFileUrl,
    });
    expect(second?.name.endsWith(`-${brief.name}`)).toBe(true);
    // A row with no brief inherits nothing and is named by its month alone.
    expect(first).toMatchObject({
      name: creativeSheetName(standalone.createdAt, null),
      briefName: null,
      briefType: null,
      briefPlatform: [],
      briefFunnel: null,
      briefPerformance: null,
      briefDesignFileUrl: null,
    });
  });

  it('inherits nothing from a brief that is soft-deleted, exactly as from no brief', async () => {
    const { db, brandId, briefId } = await seeded();
    const row = await insertCreativeSheetItem(db, brandId, { briefId }, 'user_test');

    expect((await getCreativeSheetItemById(db, brandId, row.id))?.briefName).not.toBeNull();

    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(sql`${creativeBriefs.id} = ${briefId}`);

    const gone = await getCreativeSheetItemById(db, brandId, row.id);
    expect(gone?.briefId).toBe(briefId);
    expect(gone?.briefName).toBeNull();
    expect(gone?.name).toBe(creativeSheetName(row.createdAt, null));
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId, briefId } = await seeded();
    const row = await insertCreativeSheetItem(db, brandId, { briefId }, 'user_test');

    expect(await listCreativeSheetItems(db, otherBrandId)).toEqual([]);
    expect(await getCreativeSheetItemById(db, otherBrandId, row.id)).toBeNull();

    await db
      .update(creativeSheetItems)
      .set({ deletedAt: new Date() })
      .where(sql`${creativeSheetItems.id} = ${row.id}`);

    expect(await listCreativeSheetItems(db, brandId)).toEqual([]);
    expect(await getCreativeSheetItemById(db, brandId, row.id)).toBeNull();
  });

  it('insertCreativeSheetItem forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      clientComments: 'Smuggled row',
      brandId: otherBrandId,
    } as unknown as CreativeSheetItemInput;

    const row = await insertCreativeSheetItem(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      clientComments: 'Smuggled row',
      briefId: null,
      winning: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listCreativeSheetItems(db, brandId)).toHaveLength(1);
    expect(await listCreativeSheetItems(db, otherBrandId)).toEqual([]);
  });

  it('updateCreativeSheetItem cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId, briefId } = await seeded();
    const row = await insertCreativeSheetItem(db, brandId, { briefId }, 'user_test');

    const escaped = await updateCreativeSheetItem(
      db,
      otherBrandId,
      row.id,
      { status: 'denied' },
      'thief',
    );
    const own = await updateCreativeSheetItem(
      db,
      brandId,
      row.id,
      {
        status: 'approved',
        winning: 'best_performing',
        qaStrategist: true,
        qaChecklistDoc: ['https://docs.example/qa'],
      },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: row.id,
      brandId,
      briefId,
      status: 'approved',
      winning: 'best_performing',
      qaStrategist: true,
      qaChecklistDoc: ['https://docs.example/qa'],
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCreativeSheetItems).toEqualTypeOf<CreativeSheetItemListRow[]>();
    expectTypeOf(await listCreativeSheetItems(db, brandId)).toEqualTypeOf<
      CreativeSheetItemListRow[]
    >();
    expectTypeOf<CreativeSheetItemListRow>().toExtend<CreativeSheetItem>();
    expectTypeOf<CreativeSheetItemListRow['name']>().toEqualTypeOf<string>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<CreativeSheetItemInput>().not.toHaveProperty('brandId');
    expectTypeOf<CreativeSheetItemInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CreativeSheetItemInput>().toHaveProperty('briefId');
  });
});

describe('demoCreativeSheetItems', () => {
  it('belong to the demo brand, carry distinct ids and sit newest edit first', () => {
    expect(demoCreativeSheetItems).toHaveLength(5);
    expect(demoCreativeSheetItems.every((row) => row.brandId === DEMO_BRAND_ID)).toBe(true);
    expect(new Set(demoCreativeSheetItems.map((row) => row.id)).size).toBe(5);
    const updated = demoCreativeSheetItems.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('are named by the formula and read every brief field from the brief fixture', () => {
    for (const row of demoCreativeSheetItems) {
      expect(row.name).toBe(creativeSheetName(row.createdAt, row.briefName));
      const brief = demoBriefs.find((candidate) => candidate.id === row.briefId);
      if (row.briefId === null) {
        expect(row.briefName).toBeNull();
        expect(row.briefPlatform).toEqual([]);
        continue;
      }
      expect(brief).toBeDefined();
      expect(row).toMatchObject({
        briefName: brief?.name,
        briefType: brief?.type,
        briefPlatform: brief?.platform,
        briefFunnel: brief?.funnel,
        briefPerformance: brief?.performance,
        briefDesignFileUrl: brief?.designFileUrl,
      });
    }
    // Both month prefixes are on screen, and the unlinked row is its month plus the separator
    // Airtable's own formula leaves behind when there is no brief to concatenate.
    expect(demoCreativeSheetItems.map((row) => row.name.split('-')[0])).toEqual([
      'October',
      'October',
      'September',
      'September',
      'September',
    ]);
    expect(
      demoCreativeSheetItems.filter((row) => row.briefId === null).map((row) => row.name),
    ).toEqual(['October-']);
  });

  it('seed row for row into the child brand and list back as the fixtures', async () => {
    const { db, brandId } = await seeded();
    const scope = withBrand(db, brandId);

    // Only the stored columns go in; the name and the brief fields must come back from the join.
    await scope.insert(creativeSheetItems, demoCreativeSheetItems.map(storedColumns));

    expect(await listCreativeSheetItems(db, brandId)).toEqual(demoCreativeSheetItems);
  });
});
