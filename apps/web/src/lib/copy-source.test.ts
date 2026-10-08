import {
  angles,
  brands,
  campaignsOffers,
  collections,
  copywriting,
  copywritingCampaigns,
  creativeBriefs,
  demoBriefs,
  demoCopy,
  products,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCopyItems } from '@/app/app/meta-copywriting/build-items';

import {
  loadCopy,
  loadCopyById,
  loadCopyWorkspace,
  loadCreativeOptions,
  withBrandScope,
  type CopySourceDeps,
} from './copy-source';

/**
 * The demo-mode guarantee, proved rather than asserted: with no Clerk key and a `DATABASE_URL` set,
 * the source answers from the fixtures and the connection factory is never called. The factory is
 * injected for exactly that reason — "no client was constructed" is not observable otherwise.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

const DATABASE_URL = 'postgres://user:pw@example.test/db';

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadCopy in demo mode', () => {
  it('returns the four fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const result = await loadCopy({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoCopy);
    expect(result.rows).toHaveLength(4);
    expect(connect).not.toHaveBeenCalled();
  });

  it('answers from the fixtures with no environment variables at all', async () => {
    await expect(loadCopy({ connect })).resolves.toMatchObject({ source: 'demo' });
    expect(connect).not.toHaveBeenCalled();
  });

  it('hands the rows on newest edit first, sorting nothing itself', async () => {
    const { rows } = await loadCopy({ connect });
    const updated = rows.map((row) => row.updatedAt.getTime());

    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('leaves the unattached row creativeName null and names the other three', async () => {
    const { rows } = await loadCopy({ connect });

    expect(rows.filter((row) => row.creativeName === null)).toHaveLength(1);
    expect(rows.filter((row) => row.creativeName !== null)).toHaveLength(3);
    for (const row of rows) {
      expect(row.creativeName === null).toBe(row.creativeBriefId === null);
    }
  });
});

describe('loadCreativeOptions in demo mode', () => {
  it('offers every demo brief by its auto-generated name, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const options = await loadCreativeOptions({ connect });

    expect(options).toEqual(demoBriefs.map((brief) => ({ id: brief.id, name: brief.name })));
    expect(options.every((option) => option.name !== '')).toBe(true);
    expect(connect).not.toHaveBeenCalled();
  });

  it('carries no "No creative" sentinel — the absent choice is not a brief', async () => {
    const options = await loadCreativeOptions({ connect });

    expect(options.some((option) => option.id === '')).toBe(false);
  });
});

describe('loadCopyWorkspace in demo mode', () => {
  it('returns both halves of the page from the fixtures, with no client constructed', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    const result = await loadCopyWorkspace({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoCopy);
    expect(result.creatives).toHaveLength(demoBriefs.length);
    expect(connect).not.toHaveBeenCalled();
  });

  it('can name every attached row out of its own creative options', async () => {
    const { rows, creatives } = await loadCopyWorkspace({ connect });
    const names = new Map(creatives.map((option) => [option.id, option.name]));

    for (const row of rows) {
      if (row.creativeBriefId !== null) {
        expect(names.get(row.creativeBriefId)).toBe(row.creativeName);
      }
    }
  });
});

describe('loadCopyById in demo mode', () => {
  it('finds one fixture by id and misses an unknown id, without a connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const [first] = demoCopy;
    if (first === undefined) {
      throw new Error('the demo fixtures are empty');
    }

    await expect(loadCopyById(first.id, { connect })).resolves.toEqual({
      copy: first,
      source: 'demo',
    });
    await expect(loadCopyById('nope', { connect })).resolves.toEqual({
      copy: null,
      source: 'demo',
    });
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('withBrandScope in demo mode', () => {
  it('refuses a write outright, before any connection', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);

    await expect(withBrandScope(() => Promise.resolve('written'), { connect })).rejects.toThrow(
      /Demo mode/u,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('loadCopy in live mode', () => {
  it('opens a connection from DATABASE_URL and closes it even when the query throws', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const close = vi.fn(() => Promise.resolve());
    // A handle that fails on first use: enough to prove the `finally` closes the pool.
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const openings: string[] = [];

    await expect(
      loadCopy({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual([DATABASE_URL]);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('opens exactly one connection for the whole workspace', async () => {
    vi.stubEnv('DATABASE_URL', DATABASE_URL);
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const connectSpy = vi.fn(() => ({ db, close }));

    await expect(
      loadCopyWorkspace({
        demoMode: () => false,
        actorScope: () => Promise.resolve({ clerkOrgId: 'org-live', clerkUserId: null }),
        connect: connectSpy,
      }),
    ).rejects.toThrow('boom');

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

/**
 * GRATSI-MATCH QA (2026-10-04, `docs/audits/gratsi-column-diff-2026-10-04.md`): Gratsi's resolved
 * Meta Copywriting column set equals the Gratsi base's 30 Airtable fields — ordered and labelled
 * exactly as the base spells them — minus ONLY the five decision-doc-flagged fields
 * (docs/decisions.md, 2026-10-04):
 *
 *   - `Creative Reporting` (25), `Creative Sheet` (26), `(Internal) Creative Design 2` (30) —
 *     residual texts of converted links, 0-filled, excluded at import;
 *   - `(Internal) Creative Design` (28) — the second brief link the import collapsed into the one
 *     `creative_brief_id`;
 *   - `⚠️ Please Change the Status of the copy` (29) — the Airtable UI banner, the hidden
 *     sentinel row.
 *
 * Run on a migrated PGlite database through THE seed and THE resolver, so what production resolves
 * is what this asserts.
 */
