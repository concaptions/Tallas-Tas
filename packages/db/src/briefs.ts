import { and, asc, desc, eq, gte, inArray, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { loadAllAngleProducts, loadAllConceptAngles } from './junction-queries';
import {
  angles,
  concepts,
  creativeBriefs,
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
 * What the media buyer's launch queue asks for (PRD §11, §13; ticket `ads-to-launch` Phase 2). The
 * status keys come from the CALLER — `@tas/domain`'s `LAUNCH_READY_CLIENT_STATUS` and
 * `LAUNCHED_CLIENT_STATUSES` — because `@tas/db` does not depend on `@tas/domain` (the edge runs the
 * other way, as `schema/briefs.ts` explains); this module stores and filters, the domain decides.
 */
export interface LaunchQueueFilter {
  readonly readyStatus: string;
  readonly launchedStatuses: readonly string[];
  /** The earliest `launched_at` the "Recently Launched" list includes. */
  readonly launchedSince: Date;
}

export interface LaunchQueueRows {
  /** Client-approved and not yet launched: priority first (unset last), then newest edit. */
  readonly ready: BriefListRow[];
  /** Launched (live or paused) since `launchedSince`, most recent launch first. */
  readonly recent: BriefListRow[];
}

/**
 * Both halves of the launch queue in one scoped pass, each row carrying its inherited names. Postgres
 * sorts `ASC` with NULLS LAST by default, so a brief nobody prioritised sorts after every prioritised
 * one without a raw `NULLS LAST` fragment (which `withBrand`'s containment check would refuse).
 */
export async function listLaunchQueue(
  db: Db,
  brandId: string,
  filter: LaunchQueueFilter,
): Promise<LaunchQueueRows> {
  const scope = withBrand(db, brandId);
  const [ready, recent, tables] = await Promise.all([
    scope
      .select(
        creativeBriefs,
        and(eq(creativeBriefs.clientStatus, filter.readyStatus), isNull(creativeBriefs.launchedAt)),
      )
      .orderBy(asc(creativeBriefs.launchPriority), desc(creativeBriefs.updatedAt)),
    scope
      .select(
        creativeBriefs,
        and(
          inArray(creativeBriefs.clientStatus, [...filter.launchedStatuses]),
          gte(creativeBriefs.launchedAt, filter.launchedSince),
        ),
      )
      .orderBy(desc(creativeBriefs.launchedAt)),
    inherited(db, scope),
  ]);
  return {
    ready: ready.map((row) => withInherited(row, tables)),
    recent: recent.map((row) => withInherited(row, tables)),
  };
}

/** One launch-queue move, validated by the caller against the domain before it gets here. */
export interface BriefLaunchMove {
  /** The statuses the caller validated the move FROM. The update only applies if they still hold. */
  readonly fromClientStatus: string;
  readonly fromInternalStatus: string;
  readonly clientStatus: string;
  readonly internalStatus: string;
  /** Set on launch; omitted on pause and resume, which keep the moment the ad first went live. */
  readonly launchedAt?: Date;
}

/**
 * Applies a launch-queue move as a COMPARE-AND-SET: the update matches only while the brief is still
 * in the statuses the move was validated from. Two clicks, two tabs or a board left open while a
 * colleague moved the creative therefore apply at most once; the loser changes zero rows and gets
 * null, the same answer as another brand's id or a soft-deleted row. Scoped by `withBrand`, so a
 * brief of another brand can never be moved.
 */
export async function transitionBriefLaunch(
  db: Db,
  brandId: string,
  id: string,
  move: BriefLaunchMove,
  actorId: string,
): Promise<CreativeBrief | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creativeBriefs,
      {
        clientStatus: move.clientStatus,
        internalStatus: move.internalStatus,
        ...(move.launchedAt === undefined ? {} : { launchedAt: move.launchedAt }),
        updatedBy: actorId,
        updatedAt: new Date(),
      },
      and(
        eq(creativeBriefs.id, id),
        eq(creativeBriefs.clientStatus, move.fromClientStatus),
        eq(creativeBriefs.internalStatus, move.fromInternalStatus),
      ),
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
 * The columns a duplicate does NOT copy from its source, each re-set to a fresh value by
 * `duplicateBrief`: the scope/clock/actor columns, the two-track status, the launch and performance
 * history, the QA ticks, the legacy id and the propagation lineage. `satisfies` proves every name is
 * a real column, so the list cannot silently drift from the schema.
 */
const DUPLICATE_RESET_FIELDS = [
  'id',
  'brandId',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'templateRowId',
  'overriddenFields',
  'name',
  'sequence',
  'internalStatus',
  'clientStatus',
  'launchedAt',
  'launchPriority',
  'performance',
  'legacyAirtableId',
  'qaVideoEditor',
  'qaDesigner',
  'qaStrategist',
] as const satisfies readonly (keyof CreativeBrief)[];

/** The source row's fields that carry over to a copy: everything except `DUPLICATE_RESET_FIELDS`. */
function copyableBriefFields(source: CreativeBrief): Partial<NewCreativeBrief> {
  const omit = new Set<string>(DUPLICATE_RESET_FIELDS);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!omit.has(key)) {
      copy[key] = value;
    }
  }
  return copy;
}

/**
 * Copies a live brief of the brand into a new one, or null when the id belongs to another brand or a
 * soft-deleted row — the scope makes those the same outcome.
 *
 * Every editable field carries over (concept and its links, the prose, the attachments, the ratios).
 * What does NOT carry: the NAME and the SEQUENCE, which the caller regenerates from the §7 formula so
 * the copy has its own number (a duplicate is never renamed by hand — non-negotiable 6 — so it is not
 * "name (Copy)"); the two-track STATUS, reset to the caller's defaults, because a copy has not been
 * built or approved; `launched_at`/`launch_priority`, cleared because it has not launched; the three
 * QA ticks, `performance` and `legacy_airtable_id`, none of which a fresh copy has earned; and the
 * propagation lineage (`template_row_id`, `overridden_fields`), because a copy is a new local row, not
 * a propagated one.
 */
export async function duplicateBrief(
  db: Db,
  brandId: string,
  sourceId: string,
  overrides: {
    readonly name: string;
    readonly sequence: number;
    readonly internalStatus: string;
    readonly clientStatus: string;
  },
  actorId: string,
): Promise<CreativeBrief | null> {
  const scope = withBrand(db, brandId);
  const [source] = await scope.select(creativeBriefs, eq(creativeBriefs.id, sourceId)).limit(1);
  if (source === undefined) {
    return null;
  }
  const [row] = await scope
    .insert(creativeBriefs, {
      ...copyableBriefFields(source),
      name: overrides.name,
      sequence: overrides.sequence,
      internalStatus: overrides.internalStatus,
      clientStatus: overrides.clientStatus,
      launchedAt: null,
      launchPriority: null,
      performance: null,
      legacyAirtableId: null,
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: false,
      templateRowId: null,
      overriddenFields: [],
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return row ?? null;
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
