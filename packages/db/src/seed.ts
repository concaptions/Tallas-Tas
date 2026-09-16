import { getTableName } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  agencies,
  brandAssignments,
  brands,
  healthCheck,
  memberships,
  users,
  type Agency,
  type Brand,
  type BrandAssignment,
  type HealthCheck,
  type Membership,
  type User,
} from './schema';

/** An object type, not an interface, so `Object.entries(result)` keeps the row union (`scripts/seed.ts`). */
export type SeedResult = {
  agency: Agency;
  templateBrand: Brand;
  childBrand: Brand;
  admin: User;
  strategist: User;
  adminMembership: Membership;
  strategistAssignment: BrandAssignment;
  healthCheck: HealthCheck;
};

/** Inserts one row and returns it, or throws naming the table. */
async function insertOne<T extends PgTable>(
  db: Db,
  table: T,
  values: PgInsertValue<T>,
): Promise<T['$inferSelect']> {
  const [row] = await db.insert(table).values(values).returning();
  if (row === undefined) {
    throw new Error(`${getTableName(table)} insert returned no row`);
  }
  return row;
}

/**
 * Inserts the development data set and returns every row. Run by `db:seed` and by the PGlite tests.
 * Plain inserts, once per fresh database: the agency goes first, so a repeat run fails on
 * `agencies_slug_unique` before writing anything. Placeholder Clerk ids and `example.com` addresses
 * never collide with real accounts.
 */
export async function seed(db: Db): Promise<SeedResult> {
  const agency = await insertOne(db, agencies, { name: 'TAS Digital', slug: 'tas-digital' });
  const templateBrand = await insertOne(db, brands, {
    agencyId: agency.id,
    name: 'Creative Hub Template',
    slug: 'creative-hub-template',
    isTemplate: true,
  });
  const childBrand = await insertOne(db, brands, {
    agencyId: agency.id,
    name: 'Demo Brand',
    slug: 'demo-brand',
    website: 'https://demo-brand.example',
    templateBrandId: templateBrand.id,
  });
  const admin = await insertOne(db, users, {
    clerkUserId: 'user_seed_admin',
    email: 'admin@example.com',
    fullName: 'Seed Admin',
  });
  const strategist = await insertOne(db, users, {
    clerkUserId: 'user_seed_strategist',
    email: 'strategist@example.com',
    fullName: 'Seed Strategist',
  });
  const adminMembership = await insertOne(db, memberships, {
    userId: admin.id,
    agencyId: agency.id,
    role: 'admin',
  });
  const strategistAssignment = await insertOne(db, brandAssignments, {
    userId: strategist.id,
    brandId: childBrand.id,
    role: 'strategist',
  });
  const health = await insertOne(db, healthCheck, { note: 'seeded by @tas/db db:seed' });

  return {
    agency,
    templateBrand,
    childBrand,
    admin,
    strategist,
    adminMembership,
    strategistAssignment,
    healthCheck: health,
  };
}
