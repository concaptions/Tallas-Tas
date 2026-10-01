import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { copyTypes } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';

/** Index names from `pg_indexes` for one table; a primary key's index carries the constraint's name. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

describe('copy_types migration on PGlite', () => {
  it('creates copy_types with its brand and template-row indexes, and the copywriting junction', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'copy_types')).toEqual([
      'copy_types_brand_id_idx',
      'copy_types_pkey',
      'copy_types_template_row_id_idx',
    ]);
    expect(await indexNames(db, 'copywriting_copy_types')).toEqual([
      'copywriting_copy_types_copy_id_copy_type_id_pk',
    ]);
  });

  it('inserts and reads a copy type through withBrand, invisible to another brand', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);

    const [inserted] = await withBrand(db, childBrand.id)
      .insert(copyTypes, { name: 'Testimonial', description: 'Quote-led, in the customer voice' })
      .returning();
    if (inserted === undefined) throw new Error('insert returned no row');

    expect(inserted.brandId).toBe(childBrand.id);
    expect(await withBrand(db, childBrand.id).select(copyTypes)).toContainEqual(inserted);
    expect(await withBrand(db, templateBrand.id).select(copyTypes)).not.toContainEqual(inserted);
  });
});
