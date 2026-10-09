import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  creativeBriefs,
  type CreativeBrief,
  type CreativeFunnel,
  type CreativePerformance,
  type CreativePlatform,
  type CreativeType,
} from './schema';
import { withBrand } from './tenancy';
import { creativeSheetName } from './formulas';

/**
 * The Creative Sheet page's data access — since 2026-10-09 a VIEW OVER `creative_briefs`
 * (Talal's single-source cutover, `docs/decisions.md`). The sheet used to be its own table with a
 * second copy of the brief's statuses, QA flags and spell-check; the copies drifted, the client
 * work happened on the sheet while the queues and the portal read the brief, and migration 0061
 * reconciled the two. Now one row of this view IS one live brief of the brand: `id` is the brief's
 * id, every status and flag is the brief's own column, and a brief with no legacy sheet row (19 in
 * production at the cutover) is on the sheet like every other. `creative_sheet_items` is frozen:
 * nothing reads or writes it any more; the drop is a later migration after Talal confirms.
 *
 * Every function takes the database as its first argument (no module-level singleton) and reads
 * through `withBrand(db, brandId)`, so `brand_id = $brandId AND deleted_at IS NULL` is on every
 * statement. Nothing here contains business logic; the Server Actions call these. There are no
 * writers here any more: the sheet's edits are the brief's edits, through `briefs.ts`.
 *
 * The one thing this module computes is the row's NAME. Airtable's primary field is the formula
 * `DATETIME_FORMAT({Created}, "MMMM") & "-" & {Creative Name}`; `creativeSheetName` from
 * `./formulas` computes it from the brief's `created_at` and name, and the page renders it in
 * `font-mono` and never offers an input for it (CLAUDE.md non-negotiable 6).
 */

/**
 * The brief's own fields as the sheet's "Creative Name" lookups show them. Kept nullable from the
 * days a sheet row could exist without a brief, so the grid, the panel and the rail render one
 * shape; every row of the view carries them.
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
 * One Creative Sheet row: a live brief, read for the sheet. `id` and `briefId` are both the
 * brief's id (`briefId` stays so the editor board and the brief rail keep their joins).
 * `internalStatus` and `status` carry the brief's `internal_status` and `client_status` — the two
 * tracks of the state machine in `@tas/domain/state`, no sheet vocabulary of its own any more —
 * and `spellCheckRequested` is the brief's `click_for_ai_spell_checker`. `demoCreativeSheetItems`
 * is built by the same function over the demo briefs, so fixtures and rows share one shape.
 */
export interface CreativeSheetItemListRow extends CreativeSheetBriefFields {
  readonly id: string;
  readonly brandId: string;
  readonly briefId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly legacyAirtableId: string | null;
  readonly name: string;
  readonly internalStatus: string;
  readonly status: string;
  readonly qaChecklistDoc: string[] | null;
  readonly qaVideoEditor: boolean;
  readonly qaDesigner: boolean;
  readonly qaStrategist: boolean;
  readonly spellCheckRequested: boolean;
  readonly spellingFeedback: string | null;
  readonly dimensions: string[];
}

/** The brief columns the view reads; `BriefListRow` and the demo fixtures both satisfy it. */
export type CreativeSheetBriefSource = Pick<
  CreativeBrief,
  | 'id'
  | 'brandId'
  | 'createdAt'
  | 'updatedAt'
  | 'legacyAirtableId'
  | 'name'
  | 'type'
  | 'platform'
  | 'funnel'
  | 'performance'
  | 'designFileUrl'
  | 'internalStatus'
  | 'clientStatus'
  | 'qaChecklistDoc'
  | 'qaVideoEditor'
  | 'qaDesigner'
  | 'qaStrategist'
  | 'clickForAiSpellChecker'
  | 'spellingFeedback'
  | 'dimensions'
>;

/** One brief as a sheet row. Pure; the only computation is the name formula. */
export function sheetRowFromBrief(brief: CreativeSheetBriefSource): CreativeSheetItemListRow {
  return {
    id: brief.id,
    brandId: brief.brandId,
    briefId: brief.id,
    createdAt: brief.createdAt,
    updatedAt: brief.updatedAt,
    legacyAirtableId: brief.legacyAirtableId,
    // `created_at` is NOT NULL in Postgres, so the formula's null branch is unreachable here; the
    // fallback keeps `name` non-nullable without widening the row type.
    name: creativeSheetName(brief.createdAt, brief.name) ?? '',
    internalStatus: brief.internalStatus,
    status: brief.clientStatus,
    qaChecklistDoc: brief.qaChecklistDoc,
    qaVideoEditor: brief.qaVideoEditor,
    qaDesigner: brief.qaDesigner,
    qaStrategist: brief.qaStrategist,
    spellCheckRequested: brief.clickForAiSpellChecker,
    spellingFeedback: brief.spellingFeedback,
    dimensions: brief.dimensions,
    briefName: brief.name,
    briefType: brief.type,
    briefPlatform: brief.platform,
    briefFunnel: brief.funnel,
    briefPerformance: brief.performance,
    briefDesignFileUrl: brief.designFileUrl,
  };
}

/** The brand's live briefs as sheet rows, newest edit first — every brief, sheet row or not. */
export async function listCreativeSheetItems(
  db: Db,
  brandId: string,
): Promise<CreativeSheetItemListRow[]> {
  const rows = await withBrand(db, brandId)
    .select(creativeBriefs)
    .orderBy(desc(creativeBriefs.updatedAt));
  return rows.map(sheetRowFromBrief);
}

/** One live brief of the brand as a sheet row, or null: another brand's id never resolves. */
export async function getCreativeSheetItemById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreativeSheetItemListRow | null> {
  const [row] = await withBrand(db, brandId)
    .select(creativeBriefs, eq(creativeBriefs.id, id))
    .limit(1);
  return row === undefined ? null : sheetRowFromBrief(row);
}
