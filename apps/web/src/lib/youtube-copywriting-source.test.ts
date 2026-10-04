import {
  brands,
  campaignsOffers,
  collections,
  demoYoutubeCopy,
  products,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  youtubeCopy,
  youtubeCopyCampaigns,
  youtubeCopyCollections,
  youtubeCopyProducts,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildYoutubeCopyItems } from '@/app/app/youtube-copywriting/build-items';

import { loadYoutubeCopyWorkspace, type YoutubeCopySourceDeps } from './youtube-copywriting-source';

const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadYoutubeCopyWorkspace in demo mode', () => {
  it('answers from the fixtures — collection product names included — with no connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadYoutubeCopyWorkspace({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoYoutubeCopy);
    expect(result.collectionProducts.length).toBe(result.collections.length);
    expect(connect).not.toHaveBeenCalled();
  });
});

/**
 * GRATSI-MATCH QA (2026-10-04, `docs/audits/gratsi-column-diff-2026-10-04.md`): Gratsi's resolved
 * Youtube Copywriting column set equals the Gratsi base's 29 Airtable fields — ordered and
 * labelled exactly as the base spells them — minus ONLY the five decision-doc-flagged fields
 * (docs/decisions.md, 2026-10-04):
 *
 *   - `Creative` (17) — a lookup whose source link the base itself has deleted
 *     (`schema/youtube-copy.ts`: isValid:false, recordLink gone; nothing to traverse);
 *   - `Creative Reporting` (25), `Creative Sheet` (26), `(Internal) Creative Design` (28) —
 *     residual texts of converted links, 0-filled, excluded by the 2026-10-01 register;
 *   - `⚠️ Please Change the Status of the copy` (29) — the Airtable UI banner, the hidden
 *     sentinel row.
 */
describe('the Gratsi Youtube Copywriting column set (GRATSI-MATCH 2026-10-04)', () => {
  async function seededColumns() {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const brandRows = await db.select().from(brands);
    const gratsi = brandRows.find((brand) => brand.slug === 'gratsi');
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
    return { db, gratsi, brandRows };
  }

  it("resolves Gratsi to the Airtable field list, in the base's own order, minus only the flagged five", async () => {
    const { db, gratsi } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'youtube_copy');

    expect(
      resolved.map((column) => [column.displayOrder, column.columnKey, column.displayLabel]),
    ).toEqual([
      [1, 'copy_number', 'Copy #'],
      [2, 'status', 'Status'],
      [3, 'youtube_copy_collections', 'Collections'],
      [4, 'youtube_copy_products', 'Product'],
      [5, 'angle', 'Angle'],
      [6, 'descriptions', 'Descriptions (90 caractères max)'],
      [7, 'headline', 'Headline'],
      [8, 'news_feed', 'News Feed'],
      [9, 'cta', 'CTA'],
      [10, 'youtube_copy_campaigns', 'Campaign Code'],
      [11, 'offer', 'Offer'],
      [12, 'campaign_from_campaign', 'Campaign (from Campaign)'],
      [13, 'code_from_campaign', 'Code (from Campaign)'],
      [14, 'funnel', 'Funnel'],
      [15, 'youtube_copy_copy_types', 'Copy Type'],
      [16, 'client_comment', "Client's Comment"],
      [18, 'collection_url', 'Collection URL'],
      [19, 'link_from_product', 'Link (from Product)'],
      [20, 'used', 'USED'],
      [21, 'winning', 'Winning'],
      [22, 'meta_rating', 'Meta Rating'],
      [23, 'products_from_collections', 'Products (from Collections)'],
      [24, 'created_by', 'Created By'],
      [27, 'internal_product', '(Internal) Product'],
    ]);
  });

  it('keeps every lookup VIRTUAL (lookupRollup) and leaves the inheriting platform set at sixteen', async () => {
    const { db, gratsi, brandRows } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'youtube_copy');
    const virtual = resolved.filter((column) => column.formula !== null);

    expect(virtual.map((column) => column.columnKey).sort()).toEqual([
      'campaign_from_campaign',
      'code_from_campaign',
      'collection_url',
      'internal_product',
      'link_from_product',
      'offer',
      'products_from_collections',
    ]);
    expect(virtual.every((column) => column.formula === 'lookupRollup')).toBe(true);

    const niagara = brandRows.find((brand) => brand.slug === 'niagara-sleep-solutions');
    if (niagara === undefined) throw new Error('the seed has no niagara brand');
    const inheriting = await resolveColumns(db, niagara.id, 'youtube_copy');
    expect(inheriting).toHaveLength(16);
    expect(inheriting.some((column) => column.columnKey === 'offer')).toBe(false);
    expect(inheriting.some((column) => column.columnKey === 'created_by')).toBe(false);
  });
});

