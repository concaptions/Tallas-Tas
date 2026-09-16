import { getTableName } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  DEMO_BRAND_ID,
  demoAngles,
  demoConcepts,
  demoPersonas,
  demoProducts,
  demoThemes,
} from './demo-data';
import {
  agencies,
  angles,
  brandAssignments,
  brands,
  concepts,
  healthCheck,
  memberships,
  personas,
  products,
  themes,
  users,
  type Agency,
  type Angle,
  type Brand,
  type BrandAssignment,
  type Concept,
  type HealthCheck,
  type Membership,
  type Persona,
  type Product,
  type Theme,
  type User,
} from './schema';
import { withBrand } from './tenancy';

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
  products: Product[];
  themes: Theme[];
  personas: Persona[];
  angles: Angle[];
  concepts: Concept[];
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
 * Drops `brand_id` from a demo row: `ScopedInsertValue` has no such key, because the scope, not the
 * payload, decides which brand a row lands in. A global theme goes through the same function — it
 * has no brand to drop, and leaving `brand_id` unset is exactly what its `themes_global` check
 * constraint wants. The derived columns go the same way — `productName` and `personaName` are the
 * names `listPersonas` and `listAngles` join in, `conceptCount` is the linked-concept count
 * `listProducts` counts and `usedByBrandCount` the distinct-brand count `listThemes` counts, none of
 * them a column of the table the row is inserted into. The concept fixtures carry five more derived
 * keys, stripped by `scopedConcept` below, which is deliberately not folded into this list.
 */
type Derived = 'brandId' | 'productName' | 'personaName' | 'conceptCount' | 'usedByBrandCount';

function scoped<T extends { brandId: string | null }>(row: T): Omit<T, Derived> {
  const rest: Record<string, unknown> = { ...row };
  delete rest['brandId'];
  delete rest['productName'];
  delete rest['personaName'];
  delete rest['conceptCount'];
  delete rest['usedByBrandCount'];
  return rest as Omit<T, Derived>;
}

/**
 * The concept fixtures' derived keys. A concept inherits seven fields from its angle
 * (`listConcepts`), and three of them — `description`, `painPoints` and `usp` — are named after real
 * columns on OTHER tables: `personas.pain_points` is a column a persona fixture legitimately
 * carries. So this list is applied to concepts only, and `scoped` above keeps the shared list it
 * can safely apply to every table.
 */
type ConceptDerived = Derived | 'angleName' | 'themeName' | 'description' | 'painPoints' | 'usp';

function scopedConcept<T extends { brandId: string | null }>(row: T): Omit<T, ConceptDerived> {
  const rest: Record<string, unknown> = { ...scoped(row) };
  delete rest['angleName'];
  delete rest['themeName'];
  delete rest['description'];
  delete rest['painPoints'];
  delete rest['usp'];
  return rest as Omit<T, ConceptDerived>;
}

/**
 * Inserts the development data set and returns every row. Run by `db:seed` and by the PGlite tests.
 * Plain inserts, once per fresh database: the agency goes first, so a repeat run fails on
 * `agencies_slug_unique` before writing anything. Placeholder Clerk ids and `example.com` addresses
 * never collide with real accounts.
 *
 * The product rows come from `demo-data.ts`, the same module the app serves in demo mode, and keep
 * their fixture ids and timestamps; the child brand is given `DEMO_BRAND_ID` so a seeded database
 * and the demo fixtures are row-for-row identical. Branded rows go in through `withBrand`, which
 * forces `brand_id` to the child brand; `themes` is the global library (PRD §5.5) and is inserted
 * unscoped with `brand_id` null, as its `themes_global` check constraint requires.
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
    id: DEMO_BRAND_ID,
    agencyId: agency.id,
    name: 'Niagara Sleep Solutions',
    slug: 'niagara-sleep-solutions',
    website: 'https://niagarasleep.example',
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

  const scope = withBrand(db, childBrand.id);
  const seededProducts = await scope.insert(products, demoProducts.map(scoped)).returning();
  const seededThemes = await db.insert(themes).values(demoThemes.map(scoped)).returning();
  const seededPersonas = await scope.insert(personas, demoPersonas.map(scoped)).returning();
  const seededAngles = await scope.insert(angles, demoAngles.map(scoped)).returning();
  const seededConcepts = await scope
    .insert(
      concepts,
      demoConcepts.map((row) => scopedConcept(row)),
    )
    .returning();

  return {
    agency,
    templateBrand,
    childBrand,
    admin,
    strategist,
    adminMembership,
    strategistAssignment,
    healthCheck: health,
    products: seededProducts,
    themes: seededThemes,
    personas: seededPersonas,
    angles: seededAngles,
    concepts: seededConcepts,
  };
}
