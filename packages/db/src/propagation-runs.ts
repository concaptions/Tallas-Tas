import type { Db } from './db';
import { propagationRuns, type PropagationRun, type PropagationTrigger } from './schema';

export interface PropagationRunInput {
  readonly templateBrandId: string;
  readonly tableName: string;
  readonly trigger: PropagationTrigger;
  /** The parent row fanned out, when the run was about one row; null for a sweep or config push. */
  readonly templateRowId: string | null;
  readonly childrenUpdated: number;
  readonly skipped: number;
}

/**
 * One ledger row per propagation (migration 0034). Until 2026-10-10 nothing wrote this table —
 * production had zero rows — so a push could not be audited. Written beside the propagation it
 * records, never instead of it: a run that threw leaves no row, and a row says a run happened.
 */
export async function recordPropagationRun(
  db: Db,
  input: PropagationRunInput,
  actorId: string,
): Promise<PropagationRun> {
  const [row] = await db
    .insert(propagationRuns)
    .values({ ...input, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) throw new Error('recordPropagationRun: insert returned no row');
  return row;
}
