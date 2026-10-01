import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  creativeModuleAngles,
  creativeModuleDesigns,
  creativeModules,
} from './schema/creative-modules';
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

describe('creative_modules migration on PGlite', () => {
  it('creates the table with its brand and template-row indexes, and both junctions', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'creative_modules')).toEqual([
      'creative_modules_brand_id_idx',
      'creative_modules_pkey',
      'creative_modules_template_row_id_idx',
    ]);
    expect(await indexNames(db, 'creative_module_angles')).toEqual([
      'creative_module_angles_module_id_angle_id_pk',
    ]);
    expect(await indexNames(db, 'creative_module_designs')).toEqual([
      'creative_module_designs_module_id_brief_id_pk',
    ]);
  });

  it('inserts and reads a module through withBrand, invisible to another brand', async () => {
    const db = await testDb();
    const { childBrand, templateBrand, angles, briefs } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [row] = await scope
      .insert(creativeModules, {
        moduleName: 'Hook Library',
        foreplayLink: 'https://app.foreplay.co/board/hook-library',
      })
      .returning();
    if (!row || !angles[0] || !briefs[0]) throw new Error('seed left nothing to link to');
    // The "Concepts" field links to ANGLES (see the schema comment); the junction says so in its type.
    await db.insert(creativeModuleAngles).values({ moduleId: row.id, angleId: angles[0].id });
    await db.insert(creativeModuleDesigns).values({ moduleId: row.id, briefId: briefs[0].id });

    expect(await scope.select(creativeModules)).toEqual([
      expect.objectContaining({
        id: row.id,
        brandId: childBrand.id,
        moduleName: 'Hook Library',
        foreplayLink: 'https://app.foreplay.co/board/hook-library',
        templateRowId: null,
        overriddenFields: [],
      }),
    ]);
    expect(await withBrand(db, templateBrand.id).select(creativeModules)).toEqual([]);
  });
});
