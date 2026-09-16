import { desc, eq, sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  agencies,
  brandAssignments,
  brands,
  healthCheck,
  memberships,
  users,
  type BrandAssignment,
  type NewBrandAssignment,
} from './schema';
import { seed } from './seed';
import {
  withBrand,
  type BrandedTable,
  type BrandScope,
  type ScopedSelect,
  type ScopedWrite,
} from './tenancy';
import { testDb, type PgliteDb } from './testing';

interface TwoBrands {
  db: PgliteDb;
  a: string;
  b: string;
  rowA: BrandAssignment;
  rowB: BrandAssignment;
  userId: string;
}

/** Two brands with one `brand_assignments` row each: A is the seeded child brand, B the template. */
async function twoBrands(): Promise<TwoBrands> {
  const db = await testDb();
  const { childBrand, templateBrand, admin, strategistAssignment } = await seed(db);
  const [rowB] = await db
    .insert(brandAssignments)
    .values({ userId: admin.id, brandId: templateBrand.id, role: 'csm' })
    .returning();
  if (rowB === undefined) throw new Error('brand_assignments insert returned no row');
  return {
    db,
    a: childBrand.id,
    b: templateBrand.id,
    rowA: strategistAssignment,
    rowB,
    userId: admin.id,
  };
}

async function liveRows(db: PgliteDb): Promise<BrandAssignment[]> {
  return db.select().from(brandAssignments);
}

describe('withBrand on PGlite', () => {
  it('select never returns the other brand’s row and takes an extra filter', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);

    expect(await scope.select(brandAssignments)).toEqual([rowA]);
    expect(await scope.select(brandAssignments, eq(brandAssignments.id, rowB.id))).toEqual([]);
    expect(
      await scope.select(brandAssignments, eq(brandAssignments.brandId, rowB.brandId)),
    ).toEqual([]);
    expect(await scope.select(brandAssignments, eq(brandAssignments.role, 'strategist'))).toEqual([
      rowA,
    ]);
    expect(
      await scope.select(brandAssignments).orderBy(desc(brandAssignments.id)).limit(1),
    ).toEqual([rowA]);
    expect(await withBrand(db, rowB.brandId).select(brandAssignments)).toEqual([rowB]);
  });

  it('keeps a raw filter with a top-level OR inside the scope', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);
    const wideOpen = sql`1 = 1 or 1 = 1`;

    expect(await scope.select(brandAssignments, wideOpen)).toEqual([rowA]);
    expect(await scope.update(brandAssignments, { role: 'csm' }, wideOpen).returning()).toEqual([
      { ...rowA, role: 'csm' },
    ]);
    expect(
      (await scope.softDelete(brandAssignments, wideOpen).returning()).map((r) => r.id),
    ).toEqual([rowA.id]);
    expect(await withBrand(db, rowB.brandId).select(brandAssignments)).toEqual([rowB]);
  });

  it('update targeting the other brand’s id changes zero rows', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);

    const escaped = await scope
      .update(brandAssignments, { role: 'designer' }, eq(brandAssignments.id, rowB.id))
      .returning();
    const own = await scope
      .update(brandAssignments, { role: 'designer' }, eq(brandAssignments.id, rowA.id))
      .returning();

    expect(escaped).toEqual([]);
    expect(own).toHaveLength(1);
    expect(await liveRows(db)).toEqual(
      expect.arrayContaining([{ ...rowA, role: 'designer' }, rowB]),
    );
  });

  it('update cannot move a row to another brand, whatever the payload says', async () => {
    const { db, a, b, rowA } = await twoBrands();
    const smuggled: { role: BrandAssignment['role']; brandId: string } = {
      role: 'csm',
      brandId: b,
    };

    const [updated] = await withBrand(db, a)
      .update(brandAssignments, smuggled, eq(brandAssignments.id, rowA.id))
      .returning();

    expect(updated).toMatchObject({ id: rowA.id, role: 'csm', brandId: a });
  });

  it('insert stores the scoped brand even when the payload carries brand B', async () => {
    const { db, a, b, userId } = await twoBrands();
    const payload: NewBrandAssignment = { userId, brandId: b, role: 'media_buyer' };

    const [inserted] = await withBrand(db, a).insert(brandAssignments, payload).returning();
    const [batch] = await withBrand(db, a)
      .insert(brandAssignments, [{ userId, role: 'designer' }])
      .returning();

    expect(inserted).toMatchObject({ userId, role: 'media_buyer', brandId: a });
    expect(batch).toMatchObject({ userId, role: 'designer', brandId: a });
    expect(await withBrand(db, b).select(brandAssignments)).toHaveLength(1);
  });

  it('softDelete only reaches the scoped brand’s live rows and hides them from select', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);

    const escaped = await scope
      .softDelete(brandAssignments, eq(brandAssignments.id, rowB.id))
      .returning();
    const own = await scope.softDelete(brandAssignments).returning();
    const again = await scope.softDelete(brandAssignments).returning();

    expect(escaped).toEqual([]);
    expect(own.map((row) => row.id)).toEqual([rowA.id]);
    expect(own[0]?.deletedAt).toBeInstanceOf(Date);
    expect(again).toEqual([]);
    expect(await scope.select(brandAssignments)).toEqual([]);
    expect(await scope.update(brandAssignments, { role: 'csm' }).returning()).toEqual([]);
    expect(await withBrand(db, rowB.brandId).select(brandAssignments)).toEqual([rowB]);
  });

  it('hands back no builder method that could replace or widen the scope', async () => {
    const { db, a, userId } = await twoBrands();
    const scope = withBrand(db, a);
    const write = scope.insert(brandAssignments, { userId, role: 'client' });

    expect(Object.keys(scope.select(brandAssignments)).sort()).toEqual([
      'limit',
      'orderBy',
      'then',
    ]);
    expect(Object.keys(write).sort()).toEqual(['returning', 'then']);
    expect(Object.keys(scope.update(brandAssignments, { role: 'csm' })).sort()).toEqual([
      'returning',
      'then',
    ]);
    expect(Object.keys(scope.softDelete(brandAssignments)).sort()).toEqual(['returning', 'then']);
    await expect(write).resolves.toBeUndefined();
    expect(await scope.select(brandAssignments)).toHaveLength(2);
  });

  it('works inside a transaction', async () => {
    const { db, a, userId } = await twoBrands();

    const rows = await db.transaction(async (tx) => {
      await withBrand(tx, a).insert(brandAssignments, { userId, role: 'client' });
      return withBrand(tx, a).select(brandAssignments);
    });

    expect(rows).toHaveLength(2);
  });
});

