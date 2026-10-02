import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  loadAllAnglePersonas,
  loadAllAngleProducts,
  loadAllConceptAngles,
} from './junction-queries';
import {
  angles,
  concepts,
  creativeBriefs,
  personas,
  products,
  type CreativeBrief,
  type NewCreativeBrief,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Creative Briefs page's data access (PRD §5.10: one record per creative asset). Every function
 * takes the database as its first argument (no module-level singleton) and every read and write goes
 * through `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL` is on every
 * statement and an insert cannot choose its own brand. Nothing here contains business logic; the
 * domain functions call these.
 *
 * The one thing this module never does is build a name. `creative_briefs.name` is the generated
 * PRD §7 string and arrives already computed by the pure `creativeName` in `packages/domain`
 * (CLAUDE.md non-negotiable 6).
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/**
 * What the brief form submits for create and, partially, for update. `name` is in here because it IS
 * stored — but it is never typed: the page computes it with the pure `creativeName` formula from the
 * funnel, the type, the sequence, the batch, the concept (or the standalone slug), the version and
 * the optional product, and submits the result.
 */
export type BriefInput = Omit<NewCreativeBrief, ManagedColumn>;

/**
 * A brief as the list and the detail page render it: the row plus the three names it INHERITS
 * through its concept (PRD §5.10: "Concept (link) → auto-fills Batch, Angle, Persona, Product").
 *
 * All three are `string | null`, and null is the ordinary case, not an error: a STANDALONE brief has
 * no concept (`conceptId` null — CLAUDE.md non-negotiable 5, PRD §8), so there is no angle to reach
 * and no product behind it either. They are also null when the link points at another brand's row or
 * at a soft-deleted one, which the scoped reads below make the same outcome. The page renders that
 * as a "Standalone" chip, never a blank.
 *
 * `demoBriefs` satisfies `BriefListRow[]`, so the page reads demo fixtures and database rows through
 * one type.
 */
export type BriefListRow = CreativeBrief & {
  conceptName: string | null;
  angleName: string | null;
  productName: string | null;
  /**
   * The persona(s) this brief speaks to, inherited down the chain concept → angle → persona (PRD
   * §5.10: "Concept (link) → auto-fills Batch, Angle, Persona, Product"). NEVER STORED on the
   * brief: `creative_briefs` has no persona column and must not get one, because the persona is a
   * property of the angle and a copy here would go stale the moment the angle is re-targeted.
   *
   * A LIST, not a single name, because `angle_personas` is a many-to-many: one angle can argue to
   * several personas, and a brief reaches every angle it is linked to — its own `angle_id` and,
   * through its concept, that concept's angles. The names are deduped and ordered by the angle
   * order, and the list is EMPTY rather than null when there is nothing to reach: a standalone
   * brief (PRD §8), an angle with no persona linked, or a link that points out of the brand's
   * scope. Empty is the ordinary case, not an error.
   *
   * Deliberately wider than `angleName` above, which still names the concept's FIRST angle only:
   * widening that one would change a value the brief page already shows, and this field is new.
   */
  personaNames: readonly string[];
};

/** Everything a brief row inherits through its concept, resolved once per call and indexed by id. */
interface Inherited {
  conceptFields: Map<string, { name: string }>;
  conceptAngleMap: Map<string, string[]>;
  angleFields: Map<string, { name: string }>;
  angleProductMap: Map<string, string[]>;
  anglePersonaMap: Map<string, string[]>;
  productNames: Map<string, string>;
  personaNames: Map<string, string>;
}

/**
 * The lookups a brief row needs, from scoped reads plus junction table bulk loads.
 *
 * Joined in TypeScript rather than with a SQL `leftJoin`, for the reason `listConcepts` gives:
 * `withBrand` hands back a sealed query surface with no join, `where` or `$dynamic`, and that seal is
 * the guarantee a scoped read cannot be widened. All entity reads are scoped, so another brand's
 * concepts, angles and products — and soft-deleted ones — are gone before a single name is
 * inherited: a brief pointing at any of them inherits null, exactly as a standalone brief does.
 */
async function inherited(db: Db, scope: BrandScope): Promise<Inherited> {
  const [
    brandConcepts,
    brandAngles,
    brandProducts,
    brandPersonas,
    conceptAngleMap,
    angleProductMap,
    anglePersonaMap,
  ] = await Promise.all([
    scope.select(concepts),
    scope.select(angles),
    scope.select(products),
    scope.select(personas),
    loadAllConceptAngles(db),
    loadAllAngleProducts(db),
    loadAllAnglePersonas(db),
  ]);
  return {
    conceptFields: new Map(brandConcepts.map((concept) => [concept.id, { name: concept.name }])),
    conceptAngleMap,
    angleFields: new Map(brandAngles.map((angle) => [angle.id, { name: angle.name }])),
    angleProductMap,
    anglePersonaMap,
    productNames: new Map(brandProducts.map((product) => [product.id, product.name])),
    personaNames: new Map(brandPersonas.map((persona) => [persona.id, persona.name])),
  };
}

/**
 * Every angle this brief can reach, in reading order and without a repeat: its OWN `angle_id`
 * first — the link the Airtable import writes on the row, and the one the brief page shows before
 * the inherited pair — then the angles hanging off its concept. An id that is not in
 * `angleFields` has been dropped by the scope (another brand's angle, or a soft-deleted one) and
 * is skipped here, so nothing is inherited through a row the caller may not read.
 */
function reachableAngleIds(row: CreativeBrief, tables: Inherited): string[] {
  const throughConcept =
    row.conceptId === null || !tables.conceptFields.has(row.conceptId)
      ? []
      : (tables.conceptAngleMap.get(row.conceptId) ?? []);
  const ids = [...(row.angleId === null ? [] : [row.angleId]), ...throughConcept];
  return [...new Set(ids)].filter((id) => tables.angleFields.has(id));
}

/**
 * One row plus the names it inherits, null wherever a link is absent or no longer live. The angle
 * and the product hang off the CONCEPT, not off the brief, so a standalone brief — and a brief
 * whose concept is gone — inherits null for all three: there is nothing left to follow. The
 * personas hang off the ANGLE and are a list, resolved over every angle the brief reaches; see
 * `BriefListRow.personaNames` for why that is wider than `angleName`.
 */
function withInherited(row: CreativeBrief, tables: Inherited): BriefListRow {
  const concept = row.conceptId === null ? undefined : tables.conceptFields.get(row.conceptId);
  const firstAngleId =
    row.conceptId === null || concept === undefined
      ? null
      : ((tables.conceptAngleMap.get(row.conceptId) ?? [])[0] ?? null);
  const angle = firstAngleId === null ? undefined : tables.angleFields.get(firstAngleId);
  const firstProductId =
    firstAngleId === null || angle === undefined
      ? null
      : ((tables.angleProductMap.get(firstAngleId) ?? [])[0] ?? null);
  const personaIds = reachableAngleIds(row, tables).flatMap(
    (angleId) => tables.anglePersonaMap.get(angleId) ?? [],
  );
  return {
    ...row,
    conceptName: concept?.name ?? null,
    angleName: angle?.name ?? null,
    productName: firstProductId === null ? null : (tables.productNames.get(firstProductId) ?? null),
    personaNames: [...new Set(personaIds)].flatMap((personaId) => {
      const name = tables.personaNames.get(personaId);
      return name === undefined ? [] : [name];
    }),
  };
}

/** The brand's live briefs, newest edit first, each with the names it inherits from its concept. */
export async function listBriefs(db: Db, brandId: string): Promise<BriefListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, tables] = await Promise.all([
    scope.select(creativeBriefs).orderBy(desc(creativeBriefs.updatedAt)),
    inherited(db, scope),
  ]);
  return rows.map((row) => withInherited(row, tables));
}

