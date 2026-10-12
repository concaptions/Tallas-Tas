import {
  brands,
  demoCollections,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCollections } from './collections-source';

/**
 * Collections is RETIRED (Oct 12 client sync, Ticket 1): the workspace, its column loader and its
 * writers are gone and `/app/collections` redirects to Products / Landing Pages. What stays is the
 * one read the Campaigns & Offers page makes (`loadCollections`) and the table's own seeded column
 * set, which `column-seed.ts` keeps for the day Talal decides the drop.
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

describe('loadCollections in demo mode', () => {
  it('serves the fixtures and constructs no database client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const { rows, source } = await loadCollections({ connect });

    expect(source).toBe('demo');
    expect(rows).toEqual(demoCollections);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('the frozen collections column set (PGlite)', () => {
  it("still resolves Gratsi's own field list, in Airtable order, for the day the table is dropped", async () => {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);

    const resolved = await resolveColumns(db, await brandIdBySlug(db, 'gratsi'), 'collections');

    expect(resolved.map((column) => column.displayLabel)).toEqual(GRATSI_COLLECTION_LABELS);
  });
});
