import { and, eq, isNull, notInArray } from 'drizzle-orm';

import { updateBrief } from './briefs';
import type { Db } from './db';
import { activityLog } from './schema/activity-log';
import { creativeBriefs } from './schema/briefs';

/** What the live Start E2E test changes on a brief, captured before it clicks. */
export interface BriefSnapshot {
  readonly id: string;
  readonly brandId: string;
  readonly internalStatus: string;
  readonly assignee: string | null;
  readonly updatedBy: string | null;
  /** The activity rows that already existed; whatever else the brief carries afterwards is the test's. */
  readonly activityIds: readonly string[];
}

/**
 * The brief's status, assignee and activity ids as they stand, or throws when the id is not a live
 * row. Unscoped by brand on purpose: the test learns the brand from the brief, not the other way.
 */
export async function snapshotBrief(db: Db, briefId: string): Promise<BriefSnapshot> {
  const [row] = await db
    .select({
      id: creativeBriefs.id,
      brandId: creativeBriefs.brandId,
      internalStatus: creativeBriefs.internalStatus,
      assignee: creativeBriefs.assignee,
      updatedBy: creativeBriefs.updatedBy,
    })
    .from(creativeBriefs)
    .where(and(eq(creativeBriefs.id, briefId), isNull(creativeBriefs.deletedAt)))
    .limit(1);
  if (row === undefined) {
    throw new Error(`brief ${briefId} is not a live row in this database`);
  }
  const activity = await db
    .select({ id: activityLog.id })
    .from(activityLog)
    .where(and(eq(activityLog.entityId, briefId), isNull(activityLog.deletedAt)));
  return { ...row, activityIds: activity.map((entry) => entry.id) };
}

/**
 * Puts the brief back as the snapshot found it and soft-deletes the activity rows written since
 * (soft delete only). Idempotent: a second call finds nothing left to change. The compare is by id,
 * never by clock, so a skew between the test runner and the database cannot leave a row behind.
 */
export async function restoreBrief(db: Db, snapshot: BriefSnapshot): Promise<void> {
  await updateBrief(
    db,
    snapshot.brandId,
    snapshot.id,
    { internalStatus: snapshot.internalStatus, assignee: snapshot.assignee },
    snapshot.updatedBy ?? 'e2e-teardown',
  );
  const added = and(
    eq(activityLog.entityId, snapshot.id),
    isNull(activityLog.deletedAt),
    snapshot.activityIds.length === 0
      ? undefined
      : notInArray(activityLog.id, [...snapshot.activityIds]),
  );
  await db.update(activityLog).set({ deletedAt: new Date() }).where(added);
}
