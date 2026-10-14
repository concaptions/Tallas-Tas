import { and, asc, eq, gte, inArray, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  activityLog,
  briefSubmissions,
  creativeBriefs,
  creativeTypes,
  type CreativeType,
} from './schema';
import { withBrand } from './tenancy';

/**
 * The Creative Sheet stats tab (Ticket 12). Pure, brand-scoped loaders over `creative_briefs`,
 * `activity_log` and `brief_submissions`. Nothing here opens a connection; the server component
 * passes an existing `Db`, scoped through `withBrand`.
 *
 * Every function takes `now: Date` so a test can freeze the clock. The weekly chart and the two
 * windowed KPIs anchor off that clock, never `new Date()`.
 *
 * KPI math decisions:
 * - `approved_this_week` reads `activity_log` entries where the brief moved to `internal_status =
 *   'approved'` since the start of this week. The `creative_briefs` row has no `status_updated_at`
 *   column; the activity ledger is the single source of truth for transition timestamps.
 * - `avg_revision_hours` pairs each `revisions_needed` activity row with the NEXT
 *   `revisions_submitted` on the same brief, in time order, over the trailing 30 days. A
 *   `revisions_needed` with no later `revisions_submitted` is ignored (no pair). An empty set
 *   returns `null`, which the UI renders as the em dash.
 * - `qa_pass_rate` is the share of briefs that reached `ad_submitted` or later in the trailing 30
 *   days and ended up approved. Denominator counts distinct briefs with any transition into
 *   `ad_submitted`, `revisions_needed`, `revisions_submitted` or `approved`; numerator counts the
 *   subset of those that transitioned to `approved` in the same window. Empty denominator → `null`.
 * - Week starts on **Monday** (ISO 8601, the convention the PRD uses for creator-tracked weeks).
 */

const BRIEF_ENTITY_TYPE = 'creative_brief';
const INTERNAL_STATUS_FIELD = 'internal_status';

/** Milliseconds in one day; the week and trailing-30-days windows read it. */
const DAY_MS = 86_400_000;

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type WeekdayShort = (typeof WEEKDAY_SHORT)[number];

/** The "In the works" bar categories. */
export interface EditorBar {
  readonly editor: string;
  readonly assigned: number;
  readonly inReview: number;
  readonly approved: number;
}

/** One day's point on the weekly output line, Monday first. */
export interface WeeklyOutputPoint {
  readonly day: WeekdayShort;
  readonly count: number;
}

/** One editor row of the turnaround table; `null` cells are blanks in the UI. */
export interface TurnaroundRow {
  readonly editor: string;
  readonly perType: Readonly<Record<CreativeType, number | null>>;
}

/** The KPI tiles. `null` is the em-dash case: no data in the window. */
export interface BriefStatsKpi {
  readonly inFlight: number;
  readonly approvedThisWeek: number;
  readonly avgRevisionHours: number | null;
  readonly qaPassRatePct: number | null;
}

export interface BriefStats {
  readonly kpi: BriefStatsKpi;
  readonly perEditor: readonly EditorBar[];
  readonly weeklyOutput: readonly WeeklyOutputPoint[];
  readonly turnaround: readonly TurnaroundRow[];
}

/** The six internal-track keys that count as "in flight" (not Draft, not Approved). */
export const IN_FLIGHT_STATUSES = [
  'sent_to_editor_or_designer',
  'under_editing_or_designing',
  'ad_submitted',
  'revisions_needed',
  'revisions_submitted',
] as const;

/** Keys counted in the per-editor "Assigned" bucket. */
const ASSIGNED_STATUSES = ['sent_to_editor_or_designer', 'under_editing_or_designing'] as const;
/** Keys counted in the per-editor "In review" bucket. */
const IN_REVIEW_STATUSES = ['ad_submitted', 'revisions_needed', 'revisions_submitted'] as const;

/**
 * Start of the current week in **Monday-first** reading. `now` is the clock; the return is the
 * midnight of that Monday in the same timezone as the Date. Pure.
 */
