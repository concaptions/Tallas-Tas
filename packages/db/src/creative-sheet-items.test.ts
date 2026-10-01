import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { creativeSheetItems } from './schema/creative-sheet-items';
import { seed } from './seed';
import { testDb } from './testing';
import { withBrand } from './tenancy';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(
  db: Awaited<ReturnType<typeof testDb>>,
  table: string,
): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
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