describe('the Gratsi Meta Copywriting column set (GRATSI-MATCH 2026-10-04)', () => {
  async function seededColumns() {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const brandRows = await db.select().from(brands);
    const gratsi = brandRows.find((brand) => brand.slug === 'gratsi');
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
    return { db, gratsi };
  }

  it("resolves Gratsi to the Airtable field list, in the base's own order, minus only the flagged five", async () => {
    const { db, gratsi } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'copywriting');

    expect(
      resolved.map((column) => [column.displayOrder, column.columnKey, column.displayLabel]),
    ).toEqual([
      [1, 'copy_number', 'Copy #'],
      [2, 'status', 'Status'],
      [3, 'collections', 'Collections'],
      [4, 'product_id', 'Product'],
      [5, 'angle', 'Angle'],
      [6, 'primary_copy', 'Descriptions'],
      [7, 'headline', 'Headline'],
      [8, 'link_description', 'News Feed'],
      [9, 'cta', 'CTA'],
      [10, 'copywriting_campaigns', 'Campaign Code'],
      [11, 'offer', 'Offer'],
      [12, 'campaign_from_campaign', 'Campaign (from Campaign)'],
      [12, 'client_approval_status', 'Client Approval'],
      [13, 'code_from_campaign', 'Code (from Campaign)'],
      [14, 'funnel', 'Funnel'],
      [15, 'copywriting_copy_types', 'Copy Type'],
      [16, 'client_comment', "Client's Comment"],
      [17, 'creative_brief_id', 'Creative'],
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

  it('keeps every lookup column VIRTUAL — lookupRollup, never a stored column a write could reach', async () => {
    const { db, gratsi } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'copywriting');
    const virtual = resolved.filter((column) => column.formula !== null);

    expect(virtual.map((column) => column.columnKey).sort()).toEqual([
      'angle',
      'campaign_from_campaign',
      'code_from_campaign',
      'collection_url',
      'collections',
      'internal_product',
      'link_from_product',
      'offer',
      'products_from_collections',
    ]);
    expect(virtual.every((column) => column.formula === 'lookupRollup')).toBe(true);
  });

  it('resolves the template to its own full eleven-field base, Copy # and the reverse-link Collection included', async () => {
    const { db } = await seededColumns();
    const brandRows = await db.select().from(brands);
    const template = brandRows.find((brand) => brand.isTemplate);
    if (template === undefined) throw new Error('the seed has no template brand');

    const resolved = await resolveColumns(db, template.id, 'copywriting');
    expect(resolved.map((column) => [column.displayOrder, column.displayLabel])).toEqual([
      [1, 'Copy #'],
      [2, 'Creative'],
      [3, 'Status'],
      [4, 'Collection'],
      [5, 'Product'],
      [6, 'Primary Copy'],
      [7, 'Headline'],
      [8, 'News Feed / Link Description'],
      [9, 'CTA'],
      [10, 'USED'],
      [12, 'Client Approval'],
    ]);
  });
});

/**
 * The lookup cells, proved over a live-shaped read: a Gratsi copy row linked to a campaign, a
 * product, a brief (with an angle) and a collection reads every looked-up value through
 * `loadCopyWorkspace` + `buildCopyItems` — the exact pipeline the page runs.
 */
describe('the Meta Copywriting lookup cells over PGlite (GRATSI-MATCH 2026-10-04)', () => {
  function liveDeps(
    db: Db,
    activeBrandId: string,
  ): CopySourceDeps & {
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

    const [angleRow] = await db
      .insert(angles)
      .values({ brandId: gratsi.id, name: 'Your Body Clock Is Not Broken' })
      .returning();
    const [brief] = await db
      .insert(creativeBriefs)
      .values({ brandId: gratsi.id, name: 'TV1-B1-Test-V1', angleId: angleRow?.id })
      .returning();
    const [product] = await db
      .insert(products)
      .values({ brandId: gratsi.id, name: 'Reset Bundle', link: 'https://gratsi.test/reset' })
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
      .insert(copywriting)
      .values({
        brandId: gratsi.id,
        copyNumber: 7,
        creativeBriefId: brief?.id,
        productId: product?.id,
      })
      .returning();
    if (copyRow === undefined || campaign === undefined) throw new Error('fixture insert failed');
    await db
      .insert(copywritingCampaigns)
      .values({ copyId: copyRow.id, campaignOfferId: campaign.id });
    await db.insert(collections).values({
      brandId: gratsi.id,
      name: 'BFCM 2026 Collection',
      url: 'https://gratsi.test/collections/bfcm',
      productId: product?.id,
      copywritingId: copyRow.id,
    });

    const workspace = await loadCopyWorkspace(liveDeps(db, gratsi.id));
    expect(workspace.source).toBe('database');
    const [item] = buildCopyItems(
      {
        rows: workspace.rows,
        campaigns: workspace.campaigns,
        collections: workspace.collections,
        products: workspace.products,
        briefLookups: workspace.briefLookups,
        copyTypes: [],
      },
      new Date('2026-10-04T09:00:00.000Z'),
    );
    if (item === undefined) throw new Error('the Gratsi copy row did not come back');

    // Each lookup cell is the linked row's value — the seeded column's lookupRollup, resolved.
    expect(item.angleName).toBe('Your Body Clock Is Not Broken');
    expect(item.productName).toBe('Reset Bundle');
    expect(item.productLink).toBe('https://gratsi.test/reset');
    expect(item.offer).toBe('20%OFF');
    expect(item.campaignNames).toBe('BFCM-20%OFF-BFCM26');
    expect(item.campaignCodes).toBe('BFCM26');
    expect(item.collections.map((collection) => collection.label)).toEqual([
      'BFCM 2026 Collection',
    ]);
    expect(item.collectionUrls).toBe('https://gratsi.test/collections/bfcm');
    expect(item.collectionProducts).toBe('Reset Bundle');
    expect(item.title).toBe('Copy #7');

    // An unlinked row resolves every lookup to null — the em dash, never a leak from a neighbour.
    const [bare] = await db
      .insert(copywriting)
      .values({ brandId: gratsi.id, copyNumber: 8 })
      .returning();
    const second = await loadCopyWorkspace(liveDeps(db, gratsi.id));
    const bareItem = buildCopyItems(
      {
        rows: second.rows,
        campaigns: second.campaigns,
        collections: second.collections,
        products: second.products,
        briefLookups: second.briefLookups,
        copyTypes: [],
      },
      new Date('2026-10-04T09:00:00.000Z'),
    ).find((candidate) => candidate.id === bare?.id);

    expect(bareItem).toMatchObject({
      angleName: null,
      productName: null,
      productLink: null,
      offer: null,
      campaignNames: null,
      campaignCodes: null,
      collectionUrls: null,
      collectionProducts: null,
      collections: [],
    });
  });
});