export function startOfWeekMonday(now: Date): Date {
  const day = now.getDay(); // 0 = Sun .. 6 = Sat
  // Convert to a 0 = Mon .. 6 = Sun index, then rewind that many days.
  const mondayOffset = (day + 6) % 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

/** `now - 30 * 24h` as the inclusive lower bound of the trailing-30-day window. */
export function trailingThirtyStart(now: Date): Date {
  return new Date(now.getTime() - 30 * DAY_MS);
}

/* ------------------------------------------------------------------------------------------------
 * KPI 1 — Briefs in flight. Count of briefs whose current `internal_status` is one of the six
 * working keys. Live state only — no window.
 * ---------------------------------------------------------------------------------------------- */
export async function briefsInFlight(db: Db, brandId: string): Promise<number> {
  const rows = await withBrand(db, brandId).select(
    creativeBriefs,
    inArray(creativeBriefs.internalStatus, [...IN_FLIGHT_STATUSES]),
  );
  return rows.length;
}

/* ------------------------------------------------------------------------------------------------
 * KPI 2 — Approved this week. Count of DISTINCT briefs whose activity ledger shows a transition
 * into `approved` with `created_at >= start_of_week`. A re-approval in the same week counts the
 * brief once.
 * ---------------------------------------------------------------------------------------------- */
export async function approvedThisWeek(db: Db, brandId: string, now: Date): Promise<number> {
  const start = startOfWeekMonday(now);
  const rows = await withBrand(db, brandId).select(
    activityLog,
    and(
      eq(activityLog.entityType, BRIEF_ENTITY_TYPE),
      eq(activityLog.field, INTERNAL_STATUS_FIELD),
      eq(activityLog.newValue, 'approved'),
      gte(activityLog.createdAt, start),
    ),
  );
  const briefs = new Set(rows.map((row) => row.entityId));
  return briefs.size;
}

/* ------------------------------------------------------------------------------------------------
 * KPI 3 — Average revision turnaround hours over the trailing 30 days. Pair each `revisions_needed`
 * activity row with the next `revisions_submitted` on the same brief. An unpaired `revisions_needed`
 * is skipped. Empty set → null.
 *
 * The 30-day window applies to the `revisions_needed` row's `created_at`; a pair whose "needed"
 * entry is 30d-1h old is INCLUDED, 30d+1h old is EXCLUDED (ticket boundary rule). The paired
 * `revisions_submitted` is read without a window filter so a pair that straddles the boundary is
 * still paired by its `revisions_needed` membership.
 * ---------------------------------------------------------------------------------------------- */
export async function avgRevisionHours(db: Db, brandId: string, now: Date): Promise<number | null> {
  const start = trailingThirtyStart(now);
  const rows = await withBrand(db, brandId)
    .select(
      activityLog,
      and(
        eq(activityLog.entityType, BRIEF_ENTITY_TYPE),
        eq(activityLog.field, INTERNAL_STATUS_FIELD),
        inArray(activityLog.newValue, ['revisions_needed', 'revisions_submitted']),
      ),
    )
    .orderBy(asc(activityLog.entityId), asc(activityLog.createdAt));

  const pairs = pairRevisionRows(rows, start);
  if (pairs.length === 0) return null;
  const totalMs = pairs.reduce((sum, pair) => sum + (pair.submittedAt - pair.neededAt), 0);
  return totalMs / pairs.length / 3_600_000;
}

interface RevisionPair {
  readonly briefId: string;
  readonly neededAt: number;
  readonly submittedAt: number;
}

/**
 * Pair revision activity rows, grouped by brief and read in time order. A `revisions_needed`
 * whose `created_at` is before `windowStart` is skipped, so a stale "needed" row never pairs with
 * a fresh "submitted" one for the trailing window. Exported for test coverage of the pairing rule.
 */
export function pairRevisionRows(
  rows: readonly {
    readonly entityId: string;
    readonly newValue: string | null;
    readonly createdAt: Date | null;
  }[],
  windowStart: Date,
): readonly RevisionPair[] {
  const byBrief = new Map<string, { newValue: string | null; createdAt: Date }[]>();
  for (const row of rows) {
    if (row.createdAt === null) continue;
    const bucket = byBrief.get(row.entityId) ?? [];
    bucket.push({ newValue: row.newValue, createdAt: row.createdAt });
    byBrief.set(row.entityId, bucket);
  }
  const pairs: RevisionPair[] = [];
  const windowMs = windowStart.getTime();
  for (const [briefId, entries] of byBrief) {
    // The caller sorts by (entityId asc, createdAt asc); re-sort defensively so the pure function
    // never relies on the caller's ORDER BY.
    const sorted = [...entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let pendingNeededAt: number | null = null;
    for (const entry of sorted) {
      if (entry.newValue === 'revisions_needed') {
        pendingNeededAt = entry.createdAt.getTime();
      } else if (entry.newValue === 'revisions_submitted' && pendingNeededAt !== null) {
        if (pendingNeededAt >= windowMs) {
          pairs.push({
            briefId,
            neededAt: pendingNeededAt,
            submittedAt: entry.createdAt.getTime(),
          });
        }
        pendingNeededAt = null;
      }
    }
  }
  return pairs;
}

/* ------------------------------------------------------------------------------------------------
 * KPI 4 — Current QA pass rate (trailing 30d). Share of briefs that reached `ad_submitted` or past
 * in the window and are approved. Denominator is distinct briefs with any transition into
 * `ad_submitted`, `revisions_needed`, `revisions_submitted` or `approved` since `start`; numerator
 * is the subset with a transition to `approved` since `start`.
 * ---------------------------------------------------------------------------------------------- */
export async function qaPassRatePct(db: Db, brandId: string, now: Date): Promise<number | null> {
  const start = trailingThirtyStart(now);
  const rows = await withBrand(db, brandId).select(
    activityLog,
    and(
      eq(activityLog.entityType, BRIEF_ENTITY_TYPE),
      eq(activityLog.field, INTERNAL_STATUS_FIELD),
      inArray(activityLog.newValue, [
        'ad_submitted',
        'revisions_needed',
        'revisions_submitted',
        'approved',
      ]),
      gte(activityLog.createdAt, start),
    ),
  );
  const reached = new Set<string>();
  const approved = new Set<string>();
  for (const row of rows) {
    reached.add(row.entityId);
    if (row.newValue === 'approved') approved.add(row.entityId);
  }
  if (reached.size === 0) return null;
  return (approved.size / reached.size) * 100;
}

/* ------------------------------------------------------------------------------------------------
 * Per-editor "in the works" bars. Live state only. Groups by `creative_briefs.assignee`; briefs
 * with a NULL assignee are excluded (they belong to no editor's bar). The result is sorted by total
 * descending; the UI caps at ten with a "+N more" line.
 * ---------------------------------------------------------------------------------------------- */
export async function perEditorBars(db: Db, brandId: string): Promise<readonly EditorBar[]> {
  const assignedOrReviewing = [...ASSIGNED_STATUSES, ...IN_REVIEW_STATUSES, 'approved'];
  const rows = await withBrand(db, brandId).select(
    creativeBriefs,
    inArray(creativeBriefs.internalStatus, assignedOrReviewing),
  );
  const byEditor = new Map<string, { assigned: number; inReview: number; approved: number }>();
  for (const brief of rows) {
    if (brief.assignee === null || brief.assignee.trim() === '') continue;
    const key = brief.assignee;
    const bar = byEditor.get(key) ?? { assigned: 0, inReview: 0, approved: 0 };
    if ((ASSIGNED_STATUSES as readonly string[]).includes(brief.internalStatus)) {
      bar.assigned += 1;
    } else if ((IN_REVIEW_STATUSES as readonly string[]).includes(brief.internalStatus)) {
      bar.inReview += 1;
    } else if (brief.internalStatus === 'approved') {
      bar.approved += 1;
    }
    byEditor.set(key, bar);
  }
  return [...byEditor.entries()]
    .map(([editor, bar]) => ({ editor, ...bar }))
    .sort((a, b) => {
      const totalA = a.assigned + a.inReview + a.approved;
      const totalB = b.assigned + b.inReview + b.approved;
      if (totalB !== totalA) return totalB - totalA;
      return a.editor.localeCompare(b.editor);
    });
}

/* ------------------------------------------------------------------------------------------------
 * Weekly output. Submissions whose `is_current = true` and `uploaded_at >= start_of_week`, bucketed
 * by weekday (Mon..Sun). Missing days read as `count: 0`.
 * ---------------------------------------------------------------------------------------------- */
export async function weeklyOutput(
  db: Db,
  brandId: string,
  now: Date,
): Promise<readonly WeeklyOutputPoint[]> {
  const start = startOfWeekMonday(now);
  // brief_submissions has no `brand_id` column — it's a child of `creative_briefs`. Join to the
  // scoped brief set so a brand never reads another's uploads.
  const rows = await db
    .select({ uploadedAt: briefSubmissions.uploadedAt })
    .from(briefSubmissions)
    .innerJoin(creativeBriefs, eq(briefSubmissions.briefId, creativeBriefs.id))
    .where(
      and(
        eq(creativeBriefs.brandId, brandId),
        isNull(creativeBriefs.deletedAt),
        eq(briefSubmissions.isCurrent, true),
        gte(briefSubmissions.uploadedAt, start),
      ),
    );
  const counts = new Array<number>(7).fill(0);
  for (const row of rows) {
    // Days since the week start, floored to day granularity. Clamp to the current week.
    const diff = Math.floor((row.uploadedAt.getTime() - start.getTime()) / DAY_MS);
    if (diff >= 0 && diff < 7) {
      const index = counts[diff];
      counts[diff] = (index ?? 0) + 1;
    }
  }
  return WEEKDAY_SHORT.map((day, index) => ({ day, count: counts[index] ?? 0 }));
}

/* ------------------------------------------------------------------------------------------------
 * Turnaround table: editor × creative type, average pair duration in hours.
 * ---------------------------------------------------------------------------------------------- */
export async function turnaroundTable(
  db: Db,
  brandId: string,
  now: Date,
): Promise<readonly TurnaroundRow[]> {
  const start = trailingThirtyStart(now);
  // Fetch the brief assignee/type together with the activity rows; one join on the scoped briefs.
  const rows = await db
    .select({
      entityId: activityLog.entityId,
      newValue: activityLog.newValue,
      createdAt: activityLog.createdAt,
      assignee: creativeBriefs.assignee,
      type: creativeBriefs.type,
    })
    .from(activityLog)
    .innerJoin(creativeBriefs, eq(activityLog.entityId, creativeBriefs.id))
    .where(
      and(
        eq(creativeBriefs.brandId, brandId),
        isNull(creativeBriefs.deletedAt),
        eq(activityLog.brandId, brandId),
        isNull(activityLog.deletedAt),
        eq(activityLog.entityType, BRIEF_ENTITY_TYPE),
        eq(activityLog.field, INTERNAL_STATUS_FIELD),
        inArray(activityLog.newValue, ['revisions_needed', 'revisions_submitted']),
      ),
    )
    .orderBy(asc(activityLog.entityId), asc(activityLog.createdAt));

  const pairs = pairRevisionRows(rows, start);
  const briefMeta = new Map<string, { assignee: string | null; type: CreativeType }>();
  for (const row of rows) {
    if (!briefMeta.has(row.entityId)) {
      briefMeta.set(row.entityId, { assignee: row.assignee, type: row.type });
    }
  }

  type Bucket = { total: number; count: number };
  const byEditorAndType = new Map<string, Map<CreativeType, Bucket>>();
  for (const pair of pairs) {
    const meta = briefMeta.get(pair.briefId);
    if (meta === undefined) continue;
    if (meta.assignee === null || meta.assignee.trim() === '') continue;
    const byType = byEditorAndType.get(meta.assignee) ?? new Map<CreativeType, Bucket>();
    const bucket = byType.get(meta.type) ?? { total: 0, count: 0 };
    bucket.total += pair.submittedAt - pair.neededAt;
    bucket.count += 1;
    byType.set(meta.type, bucket);
    byEditorAndType.set(meta.assignee, byType);
  }

  return [...byEditorAndType.entries()]
    .map(([editor, byType]) => {
      const perType = Object.fromEntries(
        creativeTypes.map((type) => {
          const bucket = byType.get(type);
          const hours = bucket === undefined ? null : bucket.total / bucket.count / 3_600_000;
          return [type, hours];
        }),
      ) as Readonly<Record<CreativeType, number | null>>;
      return { editor, perType };
    })
    .sort((a, b) => a.editor.localeCompare(b.editor));
}

/* ------------------------------------------------------------------------------------------------
 * Top-level loader. One brand scope, four parallel reads over PGlite / Neon.
 * ---------------------------------------------------------------------------------------------- */
export async function loadBriefStats(db: Db, brandId: string, now: Date): Promise<BriefStats> {
  const [inFlight, approved, avgHours, passRate, perEditor, weekly, turnaround] = await Promise.all(
    [
      briefsInFlight(db, brandId),
      approvedThisWeek(db, brandId, now),
      avgRevisionHours(db, brandId, now),
      qaPassRatePct(db, brandId, now),
      perEditorBars(db, brandId),
      weeklyOutput(db, brandId, now),
      turnaroundTable(db, brandId, now),
    ],
  );
  return {
    kpi: {
      inFlight,
      approvedThisWeek: approved,
      avgRevisionHours: avgHours,
      qaPassRatePct: passRate,
    },
    perEditor,
    weeklyOutput: weekly,
    turnaround,
  };
}
