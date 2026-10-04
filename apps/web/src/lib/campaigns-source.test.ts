import {
  brands,
  campaignsOffers,
  collections,
  demoCampaigns,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadCampaignColumns, loadCampaigns, type CampaignSourceDeps } from './campaigns-source';
import { loadCollections } from './collections-source';

/**
 * GRATSI-MATCH campaigns_offers (2026-10-04): the displayed column set equals the Gratsi base's
 * own field list — 20 Airtable fields minus the two rule-5 flags recorded in `docs/decisions.md`
 * ("GRATSI-MATCH campaigns_offers"): `Product` (a lookup through Collections whose underlying
 * field is the register-excluded text remnant, nothing stored to resolve it through) and
 * `Design attached` (the register's "loose single-line text with no target"). Order is the Gratsi
 * base's field order. The gate runs on PGlite through the SAME resolver production reads.
 */
const GRATSI_CAMPAIGN_LABELS = [
  'Name',
  'Holiday',
  'Official Date',
  'Country',
  'Description',
  'Promotional Ideas',
  'Interested',
  'Launched',
  'Ads Launch Date',
  'Ads End Date',
  'Discount Offer',
  'Code',
  'Collections',
  'COPY',
  'Angles',
  'Email Campaigns',
  'Email Campaigns Management copy',
  'Ads Copywriting copy',
];

/** The template base's own 14 fields minus `Design attached` (rule-5, register-excluded). */
const PARENT_CAMPAIGN_LABELS = [
  'Name',
  'Holiday',
  'Official Date',
  'Country',
  'Description',
  'Confirmed by Client',
  'Launched',
  'Ads Launch Date',
  'Ads End Date',
  'Discount Offer',
  'Code',
  'Collections',
  '(Internal) Product',
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
function pgliteDeps(db: Db, brandId: string): CampaignSourceDeps {
  return {
    demoMode: () => false,
    connect: () => ({ db, close: () => Promise.resolve() }),
    // Any seeded member of the one agency; the brand switcher cookie picks the brand under test.
    actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
    activeBrandId: () => Promise.resolve(brandId),
  };
}

describe('the campaigns_offers column set, resolved per brand (PGlite)', () => {
  it("equals Gratsi's Airtable field list minus the two flagged fields, in Airtable order", async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'gratsi'),
      'campaigns_offers',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(GRATSI_CAMPAIGN_LABELS);
    // The two flags never resolve: no column exists for either, under any label.
    expect(resolved.map((column) => column.displayLabel)).not.toContain('Product');
    expect(resolved.map((column) => column.displayLabel)).not.toContain('Design attached');
    // `(Internal) Product` is hidden for Gratsi, never dropped — the parent row stays.
    expect(resolved.map((column) => column.columnKey)).not.toContain('product_id');
    // Every reverse link is keyed by the junction/table carrying the FK back to campaigns_offers.
    for (const key of [
      'collections',
      'youtube_copy_campaigns',
      'campaign_concepts',
      'email_campaign_campaigns',
      'email_flow_campaigns',
      'copywriting_campaigns',
    ]) {
      expect(resolved.map((column) => column.columnKey)).toContain(key);
    }
  });

  it('gives an inheriting brand the template base fields under the PARENT labels, in order', async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'niagara-sleep-solutions'),
      'campaigns_offers',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(PARENT_CAMPAIGN_LABELS);
    // The materialised Airtable formula is a STORED column, not a virtual one (schema/campaigns.ts).
    const name = resolved.find((column) => column.columnKey === 'name');
    expect(name?.formula).toBeNull();
    expect(name?.displayOrder).toBe(1);
  });
});

describe('loadCampaignColumns in demo mode', () => {
  it('returns the parent master set and constructs no database client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadCampaignColumns({ connect });

    expect(result.source).toBe('demo');
    expect(result.unconfigured).toBe(false);
    expect(result.columns.map((column) => column.displayLabel)).toEqual(PARENT_CAMPAIGN_LABELS);
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the demo campaign fixtures renderable under that set', async () => {
    const { rows } = await loadCampaigns({ connect });
    expect(rows).toEqual(demoCampaigns);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the `Collections` reverse-link column's names (PGlite, rows seeded here)", () => {
  it('carries the names of the collections whose campaign_id points at the campaign', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await seededDb();
    const gratsiId = await brandIdBySlug(db, 'gratsi');
    const deps = pgliteDeps(db, gratsiId);

    const [campaign] = await db
      .insert(campaignsOffers)
      .values({ brandId: gratsiId, name: 'BFCM-20%OFF-BFCM26' })
      .returning({ id: campaignsOffers.id });
    if (campaign === undefined) throw new Error('insert returned no campaign');
    await db.insert(collections).values([
      { brandId: gratsiId, name: 'BFCM Bundles', campaignId: campaign.id },
      { brandId: gratsiId, name: 'Gift Sets', campaignId: campaign.id },
      { brandId: gratsiId, name: 'Unlinked', campaignId: null },
    ]);

    // The page's one pass: campaigns and collections through their own loaders, inverted by id.
    const campaigns = await loadCampaigns(deps);
    const linked = await loadCollections(deps);

    expect(campaigns.source).toBe('database');
    expect(campaigns.rows.map((row) => row.id)).toContain(campaign.id);
    const names = linked.rows
      .filter((row) => row.campaignId === campaign.id)
      .map((row) => row.name)
      .sort();
    expect(names).toEqual(['BFCM Bundles', 'Gift Sets']);
    // And the owning side resolves the campaign's generated name for its own column.
    expect(linked.rows.find((row) => row.name === 'BFCM Bundles')?.campaignName).toBe(
      'BFCM-20%OFF-BFCM26',
    );
  });
});
