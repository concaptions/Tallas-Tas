import {
  brands,
  collections,
  creativeBriefs,
  demoCollections,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { indexCreativeDesignsByCollection } from '@/app/app/collections/fields';

import { loadBriefs } from './briefs-source';
import {
  loadCollectionColumns,
  loadCollections,
  type CollectionSourceDeps,
} from './collections-source';

/**
 * GRATSI-MATCH collections (2026-10-04): the displayed column set equals the Gratsi base's own 13
 * fields minus the four rule-5 flags recorded in `docs/decisions.md` ("GRATSI-MATCH collections"):
 * `Creative Sheet` and the duplicate `Email Campaigns Management copy` pair (the exclusion
 * register's residual texts) and `Table 17` (the audit's junk-named field; its email campaigns
 * already reach the panel through `email_campaign_collections`). Order is the Gratsi base's field
 * order. The same labels name different storage than the template's — `Copywriting` is the
 * YouTube junction, `Ads Copywriting copy` is the stored Meta-copy FK — which the key assertions
 * pin so the two can never be swapped back.
 */
const GRATSI_COLLECTION_LABELS = [
  'Main Collection',
  'URL',
  'Copywriting',
  'Campaigns & Offers',
  'Angles',
  '(Internal) Product',
  '(Internal) Creative Design',
  '(Internal) Creative Design 2',
  'Ads Copywriting copy',
];

/** The template base's own 8 fields, in its field order. */
const PARENT_COLLECTION_LABELS = [
  'Collection Name',
  'URL',
  'Campaigns & Offers',
  'Angles',
  '(Internal) Product',
  '(Internal) Creative Design',
  'Ads Copywriting copy',
  '(Internal) Creative Design 2',
];

const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

async function brandIdBySlug(db: Db, slug: string): Promise<string> {
  // No `drizzle-orm` import in @tas/web (operators live behind @tas/db), so filter in JS.
  const row = (await db.select().from(brands)).find((brand) => brand.slug === slug);
  if (row === undefined) throw new Error(`the seed has no ${slug} brand`);
  return row.id;
}

async function seededDb(): Promise<Db> {
  const db = await testDb();
  await seed(db);
  await seedColumnDefinitions(db);
  return db;
}

/** Live-mode deps that answer every query from the in-memory PGlite database. */
function pgliteDeps(db: Db, brandId: string): CollectionSourceDeps {
  return {
    demoMode: () => false,
    connect: () => ({ db, close: () => Promise.resolve() }),
    actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
    activeBrandId: () => Promise.resolve(brandId),
  };
}

describe('the collections column set, resolved per brand (PGlite)', () => {
  it("equals Gratsi's Airtable field list minus the four flagged fields, in Airtable order", async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(db, await brandIdBySlug(db, 'gratsi'), 'collections');

    expect(resolved.map((column) => column.displayLabel)).toEqual(GRATSI_COLLECTION_LABELS);
    // The flags never resolve under any label.
    for (const flagged of ['Creative Sheet', 'Table 17', 'Email Campaigns Management copy']) {
      expect(resolved.map((column) => column.displayLabel)).not.toContain(flagged);
    }
    // The storage behind the shared labels, pinned: `Copywriting` is the YOUTUBE junction,
    // `Ads Copywriting copy` the stored Meta-copy FK, `Angles` the CONCEPTS junction,
    // `(Internal) Creative Design` the briefs' collection_id read backwards.
    const keyOf = (label: string) =>
      resolved.find((column) => column.displayLabel === label)?.columnKey;
    expect(keyOf('Copywriting')).toBe('youtube_copy_collections');
    expect(keyOf('Ads Copywriting copy')).toBe('copywriting_id');
    expect(keyOf('Angles')).toBe('concept_collections');
    expect(keyOf('(Internal) Creative Design')).toBe('creative_briefs');
    expect(keyOf('(Internal) Creative Design 2')).toBe('creative_design_note');
    // The template columns Gratsi's base has no field for are hidden, never dropped.
    expect(resolved.map((column) => column.columnKey)).not.toContain('angle_id');
    expect(resolved.map((column) => column.columnKey)).not.toContain('creative_design_2_id');
  });

  it('gives an inheriting brand the template base fields under the PARENT labels, in order', async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'niagara-sleep-solutions'),
      'collections',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(PARENT_COLLECTION_LABELS);
    // Fields 6 and 8, previously conflated: the loose text and the brief link are two columns.
    const keyOf = (label: string) =>
      resolved.find((column) => column.displayLabel === label)?.columnKey;
    expect(keyOf('(Internal) Creative Design')).toBe('creative_design_note');
    expect(keyOf('(Internal) Creative Design 2')).toBe('creative_design_2_id');
  });
});

describe('loadCollectionColumns in demo mode', () => {
  it('returns the parent master set and constructs no database client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadCollectionColumns({ connect });

    expect(result.source).toBe('demo');
    expect(result.unconfigured).toBe(false);
    expect(result.columns.map((column) => column.displayLabel)).toEqual(PARENT_COLLECTION_LABELS);
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the demo collection fixtures renderable under that set', async () => {
    const { rows } = await loadCollections({ connect });
    expect(rows).toEqual(demoCollections);
    // The two conflated columns are distinct fixture fields, so both cells have data to draw.
    expect(rows.some((row) => row.creativeDesignNote !== null)).toBe(true);
    expect(rows.some((row) => row.creativeDesign2Id !== null)).toBe(true);
  });
});

describe("the `(Internal) Creative Design` reverse-link column's names (PGlite, rows seeded here)", () => {
  it('carries the generated names of the briefs whose collection_id points at the collection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await seededDb();
    const gratsiId = await brandIdBySlug(db, 'gratsi');
    const deps = pgliteDeps(db, gratsiId);

    const [collection] = await db
      .insert(collections)
      .values({ brandId: gratsiId, name: 'BFCM Bundles' })
      .returning({ id: collections.id });
    if (collection === undefined) throw new Error('insert returned no collection');
    await db.insert(creativeBriefs).values([
      { brandId: gratsiId, name: 'TV1-B1-BFCM-V1', collectionId: collection.id },
      { brandId: gratsiId, name: 'TS2-B1-BFCM-V1', collectionId: collection.id },
      { brandId: gratsiId, name: 'TV9-B9-OTHER-V1', collectionId: null },
    ]);

    // The page's pass: briefs through their own loader, inverted once by collection_id.
    const briefs = await loadBriefs(deps);
    const byCollection = indexCreativeDesignsByCollection(briefs.rows);

    const labels = (byCollection.get(collection.id) ?? []).map((link) => link.label).sort();
    expect(labels).toEqual(['TS2-B1-BFCM-V1', 'TV1-B1-BFCM-V1']);
    // A brief with no collection reaches no list.
    expect([...byCollection.values()].flat().map((link) => link.label)).not.toContain(
      'TV9-B9-OTHER-V1',
    );
  });
});
