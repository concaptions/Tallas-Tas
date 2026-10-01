import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getClientAssetFolderById,
  insertClientAssetFolder,
  listClientAssetFolders,
  loadAllBriefFolders,
  syncFolderBriefs,
  updateClientAssetFolder,
  type ClientAssetFolderInput,
  type ClientAssetFolderListRow,
} from './client-asset-folders';
import { demoClientAssetFolders } from './demo-client-asset-folders';
import { DEMO_BRAND_ID, demoBriefs } from './demo-data';
import { clientAssetFolders, creativeBriefs, type ClientAssetFolder } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand, type ScopedInsertValue } from './tenancy';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

describe('client_asset_folders migration on PGlite', () => {
  it('creates the table with its brand and template-row indexes, and the brief junction', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'client_asset_folders')).toEqual([
      'client_asset_folders_brand_id_idx',
      'client_asset_folders_pkey',
      'client_asset_folders_template_row_id_idx',
    ]);
    expect(await indexNames(db, 'brief_asset_folders')).toEqual([
      'brief_asset_folders_brief_id_folder_id_pk',
    ]);
  });
});

/** The first demo folder — the brand kit, linked to two designs — past `noUncheckedIndexedAccess`. */
function demoFolder(): ClientAssetFolderListRow {
  const [row] = demoClientAssetFolders;
  if (row === undefined) throw new Error('demoClientAssetFolders is empty');
  return row;
}

/**
 * A fixture's stored columns: the row without the derived link arrays and without `brandId`, which
 * the scope supplies. The same literal-key strip `seed.ts` does for every other derived column.
 */
function storedColumns(
  fixture: ClientAssetFolderListRow,
): ScopedInsertValue<typeof clientAssetFolders> {
  const rest: Record<string, unknown> = { ...fixture };
  delete rest['briefIds'];
  delete rest['briefNames'];
  delete rest['brandId'];
  return rest as ScopedInsertValue<typeof clientAssetFolders>;
}

