import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_BRAND_ID, demoCampaigns, demoCollections, demoProducts } from './demo-data';
import { demoYoutubeCopy } from './demo-youtube-copy';
import {
  COPY_STATUS_DEFAULT,
  copyTypes,
  youtubeCopy,
  youtubeCopyCollections,
  youtubeCopyCopyTypes,
  type YoutubeCopy,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';
import {
  getYoutubeCopyById,
  insertYoutubeCopy,
  listYoutubeCopy,
  listYoutubeCopyNumbers,
  syncYoutubeCopyCollections,
  syncYoutubeCopyLinks,
  updateYoutubeCopy,
  type YoutubeCopyInput,
  type YoutubeCopyListRow,
} from './youtube-copy';

/** Index names from `pg_indexes` for one table; a primary key's index carries the constraint's name. */
async function indexNames(db: PgliteDb, table: string): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/** The newest fixture — the approved body-clock pre-roll — past `noUncheckedIndexedAccess`. */
function newestCopy(): YoutubeCopyListRow {
  const [row] = demoYoutubeCopy;
  if (row === undefined) throw new Error('demoYoutubeCopy is empty');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/**
 * A fixture as `youtube_copy` stores it: `brand_id` is the scope's, not the payload's, and the four
 * `linked*` arrays are what `listYoutubeCopy` resolves through the junctions, never columns.
 */
function storedRow(row: YoutubeCopyListRow): Omit<YoutubeCopy, 'brandId'> {
  const rest: Record<string, unknown> = { ...row };
  delete rest['brandId'];
  delete rest['linkedCollections'];
  delete rest['linkedProducts'];
  delete rest['linkedCampaigns'];
  delete rest['linkedCopyTypes'];
  return rest as Omit<YoutubeCopy, 'brandId'>;
}

/** Writes the fixtures into the seeded brand through the scope, junctions included. */
async function seedFixtures(db: PgliteDb, brandId: string): Promise<void> {
  const scope = withBrand(db, brandId);
  for (const row of demoYoutubeCopy) {
    await scope.insert(youtubeCopy, storedRow(row));
    await syncYoutubeCopyLinks(db, brandId, row.id, {
      collectionIds: row.linkedCollections.map((link) => link.id),
      productIds: row.linkedProducts.map((link) => link.id),
      campaignOfferIds: row.linkedCampaigns.map((link) => link.id),
      copyTypeIds: row.linkedCopyTypes.map((link) => link.id),
    });
  }
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

describe('demoYoutubeCopy fixtures', () => {
  it('is four rows on the demo brand in updated_at descending order, one per status', () => {
    expect(demoYoutubeCopy).toHaveLength(4);
    expect(demoYoutubeCopy.every((row) => row.brandId === DEMO_BRAND_ID)).toBe(true);
    expect(demoYoutubeCopy.map((row) => row.copyNumber)).toEqual([1, 2, 3, 4]);

    const updated = demoYoutubeCopy.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
    expect(new Set(demoYoutubeCopy.map((row) => row.status)).size).toBe(4);
  });

  it('keeps every description within the 90 characters the panel enforces', () => {
    for (const row of demoYoutubeCopy) {
      expect(row.descriptions?.length ?? 0).toBeGreaterThan(0);
      expect(row.descriptions?.length ?? 0).toBeLessThanOrEqual(90);
    }
  });

  it('carries a client comment on the edited_by_client row only', () => {
    const commented = demoYoutubeCopy.filter((row) => row.clientComment !== null);

    expect(commented).toHaveLength(1);
    expect(commented[0]?.status).toBe('edited_by_client');
  });

  it('links only seeded collections, products and campaigns, with their lookups copied exactly', () => {
    for (const row of demoYoutubeCopy) {
      for (const link of row.linkedCollections) {
        expect(demoCollections.find((c) => c.id === link.id)?.url).toBe(link.url);
      }
      for (const link of row.linkedProducts) {
        expect(demoProducts.find((p) => p.id === link.id)?.link).toBe(link.link);
      }
      for (const link of row.linkedCampaigns) {
        const campaign = demoCampaigns.find((c) => c.id === link.id);
        expect(campaign?.code).toBe(link.code);
        expect(campaign?.discountOffer).toBe(link.offer);
      }
    }
    expect(demoYoutubeCopy.some((row) => row.linkedCampaigns.length > 0)).toBe(true);
  });
});

describe('listYoutubeCopy', () => {
  it('returns the fixtures row for row once they are written through the scope, links resolved', async () => {
    const { db, brandId } = await seeded();
    await seedFixtures(db, brandId);

    expect(await listYoutubeCopy(db, brandId)).toEqual(demoYoutubeCopy);
    expect(await listYoutubeCopyNumbers(db, brandId)).toEqual(
      expect.arrayContaining(demoYoutubeCopy.map((row) => row.copyNumber)),
    );
  });

  it('names a linked copy type of the brand and sorts every link by name', async () => {
    const { db, brandId } = await seeded();
    const target = newestCopy();
    await seedFixtures(db, brandId);
    const [testimonial] = await withBrand(db, brandId)
      .insert(copyTypes, { name: 'Testimonial' })
      .returning();
    const [awareness] = await withBrand(db, brandId)
      .insert(copyTypes, { name: 'Awareness' })
      .returning();
    if (testimonial === undefined || awareness === undefined) throw new Error('no copy type');

    await syncYoutubeCopyLinks(db, brandId, target.id, {
      collectionIds: demoCollections.map((row) => row.id),
      productIds: [],
      campaignOfferIds: [],
      copyTypeIds: [testimonial.id, awareness.id],
    });

    const row = await getYoutubeCopyById(db, brandId, target.id);
    expect(row?.linkedCopyTypes).toEqual([
      { id: awareness.id, name: 'Awareness' },
      { id: testimonial.id, name: 'Testimonial' },
    ]);
    expect(row?.linkedCollections.map((link) => link.name)).toEqual([
      'BFCM 2026 Collection',
      'Summer Cooling Collection',
    ]);
    expect(row?.linkedProducts).toEqual([]);
    expect(row?.linkedCampaigns).toEqual([]);
  });

  it('never returns another brand’s rows, and never resolves another brand’s links either', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    await seedFixtures(db, brandId);
    const borrowed = demoCollections.map((row) => row.id);
    const intruder = await insertYoutubeCopy(
      db,
      otherBrandId,
      { copyNumber: 9, headline: 'Other brand' },
      'user_test',
    );
    // The raw sync has no scope: the junction rows exist, and the scoped read must still not name them.
    await syncYoutubeCopyCollections(db, intruder.id, borrowed);

    const mine = await listYoutubeCopy(db, brandId);
    const theirs = await listYoutubeCopy(db, otherBrandId);

    expect(mine.map((row) => row.id)).not.toContain(intruder.id);
    expect(theirs.map((row) => row.id)).toEqual([intruder.id]);
    expect(theirs[0]?.linkedCollections).toEqual([]);
    expect(await getYoutubeCopyById(db, otherBrandId, newestCopy().id)).toBeNull();
    expect(await getYoutubeCopyById(db, brandId, intruder.id)).toBeNull();
  });

  it('drops a soft-deleted row from the list and from the lookup by id', async () => {
    const { db, brandId } = await seeded();
    await seedFixtures(db, brandId);
    const doomed = newestCopy().id;

    await withBrand(db, brandId).softDelete(youtubeCopy, eq(youtubeCopy.id, doomed));

    expect((await listYoutubeCopy(db, brandId)).map((row) => row.id)).not.toContain(doomed);
    expect(await getYoutubeCopyById(db, brandId, doomed)).toBeNull();
  });
});

describe('syncYoutubeCopyLinks', () => {
  it('drops an id that belongs to another brand before it reaches a junction', async () => {
    const { db, otherBrandId } = await seeded();
    const theirs = await insertYoutubeCopy(db, otherBrandId, { copyNumber: 1 }, 'user_test');
    const [theirType] = await withBrand(db, otherBrandId)
      .insert(copyTypes, { name: 'Theirs' })
      .returning();
    if (theirType === undefined) throw new Error('no copy type');

    // The seeded brand's collections and a copy type of its own: none of them is in the other scope.
    await syncYoutubeCopyLinks(db, otherBrandId, theirs.id, {
      collectionIds: demoCollections.map((row) => row.id),
      productIds: demoProducts.map((row) => row.id),
      campaignOfferIds: demoCampaigns.map((row) => row.id),
      copyTypeIds: [theirType.id, theirType.id],
    });

    expect(await db.select().from(youtubeCopyCollections)).toEqual([]);
    expect(await db.select().from(youtubeCopyCopyTypes)).toEqual([
      { youtubeCopyId: theirs.id, copyTypeId: theirType.id },
    ]);
  });

  it('replaces the previous links rather than adding to them', async () => {
    const { db, brandId } = await seeded();
    await seedFixtures(db, brandId);
    const target = newestCopy();
    const [summer] = demoCollections.filter((row) => row.name.startsWith('Summer'));
    if (summer === undefined) throw new Error('no summer collection');

    await syncYoutubeCopyLinks(db, brandId, target.id, {
      collectionIds: [summer.id],
      productIds: [],
      campaignOfferIds: [],
      copyTypeIds: [],
    });

    const row = await getYoutubeCopyById(db, brandId, target.id);
    expect(row?.linkedCollections.map((link) => link.id)).toEqual([summer.id]);
    expect(row?.linkedProducts).toEqual([]);
    expect(row?.linkedCampaigns).toEqual([]);
  });
});

describe('insertYoutubeCopy and updateYoutubeCopy', () => {
  it('forces brand_id to the scope and applies the column defaults', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a hand-built payload would make.
    const smuggled = {
      copyNumber: 5,
      brandId: otherBrandId,
      headline: 'Smuggled',
    } as unknown as YoutubeCopyInput;

    const row = await insertYoutubeCopy(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      copyNumber: 5,
      status: COPY_STATUS_DEFAULT,
      cta: null,
      funnel: null,
      used: false,
      winning: false,
      metaRating: null,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listYoutubeCopy(db, brandId)).toHaveLength(1);
    expect(await listYoutubeCopy(db, otherBrandId)).toEqual([]);
  });

  it('patches a row in the scope, but never another brand’s', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    await seedFixtures(db, brandId);
    const target = newestCopy();

    const escaped = await updateYoutubeCopy(
      db,
      otherBrandId,
      target.id,
      { headline: 'Hijacked' },
      'thief',
    );
    const own = await updateYoutubeCopy(
      db,
      brandId,
      target.id,
      { status: 'revisions_needed', metaRating: 2, funnel: 'post_purchase' },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      headline: target.headline,
      status: 'revisions_needed',
      metaRating: 2,
      funnel: 'post_purchase',
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });
});

describe('types', () => {
  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoYoutubeCopy).toEqualTypeOf<YoutubeCopyListRow[]>();
    expectTypeOf(await listYoutubeCopy(db, brandId)).toEqualTypeOf<YoutubeCopyListRow[]>();
    expectTypeOf<YoutubeCopyListRow>().toExtend<YoutubeCopy>();
    // `brand_id` and the audit columns are the scope's, never the panel's.
    expectTypeOf<YoutubeCopyInput>().not.toHaveProperty('brandId');
    expectTypeOf<YoutubeCopyInput>().not.toHaveProperty('createdBy');
    expectTypeOf<YoutubeCopyInput>().toHaveProperty('copyNumber');
    expectTypeOf<YoutubeCopyInput>().toHaveProperty('descriptions');
    expectTypeOf<YoutubeCopyInput>().toHaveProperty('metaRating');
  });
});
