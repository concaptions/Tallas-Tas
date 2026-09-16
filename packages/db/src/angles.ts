import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { angles, personas, products, type Angle, type NewAngle } from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Angles page's data access (PRD §5.6: the hypothesis a strategist writes from a persona).
 * Every function takes the database as its first argument (no module-level singleton) and reads and
 * writes through `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL` is on
 * every statement and an insert cannot choose its own brand. Nothing here contains business logic;
 * the domain functions call these.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel submits for create (`name` required) and, partially, for update. */
export type AngleInput = Omit<NewAngle, ManagedColumn>;

/**
 * An angle as the list and the panel render it: the row plus the linked persona's and product's
 * names, each null when the angle has no such link or the linked row has been soft-deleted.
 * `demoAngles` satisfies `AngleListRow[]`, so the page reads demo fixtures and database rows
 * through one type.
 */
export type AngleListRow = Angle & { personaName: string | null; productName: string | null };

/**
 * The two name lookups an angle row needs, from two scoped reads.
 *
 * The names are joined in TypeScript rather than with a SQL `leftJoin`: `withBrand` hands back a
 * sealed query surface with no join, `where` or `$dynamic` (TICKET-005 round 3), which is the
 * guarantee that a scoped read cannot be widened — the same reason `listPersonas` joins its product
 * name here. Both reads are scoped, so another brand's personas and products, and soft-deleted
 * ones, are gone before a single name is resolved: an angle pointing at either returns null, the
 * same as an angle with no link at all.
 */
async function linkedNames(
  scope: BrandScope,
): Promise<{ personaNames: Map<string, string>; productNames: Map<string, string> }> {
  const [brandPersonas, brandProducts] = await Promise.all([
    scope.select(personas),
    scope.select(products),
  ]);
  return {
    personaNames: new Map(brandPersonas.map((persona) => [persona.id, persona.name])),
    productNames: new Map(brandProducts.map((product) => [product.id, product.name])),
  };
}

/** One row plus its two joined names, null where the link is absent or no longer live. */
function withNames(
  row: Angle,
  names: { personaNames: Map<string, string>; productNames: Map<string, string> },
): AngleListRow {
  return {
    ...row,
    personaName: row.personaId === null ? null : (names.personaNames.get(row.personaId) ?? null),
    productName: row.productId === null ? null : (names.productNames.get(row.productId) ?? null),
  };
}

/** The brand's live angles, newest edit first, each with its persona and product names. */
export async function listAngles(db: Db, brandId: string): Promise<AngleListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, names] = await Promise.all([
    scope.select(angles).orderBy(desc(angles.updatedAt)),
    linkedNames(scope),
  ]);
  return rows.map((row) => withNames(row, names));
}

/** One live angle of the brand, with its two names, or null: another brand's id never resolves. */
export async function getAngleById(
  db: Db,
  brandId: string,
  id: string,
): Promise<AngleListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(angles, eq(angles.id, id)).limit(1);
  if (row === undefined) return null;
  return withNames(row, await linkedNames(scope));
}

/** Creates an angle in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertAngle(
  db: Db,
  brandId: string,
  values: AngleInput,
  actorId: string,
): Promise<Angle> {
  const [row] = await withBrand(db, brandId)
    .insert(angles, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('angles insert returned no row');
  }
  return row;
}

/**
 * Patches one live angle of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateAngle(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<AngleInput>,
  actorId: string,
): Promise<Angle | null> {
  const [row] = await withBrand(db, brandId)
    .update(angles, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(angles.id, id))
    .returning();
  return row ?? null;
}
