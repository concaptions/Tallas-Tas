import { getTableName } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';

import type { Db } from './db';
import {
  DEMO_ACTOR_ID,
  DEMO_ADMIN_ACTOR_ID,
  DEMO_BRAND_ID,
  demoAngles,
  demoAssets,
  demoBrandAssignments,
  demoBrands,
  demoBriefs,
  demoConcepts,
  demoCopy,
  demoCreators,
  demoInterfaceConfig,
  demoMemberships,
  demoNotifications,
  demoPersonas,
  demoProducts,
  demoPromotionRequests,
  demoReviewedPromotionRequests,
  demoThemes,
  demoUsers,
} from './demo-data';
import {
  agencies,
  angles,
  assets,
  brandAssignments,
  brands,
  concepts,
  copywriting,
  creativeBriefs,
  creators,
  healthCheck,
  interfaceFields,
  interfacePages,
  memberships,
  notificationSettings,
  personas,
  products,
  promotionRequests,
  themes,
  users,
  type Agency,
  type Angle,
  type Asset,
  type Brand,
  type BrandAssignment,
  type Concept,
  type Copy,
  type CreativeBrief,
  type Creator,
  type HealthCheck,
  type InterfaceField,
  type InterfacePage,
  type Membership,
  type NotificationSetting,
  type Persona,
  type Product,
  type PromotionRequest,
  type Theme,
  type User,
} from './schema';
import { withBrand } from './tenancy';

/** An object type, not an interface, so `Object.entries(result)` keeps the row union (`scripts/seed.ts`). */
export type SeedResult = {
  agency: Agency;
  templateBrand: Brand;
  childBrand: Brand;
  rosterBrands: Brand[];
  users: User[];
  memberships: Membership[];
  brandAssignments: BrandAssignment[];
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
  briefs: CreativeBrief[];
  copy: Copy[];
  creators: Creator[];
  interfacePages: InterfacePage[];
  interfaceFields: InterfaceField[];
  notificationSettings: NotificationSetting[];
  assets: Asset[];
  promotionRequests: PromotionRequest[];
};

/** Narrows a fixture lookup past `noUncheckedIndexedAccess`, or throws naming what was missing. */
function required<T>(row: T | undefined, what: string): T {
  if (row === undefined) {
    throw new Error(`seed could not find ${what} among the rows it just inserted`);
  }
  return row;
}

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
 * The brief fixtures' derived keys: the three names `listBriefs` joins in through the concept.
 * `productName` is already in the shared list above; `conceptName` and `angleName` are not, because
 * no other fixture carries them.
 */
type BriefDerived = Derived | 'conceptName' | 'angleName';

