import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getAngleById,
  insertAngle,
  listAngles,
  updateAngle,
  type AngleInput,
  type AngleListRow,
} from './angles';
import { DEMO_BRAND_ID, demoAngles, demoPersonas, demoProducts } from './demo-data';
import { angleFormats, angleTypes, angles, personas, products, type Angle } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/** The newest demo angle — Denise's, the one carrying two of everything — past `noUncheckedIndexedAccess`. */
function demoAngle(): AngleListRow {
  const [row] = demoAngles;
  if (row === undefined) throw new Error('demoAngles is empty');
  return row;
}

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

describe('migration 0003 on PGlite', () => {
  it('widens type to jsonb and adds the PRD §5.6 columns with their empty defaults', async () => {
    const db = await testDb();

    const { rows } = await db.execute<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      sql`select column_name, data_type, is_nullable from information_schema.columns
          where table_name = 'angles'
            and column_name in ('type', 'formats', 'ad_inspo_links', 'potential', 'winning',
                                'internal_notes', 'client_notes')
          order by column_name`,
    );

    expect(rows).toEqual([
      { column_name: 'ad_inspo_links', data_type: 'jsonb', is_nullable: 'NO' },
      { column_name: 'client_notes', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'formats', data_type: 'jsonb', is_nullable: 'NO' },
      { column_name: 'internal_notes', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'potential', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'type', data_type: 'jsonb', is_nullable: 'NO' },
      { column_name: 'winning', data_type: 'boolean', is_nullable: 'NO' },
    ]);
  });

  it('creates the angle_format and angle_type enums in the PRD §5.6 order', async () => {
    const db = await testDb();

    const labels = async (name: string): Promise<string[]> => {
      const { rows } = await db.execute<{ enumlabel: string }>(
        sql`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
            where t.typname = ${name} order by e.enumsortorder`,
      );
      return rows.map((row) => row.enumlabel);
    };

    expect(await labels('angle_format')).toEqual([...angleFormats]);
    expect(await labels('angle_type')).toEqual([...angleTypes]);
    expect(angleFormats).toEqual(['Static', 'Video', 'Carousel', 'Motion Graphic']);
    expect(angleTypes).toEqual(['Emotional', 'Functional', 'Identity', 'Critical']);
  });

  it('defaults the three jsonb arrays and winning when a row states none of them', async () => {
    const { db, brandId } = await seeded();

    const row = await insertAngle(db, brandId, { name: 'Bare angle' }, 'user_test');

    expect(row).toMatchObject({ type: [], formats: [], adInspoLinks: [], winning: false });
    expect(row).toMatchObject({ potential: null, internalNotes: null, clientNotes: null });
  });
});

