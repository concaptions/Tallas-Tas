import { and, between, desc, eq, exists, inArray, not, or, sql } from 'drizzle-orm';
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
  type ScopedInsertValue,
  type ScopedSelect,
  type ScopedUpdateSet,
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

  it('refuses a raw filter that could close the scope’s parenthesis, before any query runs', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);
    // Round-4 adversary snippets first: each read both brands' rows, soft-deleted B's row through A's
    // scope, or moved it into brand A. Then the other lexemes that could hide a parenthesis.
    const escapes = [
      sql`true) or (true`,
      sql`true) or true) --`,
      sql`true) or true) /* comment */`,
      sql`true) or (true) or (true`,
      sql`'(' = '(' or true) or (true`,
      sql`$$($$ = $$($$ or true) or (true`,
      sql`true or (true`,
      sql`true; update brand_assignments set role = 'csm'`,
      sql`"brand_assignments"."role" = 'strategist'`,
    ];

    for (const escape of escapes) {
      expect(() => scope.select(brandAssignments, escape)).toThrow(/not contained/);
      expect(() => scope.update(brandAssignments, { role: 'client' }, escape)).toThrow(
        /not contained/,
      );
      expect(() => scope.softDelete(brandAssignments, escape)).toThrow(/not contained/);
    }
    const rows = await liveRows(db);
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([rowA, rowB]));
    expect(await withBrand(db, rowB.brandId).select(brandAssignments)).toEqual([rowB]);
  });

  it('accepts every Drizzle-built filter, subqueries included, and raw fragments with bound values', async () => {
    const { db, a, rowA, rowB } = await twoBrands();
    const scope = withBrand(db, a);
    const everyone = db.select({ id: users.id }).from(users).as('everyone');
    const filters = [
      and(
        eq(brandAssignments.userId, rowA.userId),
        or(
          eq(brandAssignments.role, 'strategist'),
          inArray(brandAssignments.role, ['csm', 'client']),
        ),
      ),
      not(eq(brandAssignments.id, rowB.id)),
      exists(db.select().from(users).where(eq(users.id, brandAssignments.userId))),
      inArray(brandAssignments.userId, db.select({ id: everyone.id }).from(everyone)),
      between(brandAssignments.createdAt, new Date(0), new Date(Date.now() + 60_000)),
      sql`${brandAssignments.role} = ${'strategist'}`,
      sql`lower(${brandAssignments.role}::text) in ${['strategist', 'csm']}`,
      sql`${brandAssignments.role}::text = ${'(strategist'} or true`.inlineParams(),
    ];

    for (const filter of filters) {
      expect(await scope.select(brandAssignments, filter)).toEqual([rowA]);
    }
    expect(
      await scope
        .update(
          brandAssignments,
          { role: 'csm' },
          or(eq(brandAssignments.id, rowA.id), eq(brandAssignments.id, rowB.id)),
        )
        .returning(),
    ).toEqual([{ ...rowA, role: 'csm' }]);
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

  it('keeps the caller’s id, created_by and deleted_at on insert and update', async () => {
    const { db, a, userId } = await twoBrands();
    const scope = withBrand(db, a);
    const id = '00000000-0000-4000-8000-00000000000a';

    const [inserted] = await scope
      .insert(brandAssignments, { id, userId, role: 'csm', createdBy: 'importer' })
      .returning();
    const [updated] = await scope
      .update(
        brandAssignments,
        { createdBy: 'reviewer', deletedAt: new Date() },
        eq(brandAssignments.id, id),
      )
      .returning();

    expect(inserted).toMatchObject({ id, brandId: a, createdBy: 'importer', deletedAt: null });
    expect(updated).toMatchObject({ id, brandId: a, createdBy: 'reviewer' });
    expect(updated?.deletedAt).toBeInstanceOf(Date);
    expect(await scope.select(brandAssignments, eq(brandAssignments.id, id))).toEqual([]);
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

  it('accepts every optional column on insert and update, but never brand_id', async () => {
    const db = await testDb();
    const scope = withBrand(db, '00000000-0000-4000-8000-000000000000');
    const userId = '00000000-0000-4000-8000-000000000001';
    const id = '00000000-0000-4000-8000-000000000002';

    // Nothing but `brandId` is dropped from the insert model (round 3: the old `Omit` over
    // `PgInsertValue<T>` kept only the required keys, `userId | role`).
    expectTypeOf<keyof ScopedInsertValue<typeof brandAssignments>>().toEqualTypeOf<
      Exclude<keyof NewBrandAssignment, 'brandId'>
    >();
    expectTypeOf<keyof ScopedUpdateSet<typeof brandAssignments>>().toEqualTypeOf<
      Exclude<keyof NewBrandAssignment, 'brandId'>
    >();
    expectTypeOf<ScopedInsertValue<typeof brandAssignments>>().not.toHaveProperty('brandId');
    expectTypeOf<ScopedUpdateSet<typeof brandAssignments>>().not.toHaveProperty('brandId');

    // Object literals, so excess-property checking applies: the optional shared columns compile as
    // plain Drizzle accepts them (each line failed with TS2353 before round 4), `brandId` does not.
    void scope.insert(brandAssignments, {
      userId,
      role: 'csm',
      id,
      createdBy: 'x',
      deletedAt: new Date(),
    });
    void scope.insert(brandAssignments, [
      { userId, role: 'csm', id, createdBy: 'x', deletedAt: null },
    ]);
    void scope.update(brandAssignments, { id, createdBy: 'x', deletedAt: new Date() });
    // @ts-expect-error brand_id is not the caller's to choose on insert.
    void scope.insert(brandAssignments, { userId, role: 'csm', brandId: userId });
    // @ts-expect-error same for a batch insert.
    void scope.insert(brandAssignments, [{ userId, role: 'csm', brandId: userId }]);
    // @ts-expect-error same for update.
    void scope.update(brandAssignments, { brandId: userId });
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