/**
 * A fresh database with every migration applied, the demo content seeded into the child brand, and
 * the folder fixtures written in with their own ids, timestamps and links — `seed()` does not know
 * this table, so the test does what the seed would: scoped inserts, then the junction sync.
 */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  const scope = withBrand(db, childBrand.id);
  for (const fixture of demoClientAssetFolders) {
    await scope.insert(clientAssetFolders, storedColumns(fixture));
    await syncFolderBriefs(db, fixture.id, fixture.briefIds);
  }
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('client asset folder queries', () => {
  it('lists the three fixtures row for row, links included, newest edit first', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoClientAssetFolders).toHaveLength(3);
    const rows = await listClientAssetFolders(db, brandId);
    expect(rows).toEqual(demoClientAssetFolders);

    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
    // The optional column is visibly optional, and one folder has no design yet: a real zero.
    expect(rows.filter((row) => row.locationUrl === null)).toHaveLength(1);
    expect(rows.filter((row) => row.briefIds.length === 0)).toHaveLength(1);
  });

  it('keeps brief ids and names side by side, alphabetical by name', async () => {
    const { db, brandId } = await seeded();
    const target = demoFolder();

    const row = await getClientAssetFolderById(db, brandId, target.id);

    expect(row?.briefIds).toHaveLength(2);
    expect(row?.briefIds.map((id) => demoBriefs.find((brief) => brief.id === id)?.name)).toEqual(
      row?.briefNames,
    );
    expect(row?.briefNames).toEqual(
      [...(row?.briefNames ?? [])].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('drops a link whose brief is no longer live, and restores it when the brief is', async () => {
    const { db, brandId } = await seeded();
    const target = demoFolder();
    const [firstBriefId] = target.briefIds;
    if (firstBriefId === undefined) throw new Error('the brand kit fixture has no briefs');

    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(sql`${creativeBriefs.id} = ${firstBriefId}`);
    const without = await getClientAssetFolderById(db, brandId, target.id);
    expect(without?.briefIds).toEqual(target.briefIds.filter((id) => id !== firstBriefId));
    expect(without?.briefNames).toHaveLength(1);

    await db
      .update(creativeBriefs)
      .set({ deletedAt: null })
      .where(sql`true`);
    expect((await getClientAssetFolderById(db, brandId, target.id))?.briefIds).toHaveLength(2);
  });

  it('round-trips the junction through syncFolderBriefs: replace, shrink, clear', async () => {
    const { db, brandId } = await seeded();
    const [first, second] = demoClientAssetFolders;
    if (first === undefined || second === undefined) throw new Error('fixtures missing');

    // Give the first folder the second folder's links: delete-then-insert, nothing accumulates.
    await syncFolderBriefs(db, first.id, second.briefIds);
    let row = await getClientAssetFolderById(db, brandId, first.id);
    expect(row?.briefIds).toEqual(second.briefIds);
    expect(row?.briefNames).toEqual(second.briefNames);
    // The second folder's own links are untouched: a sync is per owner.
    expect((await getClientAssetFolderById(db, brandId, second.id))?.briefIds).toEqual(
      second.briefIds,
    );
    // The brief side reads the same rows back the other way: each brief now names both folders.
    const byBrief = await loadAllBriefFolders(db);
    for (const briefId of second.briefIds) {
      expect([...(byBrief.get(briefId) ?? [])].sort()).toEqual([first.id, second.id].sort());
    }

    await syncFolderBriefs(db, first.id, []);
    row = await getClientAssetFolderById(db, brandId, first.id);
    expect(row).toMatchObject({ briefIds: [], briefNames: [] });
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoFolder();

    expect(await listClientAssetFolders(db, otherBrandId)).toEqual([]);
    expect(await getClientAssetFolderById(db, otherBrandId, target.id)).toBeNull();

    await db
      .update(clientAssetFolders)
      .set({ deletedAt: new Date() })
      .where(sql`${clientAssetFolders.id} = ${target.id}`);

    expect(await listClientAssetFolders(db, brandId)).toHaveLength(2);
    expect(await getClientAssetFolderById(db, brandId, target.id)).toBeNull();
  });

  it('insertClientAssetFolder forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed form would make.
    const smuggled = {
      name: 'Smuggled folder',
      brandId: otherBrandId,
    } as unknown as ClientAssetFolderInput;

    const row = await insertClientAssetFolder(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled folder',
      description: null,
      locationUrl: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await getClientAssetFolderById(db, brandId, row.id)).toMatchObject({
      briefIds: [],
      briefNames: [],
    });
    expect(await listClientAssetFolders(db, brandId)).toHaveLength(4);
    expect(await listClientAssetFolders(db, otherBrandId)).toEqual([]);
  });

  it('updateClientAssetFolder cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoFolder();

    const escaped = await updateClientAssetFolder(
      db,
      otherBrandId,
      target.id,
      { name: 'Hijacked' },
      'thief',
    );
    const own = await updateClientAssetFolder(
      db,
      brandId,
      target.id,
      { locationUrl: 'https://drive.google.com/drive/folders/renamed' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      name: target.name,
      locationUrl: 'https://drive.google.com/drive/folders/renamed',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoClientAssetFolders).toEqualTypeOf<ClientAssetFolderListRow[]>();
    expectTypeOf(await listClientAssetFolders(db, brandId)).toEqualTypeOf<
      ClientAssetFolderListRow[]
    >();
    expectTypeOf<ClientAssetFolderListRow>().toExtend<ClientAssetFolder>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<ClientAssetFolderInput>().not.toHaveProperty('brandId');
    expectTypeOf<ClientAssetFolderInput>().not.toHaveProperty('createdBy');
    expectTypeOf<ClientAssetFolderInput>().toHaveProperty('name');
    expectTypeOf<ClientAssetFolderInput>().toHaveProperty('description');
    expectTypeOf<ClientAssetFolderInput>().toHaveProperty('locationUrl');
  });
});
