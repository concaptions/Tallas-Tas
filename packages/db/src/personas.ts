import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { loadAllAnglePersonas } from './junction-queries';
import { angles, personas, products, type NewPersona, type Persona } from './schema';
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
 *
 * `productName` IS NOT A LINK A PERSONA OWNS. Action item 45 (Talal 2026-09-28) fixes the hierarchy
 * as Product → Persona → Angle (which links product and persona) → Concept, and ends "Persona needs
 * no links": a persona is written about somebody, and which product is sold to them is the ANGLE's
 * decision, through `angle_products`. Nothing on the Personas page edits a product, and none of its
 * surfaces offers the control. `personas.product_id` survives only because the Airtable importer
 * writes it (`airtable-import.ts`, Personas › Product) and the Gratsi rows carry it, so dropping
 * the column would throw away imported data; `productName` resolves it so a reader can still see
 * what was imported. Do not add a product control to this table — add it to the angle.
 */
export type PersonaListRow = Persona & {
  /** The imported `product_id` resolved to a name; read-only (see the note above). */
  productName: string | null;
  /** The live angles written FROM this persona (TASK 5: the persona side of Angles ↔ Personas),
   * read from the `angle_personas` junction and sorted alphabetically — the scoped read carries
   * no ORDER BY, so heap order is not a contract. */
  angleNames: string[];
};

/** `personaId -> the linked live angles' names`, the junction read persona-first. */
function angleNamesByPersona(
  brandAngles: readonly { id: string; name: string }[],
  anglePersonaMap: Map<string, string[]>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const angle of brandAngles) {
    for (const personaId of anglePersonaMap.get(angle.id) ?? []) {
      const names = map.get(personaId) ?? [];
      names.push(angle.name);
      map.set(personaId, names);
    }
  }
  for (const names of map.values()) names.sort((a, b) => a.localeCompare(b));
  return map;
}

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
  const [rows, brandProducts, brandAngles, anglePersonaMap] = await Promise.all([
    scope.select(personas).orderBy(desc(personas.updatedAt)),
    scope.select(products),
    scope.select(angles),
    loadAllAnglePersonas(db),
  ]);
  const productNames = new Map(brandProducts.map((product) => [product.id, product.name]));
  const angleNames = angleNamesByPersona(brandAngles, anglePersonaMap);
  return rows.map((row) => ({
    ...row,
    productName: row.productId === null ? null : (productNames.get(row.productId) ?? null),
    angleNames: angleNames.get(row.id) ?? [],
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
  const [productName, brandAngles, anglePersonaMap] = await Promise.all([
    row.productId === null
      ? Promise.resolve(null)
      : scope
          .select(products, eq(products.id, row.productId))
          .limit(1)
          .then((r) => r[0]?.name ?? null),
    scope.select(angles),
    loadAllAnglePersonas(db),
  ]);
  const angleNames = angleNamesByPersona(brandAngles, anglePersonaMap);
  return { ...row, productName, angleNames: angleNames.get(row.id) ?? [] };
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
