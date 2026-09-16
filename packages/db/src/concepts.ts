import { desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  angles,
  concepts,
  personas,
  products,
  themes,
  type Concept,
  type NewConcept,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Concepts page's data access (PRD §5.7: one Angle paired with one Theme). Every function takes
 * the database as its first argument (no module-level singleton) and every read and write of
 * `concepts` goes through `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL`
 * is on every statement and an insert cannot choose its own brand. Nothing here contains business
 * logic; the domain functions call these.
 *
 * The one read that is NOT scoped is the theme-name lookup: themes are the GLOBAL library (CLAUDE.md
 * non-negotiable 5), `brand_id` null on every row, so there is no brand to scope to and
 * `withBrand(...).select(themes)` deliberately does not compile. That read still carries
 * `deleted_at IS NULL`, the half of the scope a global table keeps — exactly as `themes.ts` does it.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/**
 * What the detail page submits for create (`name` required) and, partially, for update. `name` is in
 * here because it IS stored — but it is never typed: the page computes it with the pure
 * `conceptName` formula in `packages/domain` from the Batch, the Angle and the Theme, and submits
 * the result (CLAUDE.md non-negotiable 4).
 */
export type ConceptInput = Omit<NewConcept, ManagedColumn>;

/**
 * A concept as the list, the board and the detail page render it: the row plus everything it
 * INHERITS from its angle. `angleName` and `themeName` name the pairing; `personaName`,
 * `productName`, `description`, `painPoints` and `usp` are the angle's own fields, which the detail
 * page shows read-only under the label "from Angle" (PRD §5.7: "everything derivable from the Angle
 * must auto-fill"). Every one of them is null when the link is absent or no longer live, which is
 * what the page renders as an em dash.
 *
 * `demoConcepts` satisfies `ConceptListRow[]`, so the page reads demo fixtures and database rows
 * through one type.
 */
export type ConceptListRow = Concept & {
  angleName: string | null;
  themeName: string | null;
  personaName: string | null;
  productName: string | null;
  description: string | null;
  painPoints: string | null;
  usp: string | null;
};

/** Everything a concept row inherits, resolved once per call and indexed by id. */
interface Inherited {
  angleFields: Map<
    string,
    {
      name: string;
      personaId: string | null;
      productId: string | null;
      description: string | null;
      painPoints: string | null;
      usp: string | null;
    }
  >;
  personaNames: Map<string, string>;
  productNames: Map<string, string>;
  themeNames: Map<string, string>;
}

/**
 * The four lookups a concept row needs, from three scoped reads and one global one.
 *
 * Joined in TypeScript rather than with a SQL `leftJoin`, for the reason `listAngles` and
 * `listProducts` give: `withBrand` hands back a sealed query surface with no join, `where` or
 * `$dynamic` (TICKET-005 round 3), and that seal is the guarantee a scoped read cannot be widened.
 * The three branded reads are scoped, so another brand's angles, personas and products — and
 * soft-deleted ones — are gone before a single field is inherited: a concept pointing at any of them
 * inherits null, the same as a concept with no angle at all. The theme read is the global library's,
 * live rows only.
 */
async function inherited(db: Db, scope: BrandScope): Promise<Inherited> {
  const [brandAngles, brandPersonas, brandProducts, liveThemes] = await Promise.all([
    scope.select(angles),
    scope.select(personas),
    scope.select(products),
    db.select().from(themes).where(isNull(themes.deletedAt)),
  ]);
  return {
    angleFields: new Map(
      brandAngles.map((angle) => [
        angle.id,
        {
          name: angle.name,
          personaId: angle.personaId,
          productId: angle.productId,
          description: angle.description,
          painPoints: angle.painPoints,
          usp: angle.usp,
        },
      ]),
    ),
    personaNames: new Map(brandPersonas.map((persona) => [persona.id, persona.name])),
    productNames: new Map(brandProducts.map((product) => [product.id, product.name])),
    themeNames: new Map(liveThemes.map((theme) => [theme.id, theme.name])),
  };
}

/**
 * One row plus everything it inherits, null wherever a link is absent or no longer live. A concept
 * whose angle is gone inherits null for the persona and the product too: those two hops hang off the
 * angle, not off the concept, so there is nothing left to follow.
 */
function withInherited(row: Concept, tables: Inherited): ConceptListRow {
  const angle = row.angleId === null ? undefined : tables.angleFields.get(row.angleId);
  const personaId = angle?.personaId ?? null;
  const productId = angle?.productId ?? null;
  return {
    ...row,
    angleName: angle?.name ?? null,
    themeName: row.themeId === null ? null : (tables.themeNames.get(row.themeId) ?? null),
    personaName: personaId === null ? null : (tables.personaNames.get(personaId) ?? null),
    productName: productId === null ? null : (tables.productNames.get(productId) ?? null),
    description: angle?.description ?? null,
    painPoints: angle?.painPoints ?? null,
    usp: angle?.usp ?? null,
  };
}

/** The brand's live concepts, newest edit first, each with everything it inherits from its angle. */
export async function listConcepts(db: Db, brandId: string): Promise<ConceptListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, tables] = await Promise.all([
    scope.select(concepts).orderBy(desc(concepts.updatedAt)),
    inherited(db, scope),
  ]);
  return rows.map((row) => withInherited(row, tables));
}

/** One live concept of the brand, fully inherited, or null: another brand's id never resolves. */
export async function getConceptById(
  db: Db,
  brandId: string,
  id: string,
): Promise<ConceptListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(concepts, eq(concepts.id, id)).limit(1);
  if (row === undefined) return null;
  return withInherited(row, await inherited(db, scope));
}

/**
 * Creates a concept in the scope; `brand_id` is the scope's, whatever `values` says. `values.name`
 * is the generated `Batch-Angle-Theme` string the caller computed with the domain formula — this
 * function stores it and never builds one.
 */
export async function insertConcept(
  db: Db,
  brandId: string,
  values: ConceptInput,
  actorId: string,
): Promise<Concept> {
  const [row] = await withBrand(db, brandId)
    .insert(concepts, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('concepts insert returned no row');
  }
  return row;
}

/**
 * Patches one live concept of the brand and returns it, or null when the id belongs to another brand
 * or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateConcept(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<ConceptInput>,
  actorId: string,
): Promise<Concept | null> {
  const [row] = await withBrand(db, brandId)
    .update(concepts, { ...patch, updatedBy: actorId, updatedAt: new Date() }, eq(concepts.id, id))
    .returning();
  return row ?? null;
}
