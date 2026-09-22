import { eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getConceptById,
  insertConcept,
  listConcepts,
  updateConcept,
  type ConceptInput,
  type ConceptListRow,
} from './concepts';
import { DEMO_BRAND_ID, demoAngles, demoConcepts, demoThemes } from './demo-data';
import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  CONCEPT_INTERNAL_STATUS_DEFAULT,
  angleFormats,
  angles,
  conceptAngles,
  conceptThemes,
  concepts,
  personas,
  products,
  themes,
  type Concept,
} from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { withBrand } from './tenancy';

/** The newest demo concept — Denise's green-screen build — past `noUncheckedIndexedAccess`. */
function demoConcept(): ConceptListRow {
  const [row] = demoConcepts;
  if (row === undefined) throw new Error('demoConcepts is empty');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('migration 0005 on PGlite', () => {
  it('adds the two jsonb arrays and the two status columns with their defaults', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`select column_name, data_type, is_nullable, column_default
          from information_schema.columns
          where table_name = 'concepts'
            and column_name in ('formats', 'ad_inspo_links', 'internal_status', 'client_status')
          order by column_name`,
    );

    expect(rows).toEqual([
      {
        column_name: 'ad_inspo_links',
        data_type: 'jsonb',
        is_nullable: 'NO',
        column_default: `'[]'::jsonb`,
      },
      {
        column_name: 'client_status',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: `'pending_for_approval'::text`,
      },
      {
        column_name: 'formats',
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
    ]);
  });

  it('keeps the two statuses out of pg_type: the state machine is the only vocabulary', async () => {
    const db = await testDb();

    // Deliberately NOT pg enums. `packages/domain/src/state` owns the set of states, its
    // transitions and the client gate; an enum here would be a second, silently diverging copy that
    // needed a migration every time the machine gained a state.
    const { rows } = await db.execute<{ typname: string }>(
      sql`select t.typname from pg_type t
          where t.typname in ('internal_status', 'client_status', 'creative_status')`,
    );

    expect(rows).toEqual([]);
  });

  it('defaults both arrays and both statuses when a row states none of them', async () => {
    const { db, brandId } = await seeded();

    const row = await insertConcept(db, brandId, { name: 'B4-Bare-Concept' }, 'user_test');

    expect(row).toMatchObject({
      formats: [],
      adInspoLinks: [],
      internalStatus: CONCEPT_INTERNAL_STATUS_DEFAULT,
      clientStatus: CONCEPT_CLIENT_STATUS_DEFAULT,
      batch: null,
    });
    expect(CONCEPT_INTERNAL_STATUS_DEFAULT).toBe('sent_to_video_editor');
    expect(CONCEPT_CLIENT_STATUS_DEFAULT).toBe('pending_for_approval');
    // Junction arrays are empty when no links have been inserted yet.
    const full = await getConceptById(db, brandId, row.id);
    expect(full).toMatchObject({ angleIds: [], themeIds: [] });
  });
});