describe('withBrand at compile time', () => {
  it('accepts only tables whose brand_id is NOT NULL', async () => {
    const db = await testDb();
    const scope: BrandScope = withBrand(db, '00000000-0000-4000-8000-000000000000');

    expectTypeOf<typeof brandAssignments>().toExtend<BrandedTable>();
    expectTypeOf<typeof agencies>().not.toExtend<BrandedTable>();
    expectTypeOf<typeof brands>().not.toExtend<BrandedTable>();
    expectTypeOf<typeof users>().not.toExtend<BrandedTable>();
    expectTypeOf<typeof memberships>().not.toExtend<BrandedTable>();
    expectTypeOf<typeof healthCheck>().not.toExtend<BrandedTable>();
    expectTypeOf(await scope.select(brandAssignments)).toEqualTypeOf<BrandAssignment[]>();
    expectTypeOf(scope.select(brandAssignments)).toEqualTypeOf<ScopedSelect<BrandAssignment>>();
    expectTypeOf(scope.softDelete(brandAssignments)).toEqualTypeOf<ScopedWrite<BrandAssignment>>();

    // The builders are lazy, so nothing runs; `void` keeps the floating-promise rule quiet.
    // @ts-expect-error agencies.brand_id is nullable: not a branded table (criterion 7).
    void scope.select(agencies);
    // @ts-expect-error same for insert: a global table has no scoped brand.
    void scope.insert(agencies, { name: 'x', slug: 'x' });
    // @ts-expect-error same for update.
    void scope.update(agencies, { name: 'x' });
    // @ts-expect-error same for softDelete.
    void scope.softDelete(agencies);
  });

  it('exposes neither `where` nor `$dynamic` nor an upsert on the sealed surfaces', () => {
    expectTypeOf<ScopedSelect<BrandAssignment>>().not.toHaveProperty('where');
    expectTypeOf<ScopedSelect<BrandAssignment>>().not.toHaveProperty('$dynamic');
    expectTypeOf<ScopedSelect<BrandAssignment>>().not.toHaveProperty('union');
    expectTypeOf<ScopedWrite<BrandAssignment>>().not.toHaveProperty('where');
    expectTypeOf<ScopedWrite<BrandAssignment>>().not.toHaveProperty('$dynamic');
    expectTypeOf<ScopedWrite<BrandAssignment>>().not.toHaveProperty('onConflictDoUpdate');
    expectTypeOf<ScopedWrite<BrandAssignment>>().not.toHaveProperty('onConflictDoNothing');
  });
});
