import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { personas, products, type NewPersona, type Persona } from './schema';
import { withBrand } from './tenancy';

/**
 * The Personas page's data access (PRD §5.4). Every function takes the database as its first
 * argument (no module-level singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose its
 * own brand. Nothing here contains business logic; the domain functions call these.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What a form submits for create (`name` required) and, partially, for update. */
export type PersonaInput = Omit<NewPersona, ManagedColumn>;

/**
 * A persona as the list renders it: the row plus the linked product's name, null when the persona
 * has no product or the product has been soft-deleted. `demoPersonas` satisfies `PersonaListRow[]`,
 * so the page reads demo fixtures and database rows through one type.
 */
export type PersonaListRow = Persona & { productName: string | null };

/**
 * The brand's live personas, newest edit first, each with its product's name.
 *
 * The product name is joined in TypeScript from a second scoped read rather than with a SQL
 * `leftJoin`: `withBrand` hands back a sealed query surface with no join, `where` or `$dynamic`
 * (TICKET-005 round 2), which is the guarantee that a scoped read cannot be widened. Two scoped
 * statements keep that guarantee, produce the same left-join semantics (a missing product yields
 * null) and cost one extra index scan over a table with at most a few dozen rows per brand.
 */
export async function listPersonas(db: Db, brandId: string): Promise<PersonaListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, brandProducts] = await Promise.all([
    scope.select(personas).orderBy(desc(personas.updatedAt)),
    scope.select(products),
  ]);
  const productNames = new Map(brandProducts.map((product) => [product.id, product.name]));
  return rows.map((row) => ({
    ...row,
    productName: row.productId === null ? null : (productNames.get(row.productId) ?? null),
  }));
}

/** One live persona of the brand, with its product name, or null: another brand's id never resolves. */
export async function getPersonaById(
  db: Db,
  brandId: string,
  id: string,
): Promise<PersonaListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(personas, eq(personas.id, id)).limit(1);
  if (row === undefined) return null;
  const productName =
    row.productId === null
      ? null
      : ((await scope.select(products, eq(products.id, row.productId)).limit(1))[0]?.name ?? null);
  return { ...row, productName };
}

/** Creates a persona in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertPersona(
  db: Db,
  brandId: string,
  values: PersonaInput,
  actorId: string,
): Promise<Persona> {
  const [row] = await withBrand(db, brandId)
    .insert(personas, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('personas insert returned no row');
  }
  return row;
}

/**
 * Patches one live persona of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updatePersona(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<PersonaInput>,
  actorId: string,
): Promise<Persona | null> {
  const [row] = await withBrand(db, brandId)
    .update(personas, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(personas.id, id))
    .returning();
  return row ?? null;
}
