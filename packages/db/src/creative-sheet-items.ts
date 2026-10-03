import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  creativeBriefs,
  creativeSheetItems,
  type CreativeBrief,
  type CreativeFunnel,
  type CreativePerformance,
  type CreativePlatform,
  type CreativeSheetItem,
  type CreativeType,
  type NewCreativeSheetItem,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';
import { creativeSheetName } from './formulas';

/**
 * The Creative Sheet page's data access (Airtable `tblGC0TxnHI7lKaNQ`, audit §2.3). A copy of
 * `products.ts`, function for function: every function takes the database as its first argument
 * (no module-level singleton) and reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose
 * its own brand. Nothing here contains business logic; the Server Actions call these.
 *
 * The one thing this module computes is the row's NAME. Airtable's primary field is the formula
 * `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}`; the schema stores no name column
 * (CLAUDE.md non-negotiable 6), so `creativeSheetName` from `./formulas` computes it from `created_at` and the
 * joined brief's name, and the page renders it in `font-mono` and never offers an input for it.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel submits for create, or patches on update. */
export type CreativeSheetItemInput = Omit<NewCreativeSheetItem, ManagedColumn>;

/**
 * The Airtable lookups a sheet row reads through its "Creative Name" link, each null when the row
 * has no brief or its brief is another brand's or soft-deleted (the scoped read makes those the same
 * outcome). Never stored: a lookup is a join, and a stored copy would drift from the brief.
 */
export interface CreativeSheetBriefFields {
  briefName: string | null;
  briefType: CreativeType | null;
  briefPlatform: CreativePlatform[];
  briefFunnel: CreativeFunnel | null;
  briefPerformance: CreativePerformance | null;
  briefDesignFileUrl: string | null;
}

/**
 * A sheet row as the grid and the panel render it: the row, the computed `name`, and the brief's
 * fields. `demoCreativeSheetItems` satisfies `CreativeSheetItemListRow[]`, so the page reads demo
 * fixtures and database rows through one type.
 */
export type CreativeSheetItemListRow = CreativeSheetItem &
  CreativeSheetBriefFields & { name: string };

/** The brand's live briefs by id, for the join. Scoped, so another brand's brief never resolves. */
async function briefsById(scope: BrandScope): Promise<Map<string, CreativeBrief>> {
  const rows = await scope.select(creativeBriefs);
  return new Map(rows.map((row) => [row.id, row]));
}

/** One row plus its brief's fields and its computed name. */
function withBrief(
  row: CreativeSheetItem,
  briefs: Map<string, CreativeBrief>,
): CreativeSheetItemListRow {
  const brief = row.briefId === null ? undefined : briefs.get(row.briefId);
  const briefName = brief?.name ?? null;
  return {
    ...row,
    // `created_at` is NOT NULL in Postgres, so the formula's null branch — an absent timestamp —
    // is unreachable here; the fallback keeps `name` non-nullable without widening the row type.
    name: creativeSheetName(row.createdAt, briefName) ?? '',
    briefName,
    briefType: brief?.type ?? null,
    briefPlatform: brief?.platform ?? [],
    briefFunnel: brief?.funnel ?? null,
    briefPerformance: brief?.performance ?? null,
    briefDesignFileUrl: brief?.designFileUrl ?? null,
  };
}

/** The brand's live sheet rows, newest edit first, each named and joined to its brief. */
export async function listCreativeSheetItems(
  db: Db,
  brandId: string,
): Promise<CreativeSheetItemListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, briefs] = await Promise.all([
    scope.select(creativeSheetItems).orderBy(desc(creativeSheetItems.updatedAt)),
    briefsById(scope),
  ]);
  return rows.map((row) => withBrief(row, briefs));
}

/** One live sheet row of the brand, or null: another brand's id never resolves. */
export async function getCreativeSheetItemById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreativeSheetItemListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(creativeSheetItems, eq(creativeSheetItems.id, id)).limit(1);
  if (row === undefined) return null;
  return withBrief(row, await briefsById(scope));
}

/** Creates a sheet row in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertCreativeSheetItem(
  db: Db,
  brandId: string,
  values: CreativeSheetItemInput,
  actorId: string,
): Promise<CreativeSheetItem> {
  const [row] = await withBrand(db, brandId)
    .insert(creativeSheetItems, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creative_sheet_items insert returned no row');
  }
  return row;
}

/**
 * Patches one live sheet row of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCreativeSheetItem(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreativeSheetItemInput>,
  actorId: string,
): Promise<CreativeSheetItem | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      creativeSheetItems,
      { ...patch, updatedBy: actorId, updatedAt: new Date() },
      eq(creativeSheetItems.id, id),
    )
    .returning();
  return row ?? null;
}
