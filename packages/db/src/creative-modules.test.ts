import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCreativeModuleById,
  insertCreativeModule,
  listCreativeModules,
  syncCreativeModuleAngles,
  syncCreativeModuleDesigns,
  updateCreativeModule,
  type CreativeModuleInput,
  type CreativeModuleListRow,
} from './creative-modules';
import { DEMO_BRAND_ID, demoAngles, demoBriefs } from './demo-data';
import { demoCreativeModules } from './demo-creative-modules';
import { angles, creativeModules, type CreativeModule } from './schema';
import {
  creativeModuleAngles,
  creativeModuleDesigns,
  creativeModules as creativeModulesTable,
} from './schema/creative-modules';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand, type ScopedInsertValue } from './tenancy';

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
    const { childBrand, templateBrand, angles: seededAngles, briefs } = await seed(db);
    const scope = withBrand(db, childBrand.id);

    const [row] = await scope
      .insert(creativeModulesTable, {
        moduleName: 'Hook Library',
        foreplayLink: 'https://app.foreplay.co/board/hook-library',
      })
      .returning();
    if (!row || !seededAngles[0] || !briefs[0]) throw new Error('seed left nothing to link to');
    // The "Concepts" field links to ANGLES (see the schema comment); the junction says so in its type.
    await db.insert(creativeModuleAngles).values({ moduleId: row.id, angleId: seededAngles[0].id });
    await db.insert(creativeModuleDesigns).values({ moduleId: row.id, briefId: briefs[0].id });

    expect(await scope.select(creativeModulesTable)).toEqual([
      expect.objectContaining({
        id: row.id,
        brandId: childBrand.id,
        moduleName: 'Hook Library',
        foreplayLink: 'https://app.foreplay.co/board/hook-library',
        templateRowId: null,
        overriddenFields: [],
      }),
    ]);
    expect(await withBrand(db, templateBrand.id).select(creativeModulesTable)).toEqual([]);
  });
});

/** The first demo module — the one with two angles and three designs — past `noUncheckedIndexedAccess`. */
function demoModule(): CreativeModuleListRow {
  const [row] = demoCreativeModules;
  if (row === undefined) throw new Error('demoCreativeModules is empty');
  return row;
}

/**
 * A fixture's stored columns: the row without the derived link arrays and without `brandId`, which
 * the scope supplies. The same literal-key strip `seed.ts` does for every other derived column.
 */
function storedColumns(fixture: CreativeModuleListRow): ScopedInsertValue<typeof creativeModules> {
  const rest: Record<string, unknown> = { ...fixture };
  delete rest['angleIds'];
  delete rest['angleNames'];
  delete rest['briefIds'];
  delete rest['briefNames'];
  delete rest['brandId'];
  return rest as ScopedInsertValue<typeof creativeModules>;
}