describe('angle queries', () => {
  it('seeds the five fixtures row for row, joined names included', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(demoAngles).toHaveLength(5);
    expect(await listAngles(db, brandId)).toEqual(demoAngles);
  });

  it('spreads the five angles across the three personas, one persona carrying two', async () => {
    const { db, brandId } = await seeded();

    const rows = await listAngles(db, brandId);
    const perPersona = new Map<string, number>();
    for (const row of rows) {
      const key = row.personaId ?? 'none';
      perPersona.set(key, (perPersona.get(key) ?? 0) + 1);
    }

    expect(perPersona.size).toBe(demoPersonas.length);
    expect([...perPersona.values()].sort()).toEqual([1, 2, 2]);
    // Every angle is a real hypothesis with formats and ad inspiration, not a stub.
    for (const row of rows) {
      expect(row.description?.length ?? 0).toBeGreaterThan(200);
      expect(row.painPoints?.length ?? 0).toBeGreaterThan(80);
      expect(row.usp?.length ?? 0).toBeGreaterThan(80);
      expect(row.formats.length).toBeGreaterThanOrEqual(1);
      expect(row.formats.length).toBeLessThanOrEqual(3);
      expect(row.formats.every((format) => angleFormats.includes(format))).toBe(true);
      expect(row.type.every((type) => angleTypes.includes(type))).toBe(true);
      expect(row.adInspoLinks.length).toBeGreaterThanOrEqual(1);
      expect(row.adInspoLinks.length).toBeLessThanOrEqual(2);
      expect(row.adInspoLinks.every((link) => link.startsWith('https://'))).toBe(true);
    }
  });

  it('orders by updated_at desc, newest edit first', async () => {
    const { db, brandId } = await seeded();

    const rows = await listAngles(db, brandId);

    expect(rows.map((row) => row.name)).toEqual([
      'It Is Not Just Your Age',
      'Your Body Clock Is Not Broken',
      'Make 9am Look Like 3am',
      'Sleep In The Ninety Minutes You Actually Get',
      'Nobody Wins The Thermostat Argument',
    ]);
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listAngles(db, otherBrandId)).toEqual([]);
    expect(await getAngleById(db, otherBrandId, demoAngle().id)).toBeNull();

    await db
      .update(angles)
      .set({ deletedAt: new Date() })
      .where(sql`${angles.id} = ${demoAngle().id}`);

    expect(await listAngles(db, brandId)).toHaveLength(4);
    expect(await getAngleById(db, brandId, demoAngle().id)).toBeNull();
  });

  it('never leaks another brand’s persona or product name into the join', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // A persona and a product of the OTHER brand, pointed at by one of this brand's angles: the
    // scoped reads behind the join never see them, so both names come back null rather than wrong.
    const [foreignPersona] = await db
      .insert(personas)
      .values({ brandId: otherBrandId, name: 'Template persona' })
      .returning();
    const [foreignProduct] = await db
      .insert(products)
      .values({ brandId: otherBrandId, name: 'Template product', link: 'https://example.com' })
      .returning();
    await db
      .update(angles)
      .set({ personaId: foreignPersona?.id, productId: foreignProduct?.id })
      .where(sql`${angles.id} = ${demoAngle().id}`);

    const row = await getAngleById(db, brandId, demoAngle().id);

    expect(row).toMatchObject({ personaName: null, productName: null });
    expect(await listAngles(db, otherBrandId)).toEqual([]);
  });

  it('joins null cleanly for an unlinked angle and for a soft-deleted link', async () => {
    const { db, brandId } = await seeded();

    const unlinked = await insertAngle(
      db,
      brandId,
      { name: 'Drafted before research' },
      'user_test',
    );
    // The linked persona of the newest angle is soft-deleted; the angle stays, the name goes.
    await db
      .update(personas)
      .set({ deletedAt: new Date() })
      .where(sql`${personas.id} = ${demoAngle().personaId}`);

    expect(await getAngleById(db, brandId, unlinked.id)).toMatchObject({
      name: 'Drafted before research',
      personaId: null,
      personaName: null,
      productId: null,
      productName: null,
    });
    expect(await getAngleById(db, brandId, demoAngle().id)).toMatchObject({
      personaId: demoAngle().personaId,
      personaName: null,
      productName: demoAngle().productName,
    });
  });

  it('insertAngle forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      name: 'Smuggled angle',
      brandId: otherBrandId,
      type: ['Critical'],
      formats: ['Carousel'],
      adInspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
      winning: true,
    } as unknown as AngleInput;

    const row = await insertAngle(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled angle',
      type: ['Critical'],
      formats: ['Carousel'],
      winning: true,
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listAngles(db, brandId)).toHaveLength(6);
    expect(await listAngles(db, otherBrandId)).toEqual([]);
  });

  it('updateAngle cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoAngle();

    const escaped = await updateAngle(db, otherBrandId, target.id, { name: 'Hijacked' }, 'thief');
    const own = await updateAngle(
      db,
      brandId,
      target.id,
      { formats: ['Static', 'Motion Graphic'], winning: false, potential: null },
      'user_test',
    );

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      formats: ['Static', 'Motion Graphic'],
      winning: false,
      potential: null,
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });

  it('exposes one row type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoAngles).toEqualTypeOf<AngleListRow[]>();
    expectTypeOf(await listAngles(db, brandId)).toEqualTypeOf<AngleListRow[]>();
    expectTypeOf<AngleListRow>().toExtend<Angle>();
    expectTypeOf<AngleListRow['personaName']>().toEqualTypeOf<string | null>();
    expectTypeOf<AngleListRow['productName']>().toEqualTypeOf<string | null>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<AngleInput>().not.toHaveProperty('brandId');
    expectTypeOf<AngleInput>().not.toHaveProperty('createdBy');
    expectTypeOf<AngleInput>().toHaveProperty('formats');
    expectTypeOf<AngleInput>().toHaveProperty('adInspoLinks');
    expectTypeOf<AngleInput>().toHaveProperty('internalNotes');
    expectTypeOf<AngleInput>().toHaveProperty('clientNotes');
  });

  it('keeps the demo products’ concept counts consistent with the four demo concepts', async () => {
    const { db, brandId } = await seeded();

    const rows = await listAngles(db, brandId);

    // Four concepts hang off four of these five angles (PRD §5.7): two on blanket angles and two on
    // mask angles, none on the bundle angle, so `listProducts` reports 2 / 2 / 0 and the fixtures
    // stay consistent with `demoProducts`.
    expect(rows.filter((row) => row.productId === demoProducts[0]?.id)).toHaveLength(2);
    expect(demoProducts.map((product) => product.conceptCount)).toEqual([2, 2, 0]);
  });
});