describe('concept fixtures', () => {
  it('seeds the four fixtures row for row, everything inherited included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoConcepts).toHaveLength(4);
    expect(await listConcepts(db, brandId)).toEqual(demoConcepts);
  });

  it('pairs four distinct seeded angles with four distinct seeded themes', () => {
    const angleIds = demoConcepts.map((row) => row.angleIds[0]);
    const themeIds = demoConcepts.map((row) => row.themeIds[0]);

    expect(new Set(angleIds).size).toBe(4);
    expect(new Set(themeIds).size).toBe(4);
    expect(angleIds.every((id) => demoAngles.some((angle) => angle.id === id))).toBe(true);
    expect(themeIds.every((id) => demoThemes.some((theme) => theme.id === id))).toBe(true);
  });

  it('names every concept with the Batch-Angle-Theme formula, never by hand', () => {
    // PRD §5.7 / CLAUDE.md non-negotiable 4: the name is generated from the pairing. Rebuilt here
    // from the linked rows, so a fixture that was typed rather than generated fails.
    for (const row of demoConcepts) {
      const angle = demoAngles.find((item) => item.id === row.angleIds[0]);
      const theme = demoThemes.find((item) => item.id === row.themeIds[0]);
      // Every part has to be really there: a `null` batch or an unresolved link would otherwise
      // slide into the template literal and make the rebuilt name pass by accident.
      const batch = row.batch;
      expect(batch).not.toBeNull();
      expect(angle).toBeDefined();
      expect(theme).toBeDefined();
      expect(row.name).toBe(`${batch ?? ''}-${angle?.name ?? ''}-${theme?.name ?? ''}`);
    }
    expect(demoConcepts.map((row) => row.name)).toEqual([
      'B2-It Is Not Just Your Age-Green Screen',
      'B1-Your Body Clock Is Not Broken-Problem/Solution',
      'B2-Make 9am Look Like 3am-POV: X vs Y',
      'B3-Sleep In The Ninety Minutes You Actually Get-Yapper Style',
    ]);
  });

  it('sits each concept in a different pre-Approved internal status, client track shut', () => {
    const internal = demoConcepts.map((row) => row.internalStatus);

    // The four states of the video track before sign-off, one each (`@tas/domain/state` keys).
    expect(internal).toEqual([
      'video_editing_in_progress',
      'videos_revisions',
      'ad_submitted',
      'sent_to_video_editor',
    ]);
    expect(new Set(internal).size).toBe(4);
    // None is `approved` or `launched`, so `isClientTrackOpen` is false on all four and the client
    // bar is closed on every demo row (PRD §9).
    expect(internal.some((key) => key === 'approved' || key === 'launched')).toBe(false);
    expect(demoConcepts.every((row) => row.clientStatus === 'pending_for_approval')).toBe(true);
  });

  it('carries real agency content, never a stub', () => {
    for (const row of demoConcepts) {
      expect(row.hookExamples?.length ?? 0).toBeGreaterThan(120);
      expect(row.scriptIdea?.length ?? 0).toBeGreaterThan(200);
      expect(row.formats.length).toBeGreaterThanOrEqual(1);
      expect(row.formats.every((format) => angleFormats.includes(format))).toBe(true);
      expect(row.adInspoLinks.length).toBeGreaterThanOrEqual(1);
      expect(row.adInspoLinks.every((link) => link.startsWith('https://'))).toBe(true);
      expect(row.category === 'New' || row.category === 'Iteration').toBe(true);
      expect(row.brandId).toBe(DEMO_BRAND_ID);
      // Every id is a hardcoded uuid, so the seed's foreign keys survive a restart.
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });
});

