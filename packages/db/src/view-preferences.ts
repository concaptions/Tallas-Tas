import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { viewPreferences, type ViewPreference } from './schema';

export async function getViewPreference(
  db: Db,
  userId: string,
  brandId: string,
  tableKey: string,
): Promise<ViewPreference | undefined> {
  const [row] = await db
    .select()
    .from(viewPreferences)
    .where(
      and(
        eq(viewPreferences.userId, userId),
        eq(viewPreferences.brandId, brandId),
        eq(viewPreferences.tableKey, tableKey),
        isNull(viewPreferences.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

export async function saveViewPreference(
  db: Db,
  userId: string,
  brandId: string,
  tableKey: string,
  viewType: string,
  kanbanGroupByField: string | null,
): Promise<ViewPreference> {
  const existing = await getViewPreference(db, userId, brandId, tableKey);
  if (existing) {
    const [row] = await db
      .update(viewPreferences)
      .set({
        viewType,
        kanbanGroupByField,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(viewPreferences.id, existing.id))
      .returning();
    return row as ViewPreference;
  }
  const [row] = await db
    .insert(viewPreferences)
    .values({
      userId,
      brandId,
      tableKey,
      viewType,
      kanbanGroupByField,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();
  return row as ViewPreference;
}
