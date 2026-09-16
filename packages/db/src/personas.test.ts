import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { listConcepts } from './concepts';
import {
  DEMO_BRAND_ID,
  demoAngles,
  demoConcepts,
  demoPersonas,
  demoProducts,
  demoThemes,
} from './demo-data';
import {
  getPersonaById,
  insertPersona,
  listPersonas,
  updatePersona,
  type PersonaInput,
  type PersonaListRow,
} from './personas';
import { awarenessStages, personas, themes, type Persona } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';
import { listThemes } from './themes';

/** The first demo persona, past `noUncheckedIndexedAccess`. */
function demoPersona(): PersonaListRow {
  const [row] = demoPersonas;
  if (row === undefined) throw new Error('demoPersonas is empty');
  return row;
}

/** Drizzle wraps a driver error as `Failed query: ...` and keeps the Postgres error in `cause`. */
async function rejection(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error: unknown) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  throw new Error('expected the query to be rejected');
}

/** A fresh database with migration 0002 applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('migration 0002 on PGlite', () => {
  it('applies, creating the awareness_stage enum with the five PRD §5.4 stages', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{ enumlabel: string }>(
      sql`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'awareness_stage' order by e.enumsortorder`,
    );

    expect(rows.map((row) => row.enumlabel)).toEqual([...awarenessStages]);
    expect(awarenessStages).toEqual([
      'unaware',
      'problem_aware',
      'solution_aware',
      'product_aware',
      'most_aware',
    ]);
  });

  it('seeds the demo content into the child brand, identical to the fixtures', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(await listPersonas(db, brandId)).toEqual(demoPersonas);
    expect(await listThemes(db)).toEqual(demoThemes);
    expect(await listConcepts(db, brandId)).toEqual(demoConcepts);
    expect(demoProducts).toHaveLength(3);
    expect(demoAngles).toHaveLength(5);
  });

  it('rejects a theme that carries a brand: the global library is a check constraint', async () => {
    const { db, brandId } = await seeded();

    expect(
      await rejection(
        db.execute(
          sql`insert into themes (brand_id, name, category)
              values (${brandId}, 'Branded theme', 'Framework')`,
        ),
      ),
    ).toMatch(/themes_global/);
    expect(await db.select().from(themes)).toHaveLength(demoThemes.length);
  });
});

describe('persona queries', () => {
  it('lists the brand’s three personas, newest edit first, with the joined product name', async () => {
    const { db, brandId } = await seeded();

    const rows = await listPersonas(db, brandId);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.name)).toEqual(demoPersonas.map((row) => row.name));
    expect(rows.map((row) => row.productName)).toEqual([
      'Niagara Deep Sleep Weighted Blanket',
      'Niagara Cooling Blackout Sleep Mask',
      'Niagara Deep Sleep Weighted Blanket',
    ]);
    // Ordered by updated_at desc, not by insertion order.
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listPersonas(db, otherBrandId)).toEqual([]);
    expect(await getPersonaById(db, otherBrandId, demoPersona().id)).toBeNull();

    await db
      .update(personas)
      .set({ deletedAt: new Date() })
      .where(sql`${personas.id} = ${demoPersona().id}`);

    expect(await listPersonas(db, brandId)).toHaveLength(2);
    expect(await getPersonaById(db, brandId, demoPersona().id)).toBeNull();
  });

  it('reads one persona by id with its product name, null when there is no product', async () => {
    const { db, brandId } = await seeded();

    const row = await getPersonaById(db, brandId, demoPersona().id);
    const detached = await insertPersona(db, brandId, { name: 'No product yet' }, 'user_test');

    expect(row).toEqual(demoPersona());
    expect(await getPersonaById(db, brandId, detached.id)).toMatchObject({
      name: 'No product yet',
      productName: null,
    });
  });

  it('insertPersona forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      name: 'Smuggled persona',
      brandId: otherBrandId,
      stageOfAwareness: 'unaware',
    } as unknown as PersonaInput;

    const row = await insertPersona(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled persona',
      stageOfAwareness: 'unaware',
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listPersonas(db, brandId)).toHaveLength(4);
    expect(await listPersonas(db, otherBrandId)).toEqual([]);
  });

  it('updatePersona cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoPersona();

    const escaped = await updatePersona(db, otherBrandId, target.id, { name: 'Hijacked' }, 'thief');
    const own = await updatePersona(db, brandId, target.id, { name: 'Renamed' }, 'user_test');

    expect(escaped).toBeNull();
    expect(own).toMatchObject({ id: target.id, brandId, name: 'Renamed', updatedBy: 'user_test' });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoPersonas).toEqualTypeOf<PersonaListRow[]>();
    expectTypeOf(await listPersonas(db, brandId)).toEqualTypeOf<PersonaListRow[]>();
    expectTypeOf<PersonaListRow>().toExtend<Persona>();
    expectTypeOf<PersonaListRow['productName']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<PersonaInput>().not.toHaveProperty('brandId');
    expectTypeOf<PersonaInput>().not.toHaveProperty('createdBy');
    expectTypeOf<PersonaInput>().toHaveProperty('dayInTheLife');
    expectTypeOf<PersonaInput>().toHaveProperty('triggerWords');
  });
});
