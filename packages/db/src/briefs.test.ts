import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getBriefById,
  insertBrief,
  listBriefs,
  updateBrief,
  type BriefInput,
  type BriefListRow,
} from './briefs';
import { DEMO_BRAND_ID, STANDALONE_CONCEPT_SLUG, demoBriefs, demoConcepts } from './demo-data';
import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  BRIEF_INTERNAL_STATUS_DEFAULT,
  angles,
  concepts,
  creativeBriefs,
  creativeFunnels,
  creativePlatforms,
  creativePriorities,
  creativeSources,
  creativeTypes,
  products,
  type CreativeBrief,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';

/** The newest demo brief — the approved night-shift video — past `noUncheckedIndexedAccess`. */
function demoBrief(): BriefListRow {
  const [row] = demoBriefs;
  if (row === undefined) throw new Error('demoBriefs is empty');
  return row;
}

/** The one standalone fixture (PRD §8): no concept, so nothing to inherit. */
function standaloneBrief(): BriefListRow {
  const row = demoBriefs.find((brief) => brief.conceptId === null);
  if (row === undefined) throw new Error('demoBriefs has no standalone brief');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('migration 0006 on PGlite', () => {
  it('keeps concept_id NULLABLE: a static can exist with no parent concept', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ column_name: string; is_nullable: string }>(
      sql`select column_name, is_nullable
          from information_schema.columns
          where table_name = 'creative_briefs' and column_name in ('concept_id', 'brand_id', 'name')
          order by column_name`,
    );

    // CLAUDE.md non-negotiable 5 and PRD §8. If this ever reads 'NO', the migration is wrong.
    expect(rows).toEqual([
      { column_name: 'brand_id', is_nullable: 'NO' },
      { column_name: 'concept_id', is_nullable: 'YES' },
      { column_name: 'name', is_nullable: 'NO' },
    ]);
  });

  it('creates the version, sequence, jsonb array and QA defaults', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`select column_name, data_type, is_nullable, column_default
          from information_schema.columns
          where table_name = 'creative_briefs'
            and column_name in ('version', 'sequence', 'inspo_links', 'dimensions',
                                'qa_video_editor', 'qa_designer', 'qa_strategist',
                                'internal_status', 'client_status', 'performance')
          order by column_name`,
    );

    expect(rows).toEqual([
      {
        column_name: 'client_status',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: `'pending_for_approval'::text`,
      },
      {
        column_name: 'dimensions',
        data_type: 'jsonb',
        is_nullable: 'NO',
        column_default: `'[]'::jsonb`,
      },
      {
        column_name: 'inspo_links',
        data_type: 'jsonb',
        is_nullable: 'NO',
        column_default: `'[]'::jsonb`,
      },
      {
        column_name: 'internal_status',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: `'sent_to_video_editor'::text`,
      },
      // Nullable: a creative has no performance until it has run (PRD §5.10).
      {
        column_name: 'performance',
        data_type: 'text',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        column_name: 'qa_designer',
        data_type: 'boolean',
        is_nullable: 'NO',
        column_default: 'false',
      },
      {
        column_name: 'qa_strategist',
        data_type: 'boolean',
        is_nullable: 'NO',
        column_default: 'false',
      },
      {
        column_name: 'qa_video_editor',
        data_type: 'boolean',
        is_nullable: 'NO',
        column_default: 'false',
      },
      { column_name: 'sequence', data_type: 'integer', is_nullable: 'NO', column_default: '1' },
      { column_name: 'version', data_type: 'integer', is_nullable: 'NO', column_default: '1' },
    ]);
  });

  it('adds no pg enum: the vocabularies live in packages/domain', async () => {
    const db = await testDb();

    // Same decision as `concepts.internal_status` (see `schema/briefs.ts`): a pg enum here would be
    // a second copy of a list `@tas/domain/creatives` owns, needing a migration to say something the
    // database never enforces.
    const { rows } = await db.execute<{ typname: string }>(
      sql`select t.typname from pg_type t
          where t.typname in ('creative_source', 'creative_funnel', 'creative_type',
                              'creative_priority', 'creative_platform', 'creative_performance')`,
    );

    expect(rows).toEqual([]);
  });

  it('defaults every managed column when a row states only its name', async () => {
    const { db, brandId } = await seeded();

    const row = await insertBrief(db, brandId, { name: 'TS9-B9-Bare-V1' }, 'user_test');

    expect(row).toMatchObject({
      conceptId: null,
      source: 'TAS',
      funnel: 'TOF',
      type: 'Video',
      version: 1,
      sequence: 1,
      inspoLinks: [],
      dimensions: [],
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
      internalStatus: BRIEF_INTERNAL_STATUS_DEFAULT,
      clientStatus: BRIEF_CLIENT_STATUS_DEFAULT,
      performance: null,
    });
    expect(BRIEF_INTERNAL_STATUS_DEFAULT).toBe('sent_to_video_editor');
    expect(BRIEF_CLIENT_STATUS_DEFAULT).toBe('pending_for_approval');
  });

  it('accepts a brief with no concept at all, which is the PRD §8 case', async () => {
    const { db, brandId } = await seeded();

    const row = await insertBrief(
      db,
      brandId,
      { name: 'RS9-B9-Standalone-V1', type: 'Static', funnel: 'Retargeting' },
      'user_test',
    );

    expect(row.conceptId).toBeNull();
    expect(await getBriefById(db, brandId, row.id)).toMatchObject({
      conceptName: null,
      angleName: null,
      productName: null,
    });
  });
});