function scopedBrief<T extends { brandId: string | null }>(row: T): Omit<T, BriefDerived> {
  const rest: Record<string, unknown> = { ...scoped(row) };
  delete rest['conceptName'];
  delete rest['angleName'];
  return rest as Omit<T, BriefDerived>;
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
 * The copy fixtures' derived key: the creative's name, which `listCopy` joins in through the brief
 * and which is not a column of `copywriting`. `brandId` goes with it through `scoped`.
 */
function scopedCopy<T extends { brandId: string | null }>(
  row: T,
): Omit<T, Derived | 'creativeName'> {
  const rest: Record<string, unknown> = { ...scoped(row) };
  delete rest['creativeName'];
  return rest as Omit<T, Derived | 'creativeName'>;
}

/**
 * The interface-page fixtures' derived key: `fields`, the field rows the page NESTS
 * (`listInterfaceConfig`) and which live in their own table, not in a column of `interface_pages`.
 * `brandId` goes with it through `scoped`; the nested rows are inserted separately below, keeping
 * their fixture ids so a seeded database and `demoInterfaceConfig` are row-for-row identical.
 */
function scopedInterfacePage<T extends { brandId: string | null }>(
  row: T,
): Omit<T, Derived | 'fields'> {
  const rest: Record<string, unknown> = { ...scoped(row) };
  delete rest['fields'];
  return rest as Omit<T, Derived | 'fields'>;
}

/**
 * The notification fixtures' derived keys: the §12 vocabulary `listNotificationSettings` joins in
 * from `notificationTriggers` — the trigger's label, its recipient roles and their short reading —
 * none of which is a column of `notification_settings`. `brandId` goes with them through `scoped`.
 */
function scopedNotification<T extends { brandId: string | null }>(
  row: T,
): Omit<T, Derived | 'label' | 'recipients' | 'recipientLabel'> {
  const rest: Record<string, unknown> = { ...scoped(row) };
  delete rest['label'];
  delete rest['recipients'];
  delete rest['recipientLabel'];
  return rest as Omit<T, Derived | 'label' | 'recipients' | 'recipientLabel'>;
}

/**
 * Strips the promotion fixtures' derived key: `brandName`, the child brand's name
 * `listPromotionRequests` joins in from `brands` and which is not a column of `promotion_requests`.
 * `brandId` is deliberately KEPT — unlike every other fixture here, a promotion request names the
 * child brand that raised it and the five rows belong to four different brands, so the payload, not
 * a single scope, decides where each one lands. That is why the insert below is a plain
 * `db.insert(...)` and not a `withBrand(...)` insert: `withBrand` writes one brand's rows, and this
 * table's whole point is that an admin reads across all of them.
 */
function promotionRow<T extends { brandName: string | null }>(row: T): Omit<T, 'brandName'> {
  const rest: Record<string, unknown> = { ...row };
  delete rest['brandName'];
  return rest as Omit<T, 'brandName'>;
}

/**
 * Inserts the development data set and returns every row. Run by `db:seed` and by the PGlite tests.
 * Plain inserts, once per fresh database: the agency goes first, so a repeat run fails on
 * `agencies_slug_unique` before writing anything. Placeholder Clerk ids and reserved `.example`
 * addresses never collide with real accounts.
 *
 * The people come from `demo-data.ts` too (PRD §11): the four roster brands, the five users, their
 * memberships and their brand assignments are inserted FROM the fixtures, ids included, rather than
 * hand-written here, so `listTeam` on a seeded database returns exactly `demoTeam`. `admin` and
 * `strategist` are still returned by name — they are the two identities every other fixture's
 * `created_by` points at — but they are now found among the seeded rows instead of being two
 * separate inserts.
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
  const roster = await db
    .insert(brands)
    .values(
      demoBrands.map((brand) => ({
        ...brand,
        agencyId: agency.id,
        templateBrandId: templateBrand.id,
      })),
    )
    .returning();
  const childBrand = required(
    roster.find((brand) => brand.id === DEMO_BRAND_ID),
    'the demo child brand',
  );
  const rosterBrands = roster.filter((brand) => brand.id !== DEMO_BRAND_ID);

  const seededUsers = await db.insert(users).values(demoUsers).returning();
  const seededMemberships = await db
    .insert(memberships)
    .values(demoMemberships.map((membership) => ({ ...membership, agencyId: agency.id })))
    .returning();
  const seededAssignments = await db
    .insert(brandAssignments)
    .values(demoBrandAssignments)
    .returning();

  const admin = required(
    seededUsers.find((user) => user.clerkUserId === DEMO_ADMIN_ACTOR_ID),
    'the admin user',
  );
  const strategist = required(
    seededUsers.find((user) => user.clerkUserId === DEMO_ACTOR_ID),
    'the strategist user',
  );
  const adminMembership = required(
    seededMemberships.find((membership) => membership.userId === admin.id),
    "the admin's membership",
  );
  const strategistAssignment = required(
    seededAssignments.find(
      (assignment) => assignment.userId === strategist.id && assignment.brandId === childBrand.id,
    ),
    "the strategist's assignment on the demo brand",
  );
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
  const seededBriefs = await scope
    .insert(
      creativeBriefs,
      demoBriefs.map((row) => scopedBrief(row)),
    )
    .returning();

  const seededCopy = await scope
    .insert(
      copywriting,
      demoCopy.map((row) => scopedCopy(row)),
    )
    .returning();

  const seededCreators = await scope.insert(creators, demoCreators.map(scoped)).returning();

  const seededAssets = await scope.insert(assets, demoAssets.map(scoped)).returning();

  // PRD §10, the client interface's configuration: the pages first, then their fields, which
  // reference the page rows by their fixture ids.
  const seededInterfacePages = await scope
    .insert(interfacePages, demoInterfaceConfig.map(scopedInterfacePage))
    .returning();
  const seededInterfaceFields = await scope
    .insert(
      interfaceFields,
      demoInterfaceConfig.flatMap((page) => page.fields.map(scoped)),
    )
    .returning();

  // PRD §12, the brand's notification routing: the eight triggers in the PRD's order, Slack on and
  // email off, keeping their fixture ids so `demoNotifications` and a seeded database match row for row.
  const seededNotifications = await scope
    .insert(notificationSettings, demoNotifications.map(scopedNotification))
    .returning();

  // PRD §5, §14.1, the promotion queue the Admin dashboard settles: the three pending requests the
  // page renders plus the two already reviewed, raised by four different brands of this agency and
  // keeping their fixture ids, so `demoPromotionRequests` and a seeded database match row for row.
  const seededPromotionRequests = await db
    .insert(promotionRequests)
    .values([...demoPromotionRequests, ...demoReviewedPromotionRequests].map(promotionRow))
    .returning();

  return {
    agency,
    templateBrand,
    childBrand,
    rosterBrands,
    users: seededUsers,
    memberships: seededMemberships,
    brandAssignments: seededAssignments,
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
    briefs: seededBriefs,
    copy: seededCopy,
    creators: seededCreators,
    assets: seededAssets,
    interfacePages: seededInterfacePages,
    interfaceFields: seededInterfaceFields,
    notificationSettings: seededNotifications,
    promotionRequests: seededPromotionRequests,
  };
}