describe('concept queries', () => {
  it('orders by updated_at desc, newest edit first', async () => {
    const { db, brandId } = await seeded();

    const rows = await listConcepts(db, brandId);

    expect(rows.map((row) => row.batch)).toEqual(['B2', 'B1', 'B2', 'B3']);
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('inherits the angle’s name, persona, product, description, pain points and usp', async () => {
    const { db, brandId } = await seeded();

    const row = await getConceptById(db, brandId, demoConcept().id);
    const angle = demoAngles.find((item) => item.id === demoConcept().angleIds[0]);

    expect(row).toMatchObject({
      angleName: angle?.name,
      personaName: angle?.personaName,
      productName: angle?.productName,
      description: angle?.description,
      painPoints: angle?.painPoints,
      usp: angle?.usp,
      themeName: 'Green Screen',
    });
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listConcepts(db, otherBrandId)).toEqual([]);
    expect(await getConceptById(db, otherBrandId, demoConcept().id)).toBeNull();

    await db
      .update(concepts)
      .set({ deletedAt: new Date() })
      .where(eq(concepts.id, demoConcept().id));

    expect(await listConcepts(db, brandId)).toHaveLength(3);
    expect(await getConceptById(db, brandId, demoConcept().id)).toBeNull();
  });

  it('never leaks another brand’s rows into the list, even on the same theme', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The template brand builds its own concept on the SAME global theme: the library is shared,
    // the concepts are not.
    const [otherConcept] = await withBrand(db, otherBrandId)
      .insert(concepts, {
        name: 'B1-Template Angle-Green Screen',
      })
      .returning();
    if (otherConcept) {
      await db
        .insert(conceptThemes)
        .values({ conceptId: otherConcept.id, themeId: demoConcept().themeIds[0] ?? '' });
    }

    expect((await listConcepts(db, brandId)).map((row) => row.id)).toEqual(
      demoConcepts.map((row) => row.id),
    );
    expect((await listConcepts(db, otherBrandId)).map((row) => row.name)).toEqual([
      'B1-Template Angle-Green Screen',
    ]);
  });

  it('never leaks another brand’s angle, persona or product through the inherited fields', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // An angle of the OTHER brand, with its own persona and product, pointed at by this brand's
    // concept: the scoped reads behind the join never see it, so every inherited field comes back
    // null rather than wrong.
    await db.insert(personas).values({ brandId: otherBrandId, name: 'Template persona' });
    await db
      .insert(products)
      .values({ brandId: otherBrandId, name: 'Template product', link: 'https://example.com' });
    const [foreignAngle] = await db
      .insert(angles)
      .values({
        brandId: otherBrandId,
        name: 'Template angle',
        description: 'Template description',
        painPoints: 'Template pain points',
        usp: 'Template usp',
      })
      .returning();
    // Remove existing concept-angle links and replace with the foreign angle.
    await db.delete(conceptAngles).where(eq(conceptAngles.conceptId, demoConcept().id));
    if (foreignAngle) {
      await db
        .insert(conceptAngles)
        .values({ conceptId: demoConcept().id, angleId: foreignAngle.id });
    }

    const row = await getConceptById(db, brandId, demoConcept().id);

    expect(row).toMatchObject({
      angleName: null,
      personaName: null,
      productName: null,
      description: null,
      painPoints: null,
      usp: null,
    });
    // The concept itself is still this brand's and still carries its own stored columns.
    expect(row?.brandId).toBe(brandId);
    expect(row?.themeName).toBe('Green Screen');
  });

  it('joins null cleanly for an unlinked concept and for a soft-deleted link', async () => {
    const { db, brandId } = await seeded();

    const unlinked = await insertConcept(db, brandId, { name: 'B4-Drafted-Unpaired' }, 'user_test');
    // The linked angle of the newest concept is soft-deleted; the concept stays, everything it
    // inherited through that angle — the persona and the product included — goes.
    await db
      .update(angles)
      .set({ deletedAt: new Date() })
      .where(eq(angles.id, demoConcept().angleIds[0] ?? ''));
    // The global theme is soft-deleted too: the library read carries `deleted_at IS NULL`.
    await db
      .update(themes)
      .set({ deletedAt: new Date() })
      .where(eq(themes.id, demoConcept().themeIds[0] ?? ''));

    expect(await getConceptById(db, brandId, unlinked.id)).toMatchObject({
      name: 'B4-Drafted-Unpaired',
      angleIds: [],
      angleName: null,
      themeIds: [],
      themeName: null,
      personaName: null,
      productName: null,
      description: null,
      painPoints: null,
      usp: null,
    });
    expect(await getConceptById(db, brandId, demoConcept().id)).toMatchObject({
      angleIds: demoConcept().angleIds,
      angleName: null,
      themeIds: demoConcept().themeIds,
      themeName: null,
      personaName: null,
      productName: null,
      description: null,
    });
  });

  it('returns null for an unknown id rather than throwing', async () => {
    const { db, brandId } = await seeded();

    expect(await getConceptById(db, brandId, '99999999-9999-4999-8999-999999999999')).toBeNull();
  });

  it('insertConcept forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a hand-built payload would make.
    const smuggled = {
      name: 'B4-Smuggled-Concept',
      brandId: otherBrandId,
      formats: ['Carousel'],
      adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
      internalStatus: 'ad_submitted',
    } as unknown as ConceptInput;

    const row = await insertConcept(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'B4-Smuggled-Concept',
      formats: ['Carousel'],
      internalStatus: 'ad_submitted',
      clientStatus: CONCEPT_CLIENT_STATUS_DEFAULT,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listConcepts(db, brandId)).toHaveLength(5);
    expect(await listConcepts(db, otherBrandId)).toEqual([]);
  });

  it('updateConcept advances a status in the scope and cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoConcept();

    const escaped = await updateConcept(db, otherBrandId, target.id, { name: 'Hijacked' }, 'thief');
    const own = await updateConcept(
      db,
      brandId,
      target.id,
      { internalStatus: 'ad_submitted', formats: ['Video'], adInspoLinks: [] },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      internalStatus: 'ad_submitted',
      clientStatus: 'pending_for_approval',
      formats: ['Video'],
      adInspoLinks: [],
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoConcepts).toEqualTypeOf<ConceptListRow[]>();
    expectTypeOf(await listConcepts(db, brandId)).toEqualTypeOf<ConceptListRow[]>();
    expectTypeOf<ConceptListRow>().toExtend<Concept>();
    expectTypeOf<ConceptListRow['angleName']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['themeName']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['personaName']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['productName']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['description']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['painPoints']>().toEqualTypeOf<string | null>();
    expectTypeOf<ConceptListRow['usp']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<ConceptInput>().not.toHaveProperty('brandId');
    expectTypeOf<ConceptInput>().not.toHaveProperty('createdBy');
    expectTypeOf<ConceptInput>().toHaveProperty('formats');
    expectTypeOf<ConceptInput>().toHaveProperty('adInspoLinks');
    expectTypeOf<ConceptInput>().toHaveProperty('internalStatus');
    expectTypeOf<ConceptInput>().toHaveProperty('clientStatus');
  });
});
