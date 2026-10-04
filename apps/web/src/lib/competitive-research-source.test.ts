import {
  brands,
  competitiveResearch,
  demoCompetitiveResearch,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadCompetitiveResearch,
  loadCompetitiveResearchColumns,
  type CompetitiveResearchSourceDeps,
} from './competitive-research-source';

/**
 * GRATSI-MATCH competitive_research (2026-10-04): the table is identical in both bases — seven
 * stored fields, no flags, no Gratsi rows — so the wire is a pure conversion: the grid now draws
 * what the resolver returns, which adds the three stored-but-undrawn columns (FB Page, Meta Ads
 * Library, Analysis) and drops the platform-only `Updated` column, per the standing
 * gratsi-display-spec ruling. This table has no link columns at all, so the per-table loader test
 * proves the live loader carries the three newly drawn fields instead of a reverse link.
 */
const COMPETITIVE_RESEARCH_LABELS = [
  'Name',
  'Type',
  'Website',
  'Insta',
  'FB Page',
  'Meta Ads Library',
  'Analysis',
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
function pgliteDeps(db: Db, brandId: string): CompetitiveResearchSourceDeps {
  return {
    demoMode: () => false,
    connect: () => ({ db, close: () => Promise.resolve() }),
    actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
    activeBrandId: () => Promise.resolve(brandId),
  };
}

describe('the competitive_research column set, resolved per brand (PGlite)', () => {
  it("equals Gratsi's Airtable field list — all seven, inherited, in field order", async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'gratsi'),
      'competitive_research',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(COMPETITIVE_RESEARCH_LABELS);
    expect(resolved.every((column) => column.inheritedFrom !== null)).toBe(true);
  });

  it('gives an inheriting brand the same seven, in the same order', async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'niagara-sleep-solutions'),
      'competitive_research',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(COMPETITIVE_RESEARCH_LABELS);
  });
});

describe('loadCompetitiveResearchColumns in demo mode', () => {
  it('returns the parent master set and constructs no database client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadCompetitiveResearchColumns({ connect });

    expect(result.source).toBe('demo');
    expect(result.unconfigured).toBe(false);
    expect(result.columns.map((column) => column.displayLabel)).toEqual(
      COMPETITIVE_RESEARCH_LABELS,
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the demo fixtures renderable under that set — the three new cells have data', async () => {
    const { rows } = await loadCompetitiveResearch({ connect });
    expect(rows).toEqual(demoCompetitiveResearch);
    expect(rows.some((row) => row.facebookPage !== null)).toBe(true);
    expect(rows.some((row) => row.metaAdsLibrary !== null)).toBe(true);
    expect(rows.some((row) => row.analysis !== null)).toBe(true);
  });
});

describe('the live loader behind the three newly drawn columns (PGlite, rows seeded here)', () => {
  it('carries facebook_page, meta_ads_library and analysis through the scoped read', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await seededDb();
    const gratsiId = await brandIdBySlug(db, 'gratsi');

    await db.insert(competitiveResearch).values({
      brandId: gratsiId,
      name: 'Casper Sleep',
      type: 'Competitor',
      facebookPage: 'https://facebook.com/casper',
      metaAdsLibrary: 'Heavy Q4 spending; static-led.',
      analysis: 'Polished but low on UGC.',
    });

    const { rows, source } = await loadCompetitiveResearch(pgliteDeps(db, gratsiId));
    const row = rows.find((candidate) => candidate.name === 'Casper Sleep');

    expect(source).toBe('database');
    expect(row?.facebookPage).toBe('https://facebook.com/casper');
    expect(row?.metaAdsLibrary).toBe('Heavy Q4 spending; static-led.');
    expect(row?.analysis).toBe('Polished but low on UGC.');
  });
});
