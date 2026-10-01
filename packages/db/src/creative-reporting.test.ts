import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  creativeReportDifferenceCpa,
  getCreativeReportById,
  insertCreativeReport,
  listCreativeReports,
  updateCreativeReport,
  type CreativeReportInput,
  type CreativeReportListRow,
} from './creative-reporting';
import { demoCreativeReports } from './demo-creative-reporting';
import { DEMO_BRAND_ID, demoBriefs } from './demo-data';
import { creativeBriefs, creativeReporting, type CreativeReport } from './schema';
import { seed, type SeedResult } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The first row of a seeded list, past `noUncheckedIndexedAccess`. */
function first<T>(rows: readonly T[], what: string): T {
  const [row] = rows;
  if (row === undefined) throw new Error(`${what} is empty`);
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<
  { db: PgliteDb; brandId: string; otherBrandId: string } & SeedResult
> {
  const db = await testDb();
  const result = await seed(db);
  return { db, brandId: result.childBrand.id, otherBrandId: result.templateBrand.id, ...result };
}

describe('creative_reporting migration on PGlite', () => {
  it('creates the table with its brand, template-row and brief indexes', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'creative_reporting')).toEqual([
      'creative_reporting_brand_id_idx',
      'creative_reporting_brief_id_idx',
      'creative_reporting_pkey',
      'creative_reporting_template_row_id_idx',
    ]);
  });

  it('inserts and reads a report through withBrand, linked to a seeded brief', async () => {
    const db = await testDb();
    const { childBrand, templateBrand, briefs } = await seed(db);

    const [report] = await withBrand(db, childBrand.id)
      .insert(creativeReporting, {
        nameAngleOffer: 'Fall Drop - Comfort - 20% off',
        briefId: briefs[0]?.id ?? null,
        adDesign: ['https://files.example/fall-drop-v1.png'],
        adLink: 'https://www.facebook.com/ads/library/?id=1',
        ctr: '0.0412',
        thumbStopRate: '31.50',
        results: '42.0',
        cpa: '18.50',
        targetCpa: '15.00',
        roas: '3.20',
        targetRoas: '4.0',
      })
      .returning();

    expect(report?.brandId).toBe(childBrand.id);
    expect(report?.briefId).toBe(briefs[0]?.id ?? null);
    expect(report?.ctr).toBe('0.0412');
    expect(report?.adDesign).toEqual(['https://files.example/fall-drop-v1.png']);
    expect(await withBrand(db, childBrand.id).select(creativeReporting)).toEqual([report]);
    expect(await withBrand(db, templateBrand.id).select(creativeReporting)).toEqual([]);
  });
});

describe('creativeReportDifferenceCpa', () => {
  it('is cpa minus target, in cents, with the sign the base shows', () => {
    expect(creativeReportDifferenceCpa('24.50', '22.00')).toBe(2.5);
    expect(creativeReportDifferenceCpa('19.80', '22.00')).toBe(-2.2);
    expect(creativeReportDifferenceCpa('22.00', '22.00')).toBe(0);
  });

  it('rounds a binary float to cents', () => {
    expect(creativeReportDifferenceCpa('0.30', '0.10')).toBe(0.2);
  });

  it('is null while either side is unset or unreadable', () => {
    expect(creativeReportDifferenceCpa(null, '22.00')).toBeNull();
    expect(creativeReportDifferenceCpa('24.50', null)).toBeNull();
    expect(creativeReportDifferenceCpa('abc', '22.00')).toBeNull();
  });
});

