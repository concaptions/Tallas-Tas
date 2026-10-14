import { eq, sql } from 'drizzle-orm';

import type { Db } from './db';
import { brands, creativeBriefs } from './schema';
import type { BriefNameMode, CreativeFunnel, CreativeSource, CreativeType } from './schema';

/**
 * Ticket 3 audit (Oct 14 cutover). READ-ONLY. Reports the shape of `creative_briefs.name_mode`
 * across the brands and lists every brief whose current `name` does NOT round-trip through the
 * formula applied to its own fields — a GAP REPORT, not a fix.
 *
 * `@tas/db` does not depend on `@tas/domain` (dependency edge app → db, app → domain, never
 * db → domain), so the formula is INJECTED: the caller supplies a `nameFor(row)` that produces
 * the expected name. The `.mjs` wrapper spells the formula out directly for the production run,
 * and the PGlite-based test imports `buildBriefName` from `@tas/domain/briefs` to prove the two
 * paths agree.
 *
 * Not for Railway. The current fleet is all `manual` and hand-typed, so most live rows will show
 * up as a gap; the audit is a diagnostic for Haroon to run when they want to see which auto-named
 * rows (if any) have drifted from the formula.
 */

export interface BriefNameModeCounts {
  readonly nameMode: string;
  readonly briefs: number;
}

export interface BriefNameRow {
  readonly id: string;
  readonly brandSlug: string | null;
  readonly nameMode: BriefNameMode;
  readonly storedName: string;
  readonly source: CreativeSource;
  readonly funnel: CreativeFunnel;
  readonly type: CreativeType;
  readonly briefNumber: number | null;
  readonly batch: string | null;
}

export interface BriefNameGap {
  readonly id: string;
  readonly brand: string | null;
  readonly nameMode: BriefNameMode;
  readonly stored: string;
  readonly expected: string;
}

export interface BriefNamesAudit {
  readonly countsByMode: readonly BriefNameModeCounts[];
  readonly gaps: readonly BriefNameGap[];
}

/**
 * Produces both the per-mode counts and the gap list. `nameFor` is the formula the caller wants
 * compared against the stored name — in production, `buildBriefName` from `@tas/domain/briefs`
 * composed with the row's own columns. The audit never queries the concept, so `nameFor` is
 * called with just the row's identity-shaping columns; a drift that depends on the concept slug
 * is out of scope for this gap report.
 */
export async function auditBriefNames(
  db: Db,
  nameFor: (row: BriefNameRow) => string,
): Promise<BriefNamesAudit> {
  const countRows = await db
    .select({
      nameMode: creativeBriefs.nameMode,
      briefs: sql<number>`count(*)::int`,
    })
    .from(creativeBriefs)
    .where(sql`${creativeBriefs.deletedAt} IS NULL`)
    .groupBy(creativeBriefs.nameMode);

  const briefRows = await db
    .select({
      id: creativeBriefs.id,
      brandSlug: brands.slug,
      nameMode: creativeBriefs.nameMode,
      storedName: creativeBriefs.name,
      source: creativeBriefs.source,
      funnel: creativeBriefs.funnel,
      type: creativeBriefs.type,
      briefNumber: creativeBriefs.briefNumber,
      batch: creativeBriefs.batch,
    })
    .from(creativeBriefs)
    .leftJoin(brands, eq(brands.id, creativeBriefs.brandId))
    .where(sql`${creativeBriefs.deletedAt} IS NULL`);

  const gaps: BriefNameGap[] = [];
  for (const row of briefRows) {
    const expected = nameFor(row);
    if (row.storedName !== expected) {
      gaps.push({
        id: row.id,
        brand: row.brandSlug,
        nameMode: row.nameMode,
        stored: row.storedName,
        expected,
      });
    }
  }

  return { countsByMode: countRows, gaps };
}