/** One live brief of the brand, fully inherited, or null: another brand's id never resolves. */
export async function getBriefById(
  db: Db,
  brandId: string,
  id: string,
): Promise<BriefListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(creativeBriefs, eq(creativeBriefs.id, id)).limit(1);
  if (row === undefined) return null;
  return withInherited(row, await inherited(db, scope));
}

/**
 * Creates a brief in the scope; `brand_id` is the scope's, whatever `values` says. `values.name` is
 * the generated PRD §7 string the caller computed with the domain formula — this function stores it
 * and never builds one. `values.conceptId` may be omitted entirely: that is a standalone static, the
 * PRD §8 case, and it is a supported create rather than a degraded one.
 */
export async function insertBrief(
  db: Db,
  brandId: string,
  values: BriefInput,
  actorId: string,
): Promise<CreativeBrief> {
  const [row] = await withBrand(db, brandId)
    .insert(creativeBriefs, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creative_briefs insert returned no row');
  }
  return row;
}

/**
 * Patches one live brief of the brand and returns it, or null when the id belongs to another brand or
 * to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateBrief(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<BriefInput>,
  actorId: string,
): Promise<CreativeBrief | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creativeBriefs,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(creativeBriefs.id, id),
    )
    .returning();
  return row ?? null;
}

/**
 * All live briefs in the brand that belong to a concept — the rows whose name must be recomputed
 * when the concept's own name changes. Returns raw rows (no inherited joins) because the caller
 * only needs the fields the naming formula reads.
 */
export async function listBriefsByConceptId(
  db: Db,
  brandId: string,
  conceptId: string,
): Promise<CreativeBrief[]> {
  return withBrand(db, brandId).select(creativeBriefs, eq(creativeBriefs.conceptId, conceptId));
}

/**
 * Rename a brief: updates only the `name` column and the audit trail, nothing else. Used by the
 * cascade that recomputes brief names when a concept's name changes.
 */
export async function renameBrief(
  db: Db,
  brandId: string,
  id: string,
  name: string,
  actorId: string,
): Promise<void> {
  await withBrand(db, brandId).update(
    creativeBriefs,
    { name, updatedBy: actorId, updatedAt: new Date() },
    eq(creativeBriefs.id, id),
  );
}