describe('creative report queries', () => {
  it('lists nothing for a freshly seeded brand, then the inserted row with its brief name and difference', async () => {
    const { db, brandId, briefs } = await seeded();
    const brief = first(briefs, 'briefs');

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(await listCreativeReports(db, brandId)).toEqual([]);

    const created = await insertCreativeReport(
      db,
      brandId,
      {
        nameAngleOffer: 'Body Clock V1 — Shift Worker — 90-Night Trial',
        briefId: brief.id,
        adDesign: ['https://picsum.photos/seed/report/1200/900'],
        adLink: 'https://www.facebook.com/ads/library/?id=1',
        ctr: '0.0412',
        thumbStopRate: '31.50',
        results: '184.0',
        cpa: '24.50',
        targetCpa: '22.00',
        roas: '3.40',
        targetRoas: '3.0',
      },
      'user_test',
    );

    const rows = await listCreativeReports(db, brandId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: created.id,
      brandId,
      nameAngleOffer: 'Body Clock V1 — Shift Worker — 90-Night Trial',
      briefId: brief.id,
      briefName: brief.name,
      // Postgres returns `numeric` at the column scale, as strings — the shape the fixtures use.
      ctr: '0.0412',
      thumbStopRate: '31.50',
      results: '184.0',
      cpa: '24.50',
      targetCpa: '22.00',
      roas: '3.40',
      targetRoas: '3.0',
      differenceCpa: 2.5,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await getCreativeReportById(db, brandId, created.id)).toEqual(rows[0]);
  });

  it('orders newest edit first and has no difference while a side is unset', async () => {
    const { db, brandId } = await seeded();
    const older = await insertCreativeReport(
      db,
      brandId,
      { nameAngleOffer: 'Older', cpa: '20.00' },
      'user_test',
    );
    await insertCreativeReport(db, brandId, { nameAngleOffer: 'Newer' }, 'user_test');
    await updateCreativeReport(
      db,
      brandId,
      older.id,
      { nameAngleOffer: 'Older, edited' },
      'user_test',
    );

    const rows = await listCreativeReports(db, brandId);

    expect(rows.map((row) => row.nameAngleOffer)).toEqual(['Older, edited', 'Newer']);
    expect(rows.map((row) => row.differenceCpa)).toEqual([null, null]);
    expect(rows.map((row) => row.briefName)).toEqual([null, null]);
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const created = await insertCreativeReport(
      db,
      brandId,
      { nameAngleOffer: 'Isolated' },
      'user_test',
    );

    expect(await listCreativeReports(db, otherBrandId)).toEqual([]);
    expect(await getCreativeReportById(db, otherBrandId, created.id)).toBeNull();

    await db
      .update(creativeReporting)
      .set({ deletedAt: new Date() })
      .where(eq(creativeReporting.id, created.id));

    expect(await listCreativeReports(db, brandId)).toEqual([]);
    expect(await getCreativeReportById(db, brandId, created.id)).toBeNull();
  });

  it('insertCreativeReport forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      nameAngleOffer: 'Smuggled',
      brandId: otherBrandId,
    } as unknown as CreativeReportInput;

    const row = await insertCreativeReport(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      nameAngleOffer: 'Smuggled',
      briefId: null,
      cpa: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listCreativeReports(db, brandId)).toHaveLength(1);
    expect(await listCreativeReports(db, otherBrandId)).toEqual([]);
  });

  it('updateCreativeReport cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const created = await insertCreativeReport(
      db,
      brandId,
      { nameAngleOffer: 'Mine' },
      'user_test',
    );

    const escaped = await updateCreativeReport(
      db,
      otherBrandId,
      created.id,
      { nameAngleOffer: 'Hijacked' },
      'thief',
    );
    const own = await updateCreativeReport(
      db,
      brandId,
      created.id,
      { cpa: '18.00', targetCpa: '22.00', notes: 'Under target.' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: created.id,
      brandId,
      nameAngleOffer: 'Mine',
      cpa: '18.00',
      targetCpa: '22.00',
      notes: 'Under target.',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect((await getCreativeReportById(db, brandId, created.id))?.differenceCpa).toBe(-4);
  });

  it('links only the brand’s own live brief: a foreign, deleted or unknown id is stored as NULL', async () => {
    const { db, brandId, otherBrandId, briefs, concepts } = await seeded();
    const brief = first(briefs, 'briefs');
    const concept = first(concepts, 'concepts');
    const [foreign] = await withBrand(db, otherBrandId)
      .insert(creativeBriefs, { name: 'Foreign brief', conceptId: null })
      .returning();
    if (foreign === undefined) throw new Error('foreign brief insert returned no row');
    expect(concept.brandId).toBe(brandId);

    const smuggledLink = await insertCreativeReport(
      db,
      brandId,
      { nameAngleOffer: 'Linked elsewhere', briefId: foreign.id },
      'user_test',
    );
    expect(smuggledLink.briefId).toBeNull();

    const own = await insertCreativeReport(
      db,
      brandId,
      { nameAngleOffer: 'Linked here', briefId: brief.id },
      'user_test',
    );
    expect(own.briefId).toBe(brief.id);
    expect((await getCreativeReportById(db, brandId, own.id))?.briefName).toBe(brief.name);

    // A patch cannot relink to the other brand's brief either, and an unknown id clears the link.
    expect(
      (await updateCreativeReport(db, brandId, own.id, { briefId: foreign.id }, 'user_test'))
        ?.briefId,
    ).toBeNull();
    expect(
      (await updateCreativeReport(db, brandId, own.id, { briefId: brief.id }, 'user_test'))
        ?.briefId,
    ).toBe(brief.id);
    // A patch that does not mention the brief leaves it alone.
    expect(
      (await updateCreativeReport(db, brandId, own.id, { notes: 'Still linked.' }, 'user_test'))
        ?.briefId,
    ).toBe(brief.id);

    // A soft-deleted brief vanishes from the row's name without an update.
    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(eq(creativeBriefs.id, brief.id));
    expect((await getCreativeReportById(db, brandId, own.id))?.briefName).toBeNull();
  });

  it('exposes one row type for demo fixtures and database rows, and fixtures that agree with the briefs and the formula', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCreativeReports).toEqualTypeOf<CreativeReportListRow[]>();
    expectTypeOf(await listCreativeReports(db, brandId)).toEqualTypeOf<CreativeReportListRow[]>();
    expectTypeOf<CreativeReportListRow>().toExtend<CreativeReport>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<CreativeReportInput>().not.toHaveProperty('brandId');
    expectTypeOf<CreativeReportInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CreativeReportInput>().toHaveProperty('targetCpa');

    expect(demoCreativeReports).toHaveLength(4);
    for (const row of demoCreativeReports) {
      expect(row.brandId).toBe(DEMO_BRAND_ID);
      expect(row.differenceCpa).toBe(creativeReportDifferenceCpa(row.cpa, row.targetCpa));
      // The brief lookup names the demo brand's own brief, by the §7 name that fixture generates.
      const brief = demoBriefs.find((candidate) => candidate.id === row.briefId);
      expect(row.briefName).toBe(brief?.name ?? null);
    }
    expect(demoCreativeReports.filter((row) => row.briefId === null)).toHaveLength(1);
    // Newest edit first, as the query returns them.
    const updated = demoCreativeReports.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });
});
