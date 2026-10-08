import {
  angles,
  brands,
  collections,
  conceptAngles,
  concepts,
  copywriting,
  creativeBriefs,
  creativeModuleDesigns,
  creativeModules,
  creativeSheetItems,
  demoCreativeSheetItems,
  products,
  resolveColumns,
  seed,
  seedColumnDefinitions,
  type Db,
} from '@tas/db';
import { testDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSheetItems } from '@/app/app/creative-sheet/build-items';

import {
  loadCreativeSheetItems,
  loadCreativeSheetWorkspace,
  type CreativeSheetSourceDeps,
} from './creative-sheet-source';

const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

describe('loadCreativeSheetWorkspace in demo mode', () => {
  it('answers from the fixtures and constructs no database client, even with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const result = await loadCreativeSheetWorkspace({ connect });

    expect(result.source).toBe('demo');
    expect(result.rows).toEqual(demoCreativeSheetItems);
    expect(result.briefLookups.length).toBeGreaterThan(0);
    expect(connect).not.toHaveBeenCalled();
  });

  it('still lists rows through the single-list loader unchanged', async () => {
    const result = await loadCreativeSheetItems({ connect });
    expect(result.rows).toEqual(demoCreativeSheetItems);
    expect(connect).not.toHaveBeenCalled();
  });
});

/**
 * GRATSI-MATCH QA (2026-10-04, `docs/audits/gratsi-column-diff-2026-10-04.md`): Gratsi's resolved
 * Creative Sheet column set equals the Gratsi base's 29 Airtable fields — ordered and labelled
 * exactly as the base spells them — minus NOTHING: no field of this table is decision-doc-flagged.
 * The thirteen `Creative Name` lookups are alive in Gratsi's base (its `Creative Name` is a real
 * link); only the TEMPLATE's twelve copies are dead, seed nothing for the parent, and keep every
 * inheriting brand at the template's own fifteen (docs/decisions/overnight-dead-lookups.md).
 */
describe('the Gratsi Creative Sheet column set (GRATSI-MATCH 2026-10-04)', () => {
  async function seededColumns() {
    const db = await testDb();
    await seed(db);
    await seedColumnDefinitions(db);
    const brandRows = await db.select().from(brands);
    const gratsi = brandRows.find((brand) => brand.slug === 'gratsi');
    if (gratsi === undefined) throw new Error('the seed has no gratsi brand');
    return { db, gratsi };
  }

  it("resolves Gratsi to ALL 29 Airtable fields, in the base's own order, nothing flagged", async () => {
    const { db, gratsi } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'creative_sheet_items');

    expect(
      resolved.map((column) => [column.displayOrder, column.columnKey, column.displayLabel]),
    ).toEqual([
      [1, 'name', 'Name'],
      [2, 'brief_id', 'Creative Name'],
      [3, 'performance', 'Performance (from Creative Name)'],
      [4, 'internal_product', '(Internal) Product (from Creative Name)'],
      [5, 'angle', 'Angle (from Creative Name)'],
      [6, 'concepts_from_angle', 'Concepts (from Angle) (from Creative Name)'],
      [7, 'elements_we_are_testing', 'Elements we are Testing'],
      [8, 'design_file', 'Design File (from Creative Name)'],
      [9, 'design_link_url', 'Design Link URL'],
      [10, 'internal_status', 'Internal Status'],
      [11, 'status', 'Status'],
      [12, 'qa_checklist_doc', 'QA Checklist Doc'],
      [13, 'qa_video_editor', 'Video Editor QA'],
      [14, 'qa_designer', 'Graphic Designer QA'],
      [15, 'qa_strategist', 'Creative Strategist QA'],
      [16, 'client_comments', "Client's Comments"],
      [17, 'collection', 'Collection'],
      [18, 'platform', 'Platform'],
      [19, 'funnel', 'Funnel'],
      [20, 'type', 'Type'],
      [21, 'proposed_copy', 'Proposed Copy'],
      [22, 'creative_module', 'Creative Module'],
      [23, 'used', 'Used'],
      [24, 'denied_revisions_needed', 'Denied/revisions needed'],
      [25, 'winning', 'Winning'],
      [26, 'created_at', 'Created'],
      [27, 'updated_at', 'Last Modified'],
      [28, 'spell_check_requested', 'Click for AI Spell Checker Again'],
      [29, 'spelling_feedback', 'Spelling Feedback'],
      [30, 'client_approval_status', 'Client Approval'],
    ]);
  });

  it('keeps all thirteen lookups VIRTUAL (lookupRollup) and the two timestamps stored', async () => {
    const { db, gratsi } = await seededColumns();
    const resolved = await resolveColumns(db, gratsi.id, 'creative_sheet_items');
    const virtual = resolved.filter((column) => column.formula !== null);

    expect(virtual.map((column) => column.columnKey).sort()).toEqual([
      'angle',
      'collection',
      'concepts_from_angle',
      'creative_module',
      'design_file',
      'design_link_url',
      'elements_we_are_testing',
      'funnel',
      'internal_product',
      'name',
      'performance',
      'platform',
      'proposed_copy',
      'type',
    ]);
    // `name` keeps its own formula; every lookup names THE one lookup formula.
    expect(
      virtual
        .filter((column) => column.columnKey !== 'name')
        .every((column) => column.formula === 'lookupRollup'),
    ).toBe(true);
    const stored = new Map(resolved.map((column) => [column.columnKey, column.formula]));
    expect(stored.get('created_at')).toBeNull();
    expect(stored.get('updated_at')).toBeNull();
  });

  it("keeps the inheriting set at the template's own fifteen — the dead twelve resolve for no one", async () => {
    const { db } = await seededColumns();
    const brandRows = await db.select().from(brands);
    const niagara = brandRows.find((brand) => brand.slug === 'niagara-sleep-solutions');
    if (niagara === undefined) throw new Error('the seed has no niagara brand');

    const resolved = await resolveColumns(db, niagara.id, 'creative_sheet_items');
    expect(resolved).toHaveLength(16);
    expect(resolved.map((column) => column.displayLabel)).toContain('Last Modified');
    for (const deadLookup of [
      'performance',
      'angle',
      'collection',
      'proposed_copy',
      'creative_module',
    ]) {
      expect(resolved.some((column) => column.columnKey === deadLookup)).toBe(false);
    }
  });
});

