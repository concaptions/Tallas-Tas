import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { COPY_STATUS_DEFAULT, youtubeCopy } from './schema';
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

describe('youtube_copy migration on PGlite', () => {
  it('creates youtube_copy with its brand and template-row indexes, and its four junctions', async () => {
    const db = await testDb();

    expect(await indexNames(db, 'youtube_copy')).toEqual([
      'youtube_copy_brand_id_idx',
      'youtube_copy_pkey',
      'youtube_copy_template_row_id_idx',
    ]);
    expect(await indexNames(db, 'youtube_copy_collections')).toEqual([
      'youtube_copy_collections_youtube_copy_id_collection_id_pk',
    ]);
    expect(await indexNames(db, 'youtube_copy_products')).toEqual([
      'youtube_copy_products_youtube_copy_id_product_id_pk',
    ]);
    expect(await indexNames(db, 'youtube_copy_campaigns')).toEqual([
      'youtube_copy_campaigns_youtube_copy_id_campaign_offer_id_pk',
    ]);
    expect(await indexNames(db, 'youtube_copy_copy_types')).toEqual([
      'youtube_copy_copy_types_youtube_copy_id_copy_type_id_pk',
    ]);
  });

  it('inserts and reads a YouTube copy through withBrand with the copy defaults applied', async () => {
    const db = await testDb();
    const { childBrand, templateBrand } = await seed(db);

    const [inserted] = await withBrand(db, childBrand.id)
      .insert(youtubeCopy, {
        copyNumber: 3,
        headline: 'Pour better',
        descriptions: 'Under ninety characters, as the panel enforces',
        cta: 'shop_now',
        funnel: 'mof_bof',
      })
      .returning();
    if (inserted === undefined) throw new Error('insert returned no row');

    expect(inserted).toMatchObject({
      brandId: childBrand.id,
      copyNumber: 3,
      status: COPY_STATUS_DEFAULT,
      used: false,
      winning: false,
      metaRating: null,
    });
    expect(await withBrand(db, childBrand.id).select(youtubeCopy)).toContainEqual(inserted);
    expect(await withBrand(db, templateBrand.id).select(youtubeCopy)).not.toContainEqual(inserted);
  });
});
