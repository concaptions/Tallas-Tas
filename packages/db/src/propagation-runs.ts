import { and, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  propagationRuns,
  type PropagationRun,
  type PropagationTrigger,
} from './schema/propagation-runs';

/**
 * The propagation ledger's writes and reads (CLAUDE.md architecture: propagation "applies the parent
 * diff to every child, skipping overridden fields"). `propagation_runs` is a template-level
 * operational log, not a per-brand content table, so it is queried directly and scoped by
 * `template_brand_id` — the same shape the global `themes` library takes, and deliberately NOT
 * `withBrand`, which is for per-brand rows.
 *
 * Nothing here decides WHEN to log or WHAT the counts are: the propagation engine calls
 * `logPropagationRun` with the outcome it just produced.
 */

export interface PropagationRunInput {
  readonly templateBrandId: string;
  readonly tableName: string;
  readonly trigger: PropagationTrigger;
  /** The parent row that fanned out, or null for a sweep, seed or config push. */
  readonly templateRowId?: string | null;
  readonly childrenUpdated: number;
  readonly skipped: number;
}

/** Records one propagation the engine ran. `created_by` carries the actor, `created_at` the moment. */
export async function logPropagationRun(
  db: Db,
  input: PropagationRunInput,
  actorId: string,
): Promise<PropagationRun> {
  const [row] = await db
    .insert(propagationRuns)
    .values({
      templateBrandId: input.templateBrandId,
      tableName: input.tableName,
      trigger: input.trigger,
      templateRowId: input.templateRowId ?? null,
      childrenUpdated: input.childrenUpdated,
      skipped: input.skipped,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  if (row === undefined) {
    throw new Error('propagation_runs insert returned no row');
  }
  return row;
}

/**
 * The Run History tab's rows: every live run for one agency's template, newest first. `limit` caps
 * the page; the default shows the recent history without an unbounded scan.
 */
export async function listPropagationRuns(
  db: Db,
  templateBrandId: string,
  limit = 50,
): Promise<PropagationRun[]> {
  return db
    .select()
    .from(propagationRuns)
    .where(
      and(eq(propagationRuns.templateBrandId, templateBrandId), isNull(propagationRuns.deletedAt)),
    )
    .orderBy(desc(propagationRuns.createdAt))
    .limit(limit);
}