/**
 * A fresh database with every migration applied, the demo content seeded into the child brand, and
 * the module fixtures written in with their own ids, timestamps and links — `seed()` does not know
 * this table, so the test does what the seed would: scoped inserts, then the two junction syncs.
 */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  const scope = withBrand(db, childBrand.id);
  for (const fixture of demoCreativeModules) {
    await scope.insert(creativeModules, storedColumns(fixture));
    await syncCreativeModuleAngles(db, fixture.id, fixture.angleIds);
    await syncCreativeModuleDesigns(db, fixture.id, fixture.briefIds);
  }
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('creative module queries', () => {
  it('lists the four fixtures row for row, links included, newest edit first', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoCreativeModules).toHaveLength(4);
    const rows = await listCreativeModules(db, brandId);
    expect(rows).toEqual(demoCreativeModules);

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
    // The optional column is visibly optional, and one module has no design yet: a real zero.
    expect(rows.filter((row) => row.foreplayLink === null)).toHaveLength(1);
    expect(rows.filter((row) => row.briefIds.length === 0)).toHaveLength(1);
  });

  it('keeps ids and names side by side, alphabetical by name', async () => {
    const { db, brandId } = await seeded();
    const target = demoModule();

    const row = await getCreativeModuleById(db, brandId, target.id);

    expect(row?.angleNames).toEqual(['It Is Not Just Your Age', 'Your Body Clock Is Not Broken']);
    expect(row?.angleIds.map((id) => demoAngles.find((angle) => angle.id === id)?.name)).toEqual(
      row?.angleNames,
    );
    expect(row?.briefIds.map((id) => demoBriefs.find((brief) => brief.id === id)?.name)).toEqual(
      row?.briefNames,
    );
    expect(row?.briefNames).toEqual(
      [...(row?.briefNames ?? [])].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('drops a link whose angle is no longer live, and restores it when the angle is', async () => {
    const { db, brandId } = await seeded();
    const target = demoModule();

    await db
      .update(angles)
      .set({ deletedAt: new Date() })
      .where(sql`${angles.name} = ${'Your Body Clock Is Not Broken'}`);
    const without = await getCreativeModuleById(db, brandId, target.id);
    expect(without?.angleNames).toEqual(['It Is Not Just Your Age']);
    expect(without?.angleIds).toHaveLength(1);

    await db
      .update(angles)
      .set({ deletedAt: null })
      .where(sql`true`);
    expect((await getCreativeModuleById(db, brandId, target.id))?.angleIds).toHaveLength(2);
  });

  it('round-trips both junctions through the sync helpers: replace, shrink, clear', async () => {
    const { db, brandId } = await seeded();
    const [first, second] = demoCreativeModules;
    if (first === undefined || second === undefined) throw new Error('fixtures missing');

    // Give the first module the second module's links: delete-then-insert, nothing accumulates.
    await syncCreativeModuleAngles(db, first.id, second.angleIds);
    await syncCreativeModuleDesigns(db, first.id, second.briefIds);
    let row = await getCreativeModuleById(db, brandId, first.id);
    expect(row?.angleIds).toEqual(second.angleIds);
    expect(row?.briefIds).toEqual(second.briefIds);
    // The second module's own links are untouched: a sync is per owner.
    expect((await getCreativeModuleById(db, brandId, second.id))?.briefIds).toEqual(
      second.briefIds,
    );

    await syncCreativeModuleAngles(db, first.id, []);
    await syncCreativeModuleDesigns(db, first.id, []);
    row = await getCreativeModuleById(db, brandId, first.id);
    expect(row).toMatchObject({ angleIds: [], angleNames: [], briefIds: [], briefNames: [] });
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoModule();

    expect(await listCreativeModules(db, otherBrandId)).toEqual([]);
    expect(await getCreativeModuleById(db, otherBrandId, target.id)).toBeNull();

    await db
      .update(creativeModules)
      .set({ deletedAt: new Date() })
      .where(sql`${creativeModules.id} = ${target.id}`);

    expect(await listCreativeModules(db, brandId)).toHaveLength(3);
    expect(await getCreativeModuleById(db, brandId, target.id)).toBeNull();
  });

  it('insertCreativeModule forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed form would make.
    const smuggled = {
      moduleName: 'Smuggled module',
      brandId: otherBrandId,
    } as unknown as CreativeModuleInput;

    const row = await insertCreativeModule(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      moduleName: 'Smuggled module',
      foreplayLink: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await getCreativeModuleById(db, brandId, row.id)).toMatchObject({
      angleIds: [],
      briefIds: [],
    });
    expect(await listCreativeModules(db, brandId)).toHaveLength(5);
    expect(await listCreativeModules(db, otherBrandId)).toEqual([]);
  });

  it('updateCreativeModule cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoModule();

    const escaped = await updateCreativeModule(
      db,
      otherBrandId,
      target.id,
      { moduleName: 'Hijacked' },
      'thief',
    );
    const own = await updateCreativeModule(
      db,
      brandId,
      target.id,
      { foreplayLink: 'https://app.foreplay.co/board/renamed' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      moduleName: target.moduleName,
      foreplayLink: 'https://app.foreplay.co/board/renamed',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCreativeModules).toEqualTypeOf<CreativeModuleListRow[]>();
    expectTypeOf(await listCreativeModules(db, brandId)).toEqualTypeOf<CreativeModuleListRow[]>();
    expectTypeOf<CreativeModuleListRow>().toExtend<CreativeModule>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<CreativeModuleInput>().not.toHaveProperty('brandId');
    expectTypeOf<CreativeModuleInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CreativeModuleInput>().toHaveProperty('moduleName');
    expectTypeOf<CreativeModuleInput>().toHaveProperty('foreplayLink');
  });
});
