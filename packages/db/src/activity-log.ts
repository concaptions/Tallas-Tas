import { desc, eq } from 'drizzle-orm';

import type { Db } from './db';
import { activityLog, type ActivityEntry } from './schema';
import { withBrand } from './tenancy';

/**
 * The activity log's data access (Sprint 10, EDIT-03). Scoped by brand through `withBrand` like
 * every record it describes, so one brand never reads another's history. `insertActivity` takes
 * the changes a Server Action computed with `diffFields` and writes one row per change, with the
 * actor's id on `created_by` and the name the page prints on `actor_name`.
 */
export interface ActivityChangeInput {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

export interface ActivityActor {
  readonly id: string;
  readonly name: string | null;
}

export async function insertActivity(
  db: Db,
  brandId: string,
  entityType: string,
  entityId: string,
  changes: readonly ActivityChangeInput[],
  actor: ActivityActor,
): Promise<ActivityEntry[]> {
  if (changes.length === 0) return [];
  const rows: ActivityEntry[] = [];
  for (const change of changes) {
    const [row] = await withBrand(db, brandId)
      .insert(activityLog, {
        entityType,
        entityId,
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
        actorName: actor.name,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();
    if (row !== undefined) rows.push(row);
  }
  return rows;
}

/** One record's history, newest first. */
export async function listActivity(
  db: Db,
  brandId: string,
  entityType: string,
  entityId: string,
): Promise<ActivityEntry[]> {
  const rows = await withBrand(db, brandId)
    .select(activityLog, eq(activityLog.entityId, entityId))
    .orderBy(desc(activityLog.createdAt), desc(activityLog.id));
  return rows.filter((row) => row.entityType === entityType);
}
