import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  creativeBriefs,
  creativeReporting,
  type CreativeReport,
  type NewCreativeReport,
} from './schema';
import { withBrand, type BrandScope } from './tenancy';

/**
 * The Creative Reporting page's data access (Airtable "Creative Reporting", `tblgW4bwDSSeqihlr`;
 * audit §2 row 14 and §14). A copy of `products.ts`, function for function: every function takes
 * the database first (no singleton), reads and writes go through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and an insert cannot choose its
 * own brand. Nothing here is business logic.
 *
 * The base's one formula, "Difference CPA" (`cpa − target_cpa`), is computed HERE, never stored and
 * never computed inside a component; the broken lookup "Creative Name (from Creative)" is replaced
 * by `briefName`, read through `brief_id` against the brand's own live briefs.
 */

/** The columns the scope, the clock and the actor own; a caller never sets them. */
type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

/** What the panel submits for create (`nameAngleOffer` required) or patches. */
export type CreativeReportInput = Omit<NewCreativeReport, ManagedColumn>;

/**
 * A report as the grid and the panel render it: the row plus the brief's name (the lookup) and the
 * difference formula. `demoCreativeReports` satisfies this type, so the page reads fixtures and
 * database rows through one shape.
 */
export type CreativeReportListRow = CreativeReport & {
  /** The linked brief's auto-generated name, or null when unlinked or the brief is not the brand's. */
  briefName: string | null;
  /** "Difference CPA" = `cpa − target_cpa`, in currency units; null while either side is unset. */
  differenceCpa: number | null;
};

/**
 * The base's "Difference CPA" formula over two `numeric` columns (Postgres hands them back as
 * strings). Rounded to cents so a binary float never shows `2.4999999` where the base shows 2.50.
 */
export function creativeReportDifferenceCpa(
  cpa: string | null,
  targetCpa: string | null,
): number | null {
  if (cpa === null || targetCpa === null) return null;
  const difference = Number(cpa) - Number(targetCpa);
  if (!Number.isFinite(difference)) return null;
  return Math.round(difference * 100) / 100;
}

/** The brand's live briefs, id → name: the only briefs a report may name or link. */
async function briefNames(scope: BrandScope): Promise<Map<string, string>> {
  const briefs = await scope.select(creativeBriefs);
  return new Map(briefs.map((brief) => [brief.id, brief.name]));
}

function decorate(row: CreativeReport, briefs: Map<string, string>): CreativeReportListRow {
  return {
    ...row,
    briefName: row.briefId === null ? null : (briefs.get(row.briefId) ?? null),
    differenceCpa: creativeReportDifferenceCpa(row.cpa, row.targetCpa),
  };
}

/**
 * A submitted `briefId` kept only when it is one of the brand's live briefs; anything else — another
 * brand's brief, a soft-deleted one, an unknown id — is stored as NULL rather than linked. The same
 * rule the junction sync helpers apply to a foreign id.
 */
async function ownBriefId(scope: BrandScope, briefId: string | null | undefined) {
  if (briefId === null || briefId === undefined) return null;
  return (await briefNames(scope)).has(briefId) ? briefId : null;
}

/** The brand's live reports, newest edit first, each with its brief name and difference. */
export async function listCreativeReports(
  db: Db,
  brandId: string,
): Promise<CreativeReportListRow[]> {
  const scope = withBrand(db, brandId);
  const [rows, briefs] = await Promise.all([
    scope.select(creativeReporting).orderBy(desc(creativeReporting.updatedAt)),
    briefNames(scope),
  ]);
  return rows.map((row) => decorate(row, briefs));
}

/** One live report of the brand, decorated, or null: another brand's id never resolves. */
export async function getCreativeReportById(
  db: Db,
  brandId: string,
  id: string,
): Promise<CreativeReportListRow | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope.select(creativeReporting, eq(creativeReporting.id, id)).limit(1);
  if (row === undefined) return null;
  return decorate(row, await briefNames(scope));
}

/** Creates a report in the scope; `brand_id` is the scope's, whatever `values` says. */
export async function insertCreativeReport(
  db: Db,
  brandId: string,
  values: CreativeReportInput,
  actorId: string,
): Promise<CreativeReport> {
  const scope = withBrand(db, brandId);
  const briefId = await ownBriefId(scope, values.briefId);
  const [row] = await scope
    .insert(creativeReporting, { ...values, briefId, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('creative_reporting insert returned no row');
  }
  return row;
}

/**
 * Patches one live report of the brand and returns it, or null when the id belongs to another
 * brand or to a soft-deleted row — the scope makes those the same outcome: zero rows changed.
 */
export async function updateCreativeReport(
  db: Db,
  brandId: string,
  id: string,
  patch: Partial<CreativeReportInput>,
  actorId: string,
): Promise<CreativeReport | null> {
  const scope = withBrand(db, brandId);
  const briefPatch = 'briefId' in patch ? { briefId: await ownBriefId(scope, patch.briefId) } : {};
  const [row] = await scope
    .update(
      creativeReporting,
      { ...patch, ...briefPatch, updatedBy: actorId, updatedAt: new Date() },
      eq(creativeReporting.id, id),
    )
    .returning();
  return row ?? null;
}
