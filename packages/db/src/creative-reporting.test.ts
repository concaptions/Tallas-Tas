import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { creativeReporting } from './schema/creative-reporting';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

describe('creative_reporting on PGlite', () => {
  it('is created by the migration with its brand, template-row and brief indexes', async () => {
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