/**
 * The lookup cells, proved over a live-shaped read: a Gratsi sheet row linked to a brief — which
 * carries an angle, a product, a collection, a module, two Meta copies and its own stored fields —
 * reads every looked-up value through `loadCreativeSheetWorkspace` + `buildSheetItems`, the exact
 * pipeline the page runs.
 */
describe('the Creative Sheet lookup cells over PGlite (GRATSI-MATCH 2026-10-04)', () => {
  function liveDeps(db: Db, activeBrandId: string): CreativeSheetSourceDeps {
    return {
      demoMode: () => false,
      connect: () => ({ db, close: () => Promise.resolve() }),
      actorScope: () => Promise.resolve({ clerkOrgId: null, clerkUserId: 'user_seed_csm' }),
      activeBrandId: () => Promise.resolve(activeBrandId),
    };
  }

  it('each lookup column carries the linked value; a brief-less row resolves them all to null', async () => {
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
    const [product] = await db
      .insert(products)
      .values({ brandId: gratsi.id, name: 'Night Reset Bundle', link: 'https://gratsi.test/nrb' })
      .returning();
    const [collection] = await db
      .insert(collections)
      .values({ brandId: gratsi.id, name: 'BFCM 2026 Collection' })
      .returning();
    const [concept] = await db
      .insert(concepts)
      .values({ brandId: gratsi.id, name: 'B1-Body Clock-Sleep Science' })
      .returning();
    const [module] = await db
      .insert(creativeModules)
      .values({ brandId: gratsi.id, moduleName: 'Problem/Solution' })
      .returning();
    const [brief] = await db
      .insert(creativeBriefs)
      .values({
        brandId: gratsi.id,
        name: 'TV1-B1-Body Clock-V2',
        angleId: angleRow?.id,
        productId: product?.id,
        collectionId: collection?.id,
        elementsTested: 'Hook: circadian framing',
        designFile: ['r2://design/tv1-b1-v2.mp4', 'r2://design/tv1-b1-v2.jpg'],
        designFileUrl: 'https://drive.gratsi.test/tv1-b1-v2',
        platform: ['Meta', 'TikTok'],
        funnel: 'Retargeting',
        type: 'Video',
        performance: 'Winning',
      })
      .returning();
    if (brief === undefined || angleRow === undefined || concept === undefined) {
      throw new Error('fixture insert failed');
    }
    if (module === undefined) throw new Error('fixture insert failed');
    await db.insert(conceptAngles).values({ conceptId: concept.id, angleId: angleRow.id });
    await db.insert(creativeModuleDesigns).values({ moduleId: module.id, briefId: brief.id });
    await db.insert(copywriting).values([
      { brandId: gratsi.id, copyNumber: 1, creativeBriefId: brief.id },
      { brandId: gratsi.id, copyNumber: 3, creativeBriefId: brief.id },
    ]);
    const [sheetRow] = await db
      .insert(creativeSheetItems)
      .values({ brandId: gratsi.id, briefId: brief.id })
      .returning();
    const [bareRow] = await db
      .insert(creativeSheetItems)
      .values({ brandId: gratsi.id })
      .returning();

    const workspace = await loadCreativeSheetWorkspace(liveDeps(db, gratsi.id));
    expect(workspace.source).toBe('database');
    const items = buildSheetItems(workspace, new Date('2026-10-04T09:00:00.000Z'));

    const linked = items.find((view) => view.item.id === sheetRow?.id);
    if (linked === undefined) throw new Error('the linked sheet row did not come back');
    expect(linked.lookups).toEqual({
      performance: 'Winning',
      internalProduct: 'Night Reset Bundle',
      angle: 'Your Body Clock Is Not Broken',
      conceptsFromAngle: 'B1-Body Clock-Sleep Science',
      elementsWeAreTesting: 'Hook: circadian framing',
      designFiles: ['r2://design/tv1-b1-v2.mp4', 'r2://design/tv1-b1-v2.jpg'],
      designLinkUrl: 'https://drive.gratsi.test/tv1-b1-v2',
      collection: 'BFCM 2026 Collection',
      platform: 'Meta, TikTok',
      funnel: 'Retargeting',
      type: 'Video',
      // The linked copies' generated titles (never typed), in the order the copy rows arrived.
      proposedCopy: expect.stringMatching(/^Copy #\d, Copy #\d$/) as string,
      creativeModule: 'Problem/Solution',
    });

    const bare = items.find((view) => view.item.id === bareRow?.id);
    expect(bare?.lookups).toEqual({
      performance: null,
      internalProduct: null,
      angle: null,
      conceptsFromAngle: null,
      elementsWeAreTesting: null,
      designFiles: [],
      designLinkUrl: null,
      collection: null,
      platform: null,
      funnel: null,
      type: null,
      proposedCopy: null,
      creativeModule: null,
    });
  });
});