/**
 * The lookup cells, proved over a live-shaped read: a Gratsi YouTube copy row linked to a
 * campaign, a product and a collection (which carries its own product) reads every looked-up
 * value through `loadYoutubeCopyWorkspace` + `buildYoutubeCopyItems` — the exact pipeline the
 * page runs.
 */
describe('the Youtube Copywriting lookup cells over PGlite (GRATSI-MATCH 2026-10-04)', () => {
  function liveDeps(
    db: Db,
    activeBrandId: string,
  ): YoutubeCopySourceDeps & {
    readonly demoMode: () => boolean;
  } {
    return {
      demoMode: () => false,
      connect: () => ({ db, close: () => Promise.resolve() }),
      actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
      activeBrandId: () => Promise.resolve(activeBrandId),
    };
  }

  it('each lookup column carries the linked value, and null where the link points at nothing', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await testDb();
    await seed(db);
    const brandRows = await db.select().from(brands);
    const gratsi = brandRows.find((brand) => brand.slug === 'gratsi');
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');

    const [product] = await db
      .insert(products)
      .values({ brandId: gratsi.id, name: 'Night Reset Bundle', link: 'https://gratsi.test/nrb' })
      .returning();
    const [collectionProduct] = await db
      .insert(products)
      .values({ brandId: gratsi.id, name: 'Weighted Blanket', link: 'https://gratsi.test/wb' })
      .returning();
    const [collection] = await db
      .insert(collections)
      .values({
        brandId: gratsi.id,
        name: 'BFCM 2026 Collection',
        url: 'https://gratsi.test/collections/bfcm',
        productId: collectionProduct?.id,
      })
      .returning();
    const [campaign] = await db
      .insert(campaignsOffers)
      .values({
        brandId: gratsi.id,
        name: 'BFCM-20%OFF-BFCM26',
        discountOffer: '20%OFF',
        code: 'BFCM26',
      })
      .returning();
    const [copyRow] = await db
      .insert(youtubeCopy)
      .values({ brandId: gratsi.id, copyNumber: 4 })
      .returning();
    if (
      copyRow === undefined ||
      campaign === undefined ||
      product === undefined ||
      collection === undefined
    ) {
      throw new Error('fixture insert failed');
    }
    await db
      .insert(youtubeCopyCampaigns)
      .values({ youtubeCopyId: copyRow.id, campaignOfferId: campaign.id });
    await db
      .insert(youtubeCopyProducts)
      .values({ youtubeCopyId: copyRow.id, productId: product.id });
    await db
      .insert(youtubeCopyCollections)
      .values({ youtubeCopyId: copyRow.id, collectionId: collection.id });

    const workspace = await loadYoutubeCopyWorkspace(liveDeps(db, gratsi.id));
    expect(workspace.source).toBe('database');
    const items = buildYoutubeCopyItems(
      workspace.rows,
      workspace.collectionProducts,
      new Date('2026-10-04T09:00:00.000Z'),
    );
    const item = items.find((candidate) => candidate.id === copyRow.id);
    if (item === undefined) throw new Error('the Gratsi copy row did not come back');

    expect(item.title).toBe('Copy 4');
    expect(item.offer).toBe('20%OFF');
    expect(item.campaignNames).toBe('BFCM-20%OFF-BFCM26');
    expect(item.campaignCodes).toBe('BFCM26');
    expect(item.collectionUrls).toBe('https://gratsi.test/collections/bfcm');
    expect(item.productLinks).toBe('https://gratsi.test/nrb');
    expect(item.internalProduct).toBe('Night Reset Bundle');
    // Two hops: the linked collection's own product, not the copy's directly linked one.
    expect(item.productsFromCollections).toBe('Weighted Blanket');

    // An unlinked row resolves every lookup to null — the em dash, never a neighbour's value.
    const [bare] = await db
      .insert(youtubeCopy)
      .values({ brandId: gratsi.id, copyNumber: 5 })
      .returning();
    const second = await loadYoutubeCopyWorkspace(liveDeps(db, gratsi.id));
    const bareItem = buildYoutubeCopyItems(
      second.rows,
      second.collectionProducts,
      new Date('2026-10-04T09:00:00.000Z'),
    ).find((candidate) => candidate.id === bare?.id);

    expect(bareItem).toMatchObject({
      offer: null,
      campaignNames: null,
      campaignCodes: null,
      collectionUrls: null,
      productLinks: null,
      productsFromCollections: null,
      internalProduct: null,
    });
  });
});
