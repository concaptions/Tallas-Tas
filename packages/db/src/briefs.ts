import { and, desc, eq, sql } from 'drizzle-orm';

import type { Db } from './db';
import { loadAllAngleProducts, loadAllConceptAngles } from './junction-queries';
import {
  angles,
  concepts,
  creativeBriefs,
  products,
  type BriefNameMode,
  type CreativeBrief,
  type CreativeSheetItem,
  type NewCreativeBrief,
} from './schema';
import { insertCreativeSheetItem } from './creative-sheet-items';
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
};

/** Everything a brief row inherits through its concept, resolved once per call and indexed by id. */
interface Inherited {
  conceptFields: Map<string, { name: string }>;
  conceptAngleMap: Map<string, string[]>;
  angleFields: Map<string, { name: string }>;
  angleProductMap: Map<string, string[]>;
  productNames: Map<string, string>;
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
  const [brandConcepts, brandAngles, brandProducts, conceptAngleMap, angleProductMap] =
    await Promise.all([
      scope.select(concepts),
      scope.select(angles),
      scope.select(products),
      loadAllConceptAngles(db),
      loadAllAngleProducts(db),
    ]);
  return {
    conceptFields: new Map(brandConcepts.map((concept) => [concept.id, { name: concept.name }])),
    conceptAngleMap,
    angleFields: new Map(brandAngles.map((angle) => [angle.id, { name: angle.name }])),
    angleProductMap,
    productNames: new Map(brandProducts.map((product) => [product.id, product.name])),
  };
}

/**
 * One row plus the three names it inherits, null wherever a link is absent or no longer live. The
 * angle and the product hang off the CONCEPT, not off the brief, so a standalone brief — and a brief
 * whose concept is gone — inherits null for all three: there is nothing left to follow.
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
  return {
    ...row,
    conceptName: concept?.name ?? null,
    angleName: angle?.name ?? null,
    productName: firstProductId === null ? null : (tables.productNames.get(firstProductId) ?? null),
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
 * Moves one brief's CLIENT-STATUS track in one write (Oct 5 Talal sync). Shaped the same way as
 * `updateConceptClientStatus`: a single-purpose writer the shared `updateClientStatus` server
 * action dispatches to, keeping `client_status_updated_at` in step with `updatedAt`.
 */
export async function updateBriefClientStatus(
  db: Db,
  brandId: string,
  id: string,
  status: string,
  note: string | null,
  actorId: string,
): Promise<CreativeBrief | null> {
  const now = new Date();
  const [row] = await withBrand(db, brandId)
    .update(
      creativeBriefs,
      {
        clientStatus: status,
        clientStatusUpdatedAt: now,
        clientStatusNote: note,
        updatedBy: actorId,
        updatedAt: now,
      },
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
 * Allocates the next per-brand `brief_number` for the Oct 5 auto-naming formula (Agent 3). Takes
 * an advisory transaction lock keyed on the brand first — the lock is released when the
 * surrounding transaction commits or rolls back — so two concurrent creators cannot read the
 * same `MAX`. A plain `SELECT MAX(brief_number) FOR UPDATE` does NOT lock the gap new rows would
 * fill, which is why the lock is explicit rather than a row-level clause.
 *
 * Returns 1 when the brand has no numbered briefs yet (`sequence`-named rows carry NULL here,
 * which is honest: they were named by the PRD §7 formula and keep that history).
 *
 * MUST be called inside `db.transaction(async (tx) => ...)` with the SAME `tx` passed as `db`.
 * Called outside a transaction, the advisory lock is session-scoped and would leak; the function
 * body cannot enforce this, so the caller does — `createBriefAction` always wraps.
 */
export async function allocateBriefNumber(db: Db, brandId: string): Promise<number> {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${brandId}))`);
  // Deliberately NO `deleted_at IS NULL` here: a soft-deleted brief's number was already printed
  // on a file somewhere, so the counter never reuses it — the same honest-gaps rule
  // `nextSequence` in `@tas/domain/creatives` applies to the per-funnel-and-format sequence.
  const result = await db.execute(
    sql`SELECT COALESCE(MAX(${creativeBriefs.briefNumber}), 0) + 1 AS next
        FROM ${creativeBriefs}
        WHERE ${creativeBriefs.brandId} = ${brandId}`,
  );
  // `db.execute` returns the driver's native result; `node-postgres` and the Neon serverless
  // driver both expose `.rows`. Drizzle types the return as `unknown`, so the shape is coerced
  // once here. The `COALESCE(MAX(int))` arithmetic may come back as a string (`numeric` cast on
  // some drivers); `Number()` is explicit about that. A bad value clamps to 1 rather than naming
  // a brief '0' or NaN.
  const rows = (result as { rows?: readonly { next: unknown }[] }).rows ?? [];
  const first = rows[0];
  const value = first === undefined ? 1 : Number(first.next);
  return Number.isInteger(value) && value > 0 ? value : 1;
}

/**
 * Rename a brief: updates only the `name` column and the audit trail, nothing else. Used by the
 * cascade that recomputes brief names when a concept's name changes.
 *
 * ONLY a brief whose `name_mode` is `auto` is renamed (migration 0060, 2026-10-09). An imported or
 * hand-typed name is `manual` — the column default every pre-0060 row kept — and this statement
 * matches zero rows for it, so no caller, however it filters, can overwrite an Airtable name or a
 * name a strategist typed. The guard lives here, at the query layer, rather than only in the
 * action above it (CLAUDE.md: tenancy and invariants are enforced where the statement is built).
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
    and(eq(creativeBriefs.id, id), eq(creativeBriefs.nameMode, 'auto')),
  );
}

/** What "New creative" stores before the number is allocated and the name computed from it. */
export type CreateBriefValues = Omit<BriefInput, 'name' | 'briefNumber' | 'nameMode'>;

export interface CreatedBrief {
  readonly brief: CreativeBrief;
  readonly sheetItem: CreativeSheetItem;
}

/**
 * "New creative" on the Creative Sheet (2026-10-09, audit item 7): ONE transaction that allocates
 * the brand-wide number under the advisory lock, stores the brief with the name `nameFor` builds
 * from that number, and links a sheet row to it — so a sheet row never exists without a named,
 * numbered creative behind it, and two concurrent creates never share a number.
 *
 * The name is the caller's: `@tas/db` never builds one (CLAUDE.md non-negotiable 6; the formula is
 * `generateBriefName` in `@tas/domain/briefs`, which this package cannot import). `nameMode` says
 * who owns it afterwards — `auto` follows the concept's renames, `manual` is never rewritten
 * (migration 0060). The sheet row copies the brief's ratios, as the 0059 backfill did.
 */
export async function createBriefWithSheetRow(
  db: Db,
  brandId: string,
  values: CreateBriefValues,
  nameFor: (briefNumber: number) => string,
  nameMode: BriefNameMode,
  actorId: string,
): Promise<CreatedBrief> {
  return db.transaction(async (tx) => {
    const briefNumber = await allocateBriefNumber(tx, brandId);
    const brief = await insertBrief(
      tx,
      brandId,
      { ...values, name: nameFor(briefNumber), briefNumber, nameMode },
      actorId,
    );
    const sheetItem = await insertCreativeSheetItem(
      tx,
      brandId,
      { briefId: brief.id, dimensions: [...brief.dimensions] },
      actorId,
    );
    return { brief, sheetItem };
  });
}