describe('brief fixtures', () => {
  it('seeds the seven fixtures row for row, everything inherited included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoBriefs).toHaveLength(7);
    expect(await listBriefs(db, brandId)).toEqual(demoBriefs);
  });

  it('names every brief with the PRD §7 formula, never by hand', () => {
    const funnelLetter: Record<string, string> = { TOF: 'T', Retargeting: 'R', 'All Funnels': 'A' };
    const formatLetter: Record<string, string> = {
      Video: 'V',
      Static: 'S',
      Carousel: 'C',
      'Motion Image': 'M',
    };

    for (const row of demoBriefs) {
      const concept = demoConcepts.find((item) => item.id === row.conceptId);
      // A linked brief's concept segment is the concept name minus its batch prefix; a standalone
      // brief's is the slug. Every part has to be really there, so a null cannot slide into the
      // template literal and make a hand-typed name pass by accident.
      const batch = row.batch;
      expect(batch).not.toBeNull();
      const segment =
        concept === undefined
          ? STANDALONE_CONCEPT_SLUG
          : concept.name.slice(`${concept.batch ?? ''}-`.length);
      const head = `${funnelLetter[row.funnel] ?? ''}${formatLetter[row.type] ?? ''}${String(row.sequence)}`;
      expect(row.name.startsWith(`${head}-${batch ?? ''}-${segment}-V${String(row.version)}`)).toBe(
        true,
      );
    }

    expect(demoBriefs.map((row) => row.name)).toEqual([
      'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
      'TS1-B2-It Is Not Just Your Age-Green Screen-V1',
      'AM1-B2-Make 9am Look Like 3am-POV: X vs Y-V1',
      'TV2-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
      // The optional §7 product suffix, on the one brief whose concept does not name the product.
      'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE',
      'TC1-B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style-V1',
      // The launched control: a third TOF video on the B1 concept, so the §7 number is 3.
      'TV3-B1-Your Body Clock Is Not Broken-Problem/Solution-V1',
    ]);
  });

  it('increments the number per funnel+format combination within the brand', () => {
    // PRD §7: "the number increments per funnel+format combination". Three TOF videos, so 1, 2 and
    // 3; every other combination is used once, so 1.
    const byCombination = new Map<string, number[]>();
    for (const row of demoBriefs) {
      const key = `${row.funnel}|${row.type}`;
      byCombination.set(key, [...(byCombination.get(key) ?? []), row.sequence]);
    }

    for (const [, sequences] of byCombination) {
      expect([...sequences].sort((a, b) => a - b)).toEqual(
        sequences.map((_, index) => index + 1).sort((a, b) => a - b),
      );
    }
    expect(byCombination.get('TOF|Video')?.sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  /**
   * The status spread feeds TWO boards off these same rows, so it is pinned here rather than left
   * to whichever page happens to read it. The Internal Queue groups by `internalStatus`; the Client
   * Queue groups by `clientStatus` and admits a row only when the internal status opens the client
   * track (`isClientTrackOpen` in `@tas/domain/state`: `approved` or `launched`) AND the client
   * status is not `launched` (PRD §9). Three rows stay pre-Approved so the internal board keeps
   * cards, three are internally Approved so the client board has both its columns filled, and the
   * launched row is on the internal board and off the client one.
   */
  it('spreads the internal statuses across both boards, three of them Approved', () => {
    const internal = demoBriefs.map((row) => row.internalStatus);

    expect(internal).toEqual([
      'approved',
      'static_design_in_progress',
      'ad_submitted',
      'approved',
      'approved',
      'sent_to_video_editor',
      'launched',
    ]);
    // Three pre-Approved rows in three different states, so the Internal Queue board is populated
    // early, mid and per track rather than collapsing into one column.
    const preApproved = internal.filter((key) => key !== 'approved' && key !== 'launched');
    expect(preApproved).toEqual([
      'static_design_in_progress',
      'ad_submitted',
      'sent_to_video_editor',
    ]);
    expect(new Set(preApproved).size).toBe(3);
    // At least one sits before Ad Submitted, so the stepper is visibly early somewhere.
    expect(internal).toContain('sent_to_video_editor');
  });

  it('pairs the client statuses so the client board fills and Launched is excluded', () => {
    // The gate, spelled out rather than imported: `@tas/db` does not depend on `@tas/domain`, and
    // this is the truth table `isClientTrackOpen` implements.
    const trackOpen = (internal: string): boolean =>
      internal === 'approved' || internal === 'launched';
    const onClientBoard = demoBriefs.filter(
      (row) => trackOpen(row.internalStatus) && row.clientStatus !== 'launched',
    );

    expect(demoBriefs.map((row) => row.clientStatus)).toEqual([
      'pending_for_approval',
      'pending_for_approval',
      'pending_for_approval',
      'pending_for_approval',
      'approved',
      'pending_for_approval',
      'launched',
    ]);
    // Four rows are past internal sign-off, but only three reach the client board: the launched
    // creative is excluded by its CLIENT status, which is the PRD §9 rule this fixture exercises.
    expect(demoBriefs.filter((row) => trackOpen(row.internalStatus))).toHaveLength(4);
    expect(onClientBoard).toHaveLength(3);
    expect(onClientBoard.filter((row) => row.clientStatus === 'pending_for_approval')).toHaveLength(
      2,
    );
    expect(onClientBoard.filter((row) => row.clientStatus === 'approved')).toHaveLength(1);
    // The one client-approved row is the standalone bundle static, so the client board renders a
    // card whose concept, angle and product all join null (PRD §8).
    expect(onClientBoard.find((row) => row.clientStatus === 'approved')).toMatchObject({
      id: standaloneBrief().id,
      conceptId: null,
      conceptName: null,
      angleName: null,
      productName: null,
    });
    // Exactly one launched creative, and it never reaches the client board.
    const launched = demoBriefs.filter((row) => row.internalStatus === 'launched');
    expect(launched).toHaveLength(1);
    expect(launched[0]).toMatchObject({ clientStatus: 'launched', performance: 'Winning' });
    expect(onClientBoard.map((row) => row.id)).not.toContain(launched[0]?.id);
  });

  it('covers all four types and keeps exactly one standalone brief', () => {
    expect(new Set(demoBriefs.map((row) => row.type))).toEqual(
      new Set(['Video', 'Static', 'Carousel', 'Motion Image']),
    );
    expect(demoBriefs.filter((row) => row.conceptId === null)).toHaveLength(1);
    // The standalone row inherits nothing, and that is the ordinary case, not a broken link.
    expect(standaloneBrief()).toMatchObject({
      conceptId: null,
      conceptName: null,
      angleName: null,
      productName: null,
      type: 'Static',
    });
    // Every linked brief points at a real seeded concept and does inherit.
    for (const row of demoBriefs.filter((brief) => brief.conceptId !== null)) {
      expect(demoConcepts.some((concept) => concept.id === row.conceptId)).toBe(true);
      expect(row.conceptName).not.toBeNull();
      expect(row.angleName).not.toBeNull();
      expect(row.productName).not.toBeNull();
    }
  });

  it('carries the PRD §8 dimension defaults for its type', () => {
    for (const row of demoBriefs) {
      const expected =
        row.type === 'Static' || row.type === 'Carousel' ? ['1:1', '9:16'] : ['4:5', '1:1', '9:16'];
      expect(row.dimensions).toEqual(expected);
    }
  });

  it('carries real agency content, never a stub', () => {
    for (const row of demoBriefs) {
      expect(row.briefToDesign?.length ?? 0).toBeGreaterThan(400);
      expect(row.scriptContent?.length ?? 0).toBeGreaterThan(200);
      expect(row.elementsTested?.length ?? 0).toBeGreaterThan(250);
      expect(row.assignee?.length ?? 0).toBeGreaterThan(4);
      expect(creativeSources).toContain(row.source);
      expect(creativeFunnels).toContain(row.funnel);
      expect(creativeTypes).toContain(row.type);
      expect(creativePriorities).toContain(row.priority);
      expect(creativePlatforms).toContain(row.platform);
      expect(row.inspoLinks.every((link) => link.startsWith('https://'))).toBe(true);
      expect(row.brandId).toBe(DEMO_BRAND_ID);
      // Every id is a hardcoded uuid, so the seed's foreign keys survive a restart.
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  /**
   * The Internal Queue board (PRD §9/§13) draws one card per brief and puts a PERSON on every card,
   * so a null assignee would render a card belonging to nobody. It also offers a "Mine" view, which
   * is only a filter if the six briefs share a small team rather than holding six different names.
   * Both facts are fixture invariants, not page logic, so they are pinned here: the queue reads
   * these rows through the existing `listBriefs`, and this test is what stops a later fixture edit
   * from emptying a card or turning "Mine" into "All".
   */
  it('assigns every brief to a named member of the demo team, several each', () => {
    const assignees = demoBriefs.map((row) => row.assignee);

    for (const assignee of assignees) {
      expect(assignee).not.toBeNull();
      expect(assignee?.trim()).toBe(assignee);
      // A full name, so a card reads as a person and not as a handle.
      expect(assignee).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
    // A team small enough that every member owns more than one card, so "Mine" narrows the board
    // to a real subset instead of showing one card or all six.
    const team = new Set(assignees);
    expect(team.size).toBeLessThan(demoBriefs.length);
    for (const member of team) {
      expect(assignees.filter((name) => name === member).length).toBeGreaterThan(1);
    }
    expect(team).toEqual(new Set(['Dorian Vance', 'Rhiannon Okafor', 'Imogen Bardsley']));
  });

  it('spreads inspiration across providers and fills one spelling feedback', () => {
    const links = demoBriefs.flatMap((row) => row.inspoLinks);
    const providers = ['facebook.com/ads/library', 'youtube.com', 'tiktok.com', 'instagram.com'];

    expect(demoBriefs.filter((row) => row.inspoLinks.length > 0).length).toBeGreaterThanOrEqual(2);
    for (const provider of providers) {
      expect(links.some((link) => link.includes(provider))).toBe(true);
    }
    const spelled = demoBriefs.filter((row) => row.spellingFeedback !== null);
    expect(spelled).toHaveLength(1);
    expect(spelled[0]?.spellingFeedback?.length ?? 0).toBeGreaterThan(200);
  });
});

describe('brief queries', () => {
  it('orders by updated_at desc, newest edit first', async () => {
    const { db, brandId } = await seeded();

    const rows = await listBriefs(db, brandId);

    expect(rows.map((row) => row.name)).toEqual(demoBriefs.map((row) => row.name));
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('inherits the concept name, the angle and the product through the concept', async () => {
    const { db, brandId } = await seeded();

    const row = await getBriefById(db, brandId, demoBrief().id);

    expect(row).toMatchObject({
      conceptName: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
      angleName: 'Your Body Clock Is Not Broken',
      productName: 'Niagara Deep Sleep Weighted Blanket',
    });
  });

  it('joins null cleanly for a standalone brief and for a soft-deleted concept', async () => {
    const { db, brandId } = await seeded();

    expect(await getBriefById(db, brandId, standaloneBrief().id)).toMatchObject({
      conceptId: null,
      conceptName: null,
      angleName: null,
      productName: null,
    });

    // The linked concept of the newest brief is soft-deleted; the brief stays, everything it
    // inherited through that concept — the angle and the product included — goes.
    await db
      .update(concepts)
      .set({ deletedAt: new Date() })
      .where(eq(concepts.id, demoBrief().conceptId ?? ''));

    expect(await getBriefById(db, brandId, demoBrief().id)).toMatchObject({
      conceptId: demoBrief().conceptId,
      conceptName: null,
      angleName: null,
      productName: null,
    });
  });

  it('drops the angle and the product when only the angle behind the concept is gone', async () => {
    const { db, brandId } = await seeded();

    await db
      .update(angles)
      .set({ deletedAt: new Date() })
      .where(eq(angles.id, demoConcepts[0]?.angleId ?? ''));

    const rows = await listBriefs(db, brandId);
    const affected = rows.filter((row) => row.conceptId === demoConcepts[0]?.id);

    expect(affected.length).toBeGreaterThan(0);
    for (const row of affected) {
      expect(row.conceptName).not.toBeNull();
      expect(row.angleName).toBeNull();
      expect(row.productName).toBeNull();
    }
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listBriefs(db, otherBrandId)).toEqual([]);
    expect(await getBriefById(db, otherBrandId, demoBrief().id)).toBeNull();

    await db
      .update(creativeBriefs)
      .set({ deletedAt: new Date() })
      .where(eq(creativeBriefs.id, demoBrief().id));

    expect(await listBriefs(db, brandId)).toHaveLength(6);
    expect(await getBriefById(db, brandId, demoBrief().id)).toBeNull();
  });

  it('never leaks another brand’s briefs into the list', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    await withBrand(db, otherBrandId).insert(creativeBriefs, {
      name: 'TV1-B1-Template Concept-V1',
      type: 'Video',
    });

    expect((await listBriefs(db, brandId)).map((row) => row.id)).toEqual(
      demoBriefs.map((row) => row.id),
    );
    expect((await listBriefs(db, otherBrandId)).map((row) => row.name)).toEqual([
      'TV1-B1-Template Concept-V1',
    ]);
  });

  it('never leaks another brand’s concept, angle or product through the inherited names', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // A concept of the OTHER brand, with its own angle and product, pointed at by this brand's
    // brief: the scoped reads behind the join never see it, so every inherited name comes back null
    // rather than wrong.
    const [foreignProduct] = await db
      .insert(products)
      .values({ brandId: otherBrandId, name: 'Template product', link: 'https://example.com' })
      .returning();
    const [foreignAngle] = await db
      .insert(angles)
      .values({ brandId: otherBrandId, productId: foreignProduct?.id, name: 'Template angle' })
      .returning();
    const [foreignConcept] = await db
      .insert(concepts)
      .values({ brandId: otherBrandId, angleId: foreignAngle?.id, name: 'B1-Template-Concept' })
      .returning();
    await db
      .update(creativeBriefs)
      .set({ conceptId: foreignConcept?.id })
      .where(eq(creativeBriefs.id, demoBrief().id));

    const row = await getBriefById(db, brandId, demoBrief().id);

    expect(row).toMatchObject({
      conceptName: null,
      angleName: null,
      productName: null,
      brandId,
    });
  });

  it('returns null for an unknown id rather than throwing', async () => {
    const { db, brandId } = await seeded();

    expect(await getBriefById(db, brandId, '99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('insertBrief forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a hand-built payload would make.
    const smuggled = {
      name: 'TC2-B5-Smuggled-V1',
      brandId: otherBrandId,
      type: 'Carousel',
      sequence: 2,
      dimensions: ['1:1', '9:16'],
      internalStatus: 'ad_submitted',
    } as unknown as BriefInput;

    const row = await insertBrief(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'TC2-B5-Smuggled-V1',
      type: 'Carousel',
      sequence: 2,
      internalStatus: 'ad_submitted',
      clientStatus: BRIEF_CLIENT_STATUS_DEFAULT,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listBriefs(db, brandId)).toHaveLength(8);
    expect(await listBriefs(db, otherBrandId)).toEqual([]);
  });

  it('updateBrief advances a status in the scope and cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoBriefs.find((row) => row.internalStatus === 'ad_submitted');
    const id = target?.id ?? '';

    const escaped = await updateBrief(db, otherBrandId, id, { name: 'Hijacked' }, 'thief');
    const own = await updateBrief(
      db,
      brandId,
      id,
      { internalStatus: 'approved', qaStrategist: true, version: 2 },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id,
      brandId,
      internalStatus: 'approved',
      clientStatus: 'pending_for_approval',
      qaStrategist: true,
      version: 2,
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target?.updatedAt.getTime() ?? 0);
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoBriefs).toEqualTypeOf<BriefListRow[]>();
    expectTypeOf(await listBriefs(db, brandId)).toEqualTypeOf<BriefListRow[]>();
    expectTypeOf<BriefListRow>().toExtend<CreativeBrief>();
    expectTypeOf<BriefListRow['conceptId']>().toEqualTypeOf<string | null>();
    expectTypeOf<BriefListRow['conceptName']>().toEqualTypeOf<string | null>();
    expectTypeOf<BriefListRow['angleName']>().toEqualTypeOf<string | null>();
    expectTypeOf<BriefListRow['productName']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<BriefInput>().not.toHaveProperty('brandId');
    expectTypeOf<BriefInput>().not.toHaveProperty('createdBy');
    expectTypeOf<BriefInput>().toHaveProperty('conceptId');
    expectTypeOf<BriefInput>().toHaveProperty('inspoLinks');
    expectTypeOf<BriefInput>().toHaveProperty('dimensions');
    expectTypeOf<BriefInput>().toHaveProperty('internalStatus');
    expectTypeOf<BriefInput>().toHaveProperty('clientStatus');
  });
});
