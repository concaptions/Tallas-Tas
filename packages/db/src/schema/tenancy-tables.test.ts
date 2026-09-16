import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { seed } from '../seed';
import { testDb } from '../testing';
import { agencyRoles, brandAssignments, brandRoles, brands, brandStatuses } from './index';

/** Index names from `pg_indexes` for one table, so a test can state which index serves which key. */
async function indexNames(
  db: Awaited<ReturnType<typeof testDb>>,
  table: string,
): Promise<string[]> {
  const { rows } = await db.execute<{ indexname: string }>(
    sql`select indexname from pg_indexes where schemaname = 'public' and tablename = ${table}`,
  );
  return rows.map((row) => row.indexname).sort();
}

/**
 * Drizzle wraps a driver error as `Failed query: ...` and keeps the Postgres error in `cause`, where
 * the constraint name is. Resolves to that message so a test can name the constraint it expects.
 */
async function rejection(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (error: unknown) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    return cause instanceof Error ? cause.message : String(cause);
  }
  throw new Error('expected the query to be rejected');
}

async function enumLabels(db: Awaited<ReturnType<typeof testDb>>, name: string): Promise<string[]> {
  const { rows } = await db.execute<{ enumlabel: string }>(
    sql`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = ${name} order by e.enumsortorder`,
  );
  return rows.map((row) => row.enumlabel);
}

describe('tenancy migration on PGlite', () => {
  it('creates the three pg enums with the values enums.ts declares', async () => {
    const db = await testDb();

    expect(await enumLabels(db, 'agency_role')).toEqual([...agencyRoles]);
    expect(await enumLabels(db, 'brand_role')).toEqual([...brandRoles]);
    expect(await enumLabels(db, 'brand_status')).toEqual([...brandStatuses]);
  });

  it('indexes every foreign key (leading column of a btree) and (brand_id, user_id)', async () => {
    const db = await testDb();

    // brands: agency_id via the (agency_id, slug) unique index, template_brand_id via its own.
    expect(await indexNames(db, 'brands')).toEqual([
      'brands_agency_id_slug_unique',
      'brands_pkey',
      'brands_template_brand_id_idx',
    ]);
    // memberships: user_id via the (user_id, agency_id) unique index, agency_id via its own.
    expect(await indexNames(db, 'memberships')).toEqual([
      'memberships_agency_id_idx',
      'memberships_pkey',
      'memberships_user_id_agency_id_unique',
    ]);
    // brand_assignments: brand_id via the ticket's (brand_id, user_id) index, user_id via the unique.
    expect(await indexNames(db, 'brand_assignments')).toEqual([
      'brand_assignments_brand_id_user_id_idx',
      'brand_assignments_pkey',
      'brand_assignments_user_id_brand_id_role_unique',
    ]);
  });

  it('brand_assignments.brand_id is the NOT NULL tenancy edge with a foreign key to brands', async () => {
    const db = await testDb();
    const { strategist } = await seed(db);
    const unknownBrand = '00000000-0000-4000-8000-000000000000';

    expect(
      await rejection(
        db
          .insert(brandAssignments)
          .values({ userId: strategist.id, brandId: unknownBrand, role: 'csm' }),
      ),
    ).toMatch(/brand_assignments_brand_id_brands_id_fk/);
    expect(
      await rejection(
        db.execute(
          sql`insert into brand_assignments (user_id, role) values (${strategist.id}, 'csm')`,
        ),
      ),
    ).toMatch(/null value in column "brand_id"/);
  });

  it('rejects a duplicate (user_id, brand_id, role) assignment', async () => {
    const db = await testDb();
    const { strategist, childBrand } = await seed(db);

    expect(
      await rejection(
        db
          .insert(brandAssignments)
          .values({ userId: strategist.id, brandId: childBrand.id, role: 'strategist' }),
      ),
    ).toMatch(/brand_assignments_user_id_brand_id_role_unique/);
  });

  it('keeps brand slugs unique per agency and template_brand_id pointing at a brand', async () => {
    const db = await testDb();
    const { agency, childBrand } = await seed(db);
    const unknownBrand = '00000000-0000-4000-8000-000000000000';

    expect(
      await rejection(
        db.insert(brands).values({ agencyId: agency.id, name: 'Dup', slug: childBrand.slug }),
      ),
    ).toMatch(/brands_agency_id_slug_unique/);
    expect(
      await rejection(
        db.insert(brands).values({
          agencyId: agency.id,
          name: 'Orphan',
          slug: 'orphan',
          templateBrandId: unknownBrand,
        }),
      ),
    ).toMatch(/brands_template_brand_id_brands_id_fk/);
  });
});
