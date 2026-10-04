import {
  brands,
  creativeBriefs,
  creativeDimensions,
  demoCreativeDimensions,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { linkedDesignsForDimension } from '@/app/app/creative-dimensions/fields';

import { loadBriefs } from './briefs-source';
import {
  loadCreativeDimensionColumns,
  loadCreativeDimensions,
  type CreativeDimensionSourceDeps,
} from './creative-dimensions-source';

/**
 * GRATSI-MATCH creative_dimensions (2026-10-04): the table is identical in both bases — four
 * fields, no flags — so Gratsi and an inheriting brand resolve the SAME set, and Gratsi's rows are
 * all inherited. The fourth field, `(Internal) Creative Design`, is the reverse of the briefs'
 * `Dimensions` link, keyed by the `creative_design_id` column the schema reserved for the brief
 * link (no junction exists; `import-mappings.ts` stores the far side by placement name in
 * `creative_briefs.dimensions`).
 */
const DIMENSION_LABELS = ['Name', 'Dimensions', 'Link Description', '(Internal) Creative Design'];

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
function pgliteDeps(db: Db, brandId: string): CreativeDimensionSourceDeps {
  return {
    demoMode: () => false,
    connect: () => ({ db, close: () => Promise.resolve() }),
    actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
    activeBrandId: () => Promise.resolve(brandId),
  };
}

describe('the creative_dimensions column set, resolved per brand (PGlite)', () => {
  it("equals Gratsi's Airtable field list — all four, inherited, in field order", async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'gratsi'),
      'creative_dimensions',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(DIMENSION_LABELS);
    // Identical in both bases: Gratsi departs nowhere, so every column is read through.
    expect(resolved.every((column) => column.inheritedFrom !== null)).toBe(true);
    // The reverse link is keyed by the stored uuid column the schema reserved for it.
    expect(
      resolved.find((column) => column.displayLabel === '(Internal) Creative Design')?.columnKey,
    ).toBe('creative_design_id');
  });

  it('gives an inheriting brand the same four, in the same order', async () => {
    const db = await seededDb();

    const resolved = await resolveColumns(
      db,
      await brandIdBySlug(db, 'niagara-sleep-solutions'),
      'creative_dimensions',
    );

    expect(resolved.map((column) => column.displayLabel)).toEqual(DIMENSION_LABELS);
  });
});

describe('loadCreativeDimensionColumns in demo mode', () => {
  it('returns the parent master set and constructs no database client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadCreativeDimensionColumns({ connect });

    expect(result.source).toBe('demo');
    expect(result.unconfigured).toBe(false);
    expect(result.columns.map((column) => column.displayLabel)).toEqual(DIMENSION_LABELS);
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps the demo fixtures renderable under that set, stored brief link included', async () => {
    const { rows } = await loadCreativeDimensions({ connect });
    expect(rows).toEqual(demoCreativeDimensions);
    // The fixtures exercise the stored side of the reverse link, so the demo cell is not empty.
    expect(rows.some((row) => row.creativeDesignId !== null)).toBe(true);
  });
});

describe("the `(Internal) Creative Design` reverse-link column's names (PGlite, rows seeded here)", () => {
  it('carries the briefs matched by placement name AND by the stored uuid, deduped', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = await seededDb();
    const gratsiId = await brandIdBySlug(db, 'gratsi');
    const deps = pgliteDeps(db, gratsiId);

    // The Gratsi import writes the briefs' Dimensions link as placement NAMES, so the reverse
    // match is on the dimension's name; `creative_design_id` is the stored single link.
    const [byUuid] = await db
      .insert(creativeBriefs)
      .values({ brandId: gratsiId, name: 'TV1-B1-BFCM-V1', dimensions: [] })
      .returning({ id: creativeBriefs.id });
    if (byUuid === undefined) throw new Error('insert returned no brief');
    await db.insert(creativeBriefs).values([
      { brandId: gratsiId, name: 'TS2-B1-BFCM-V1', dimensions: ['IG Story / Reel', '1:1'] },
      { brandId: gratsiId, name: 'TV9-B9-OTHER-V1', dimensions: ['4:5'] },
    ]);
    await db.insert(creativeDimensions).values({
      brandId: gratsiId,
      name: 'IG Story / Reel',
      dimensions: '1080x1920',
      creativeDesignId: byUuid.id,
    });

    const dimensionRows = await loadCreativeDimensions(deps);
    const briefRows = await loadBriefs(deps);
    const row = dimensionRows.rows.find((candidate) => candidate.name === 'IG Story / Reel');
    if (row === undefined) throw new Error('the seeded dimension did not load');

    const labels = linkedDesignsForDimension(row, briefRows.rows)
      .map((design) => design.label)
      .sort();
    expect(labels).toEqual(['TS2-B1-BFCM-V1', 'TV1-B1-BFCM-V1']);
  });
});
