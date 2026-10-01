import { and, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { userTableViews, type UserTableView } from './schema';

/**
 * Per-user saved views (Sprint 7, VIEWS-01). Every function takes the database first (no
 * module-level singleton) and every statement carries `user_id = $userId AND deleted_at IS NULL`:
 * the user id is the tenancy edge of this table the way `brand_id` is on a branded one, so one
 * person can never list, rename, re-point or delete another's view, and `user-table-views.test.ts`
 * proves it. Nothing here contains business logic — what a view MEANS (`applyUserView`) and what a
 * valid name is live in `@tas/domain/views`; the Server Actions call those first.
 */

/** The columns a caller may write; the scope, the clock and the actor own the rest. */
export interface UserTableViewConfigInput {
  readonly viewType?: string;
  readonly visibleFields?: string[] | null;
  readonly fieldOrder?: string[];
  readonly frozenFields?: string[];
  readonly sort?: { key: string; direction: 'asc' | 'desc' } | null;
  readonly filter?: string;
}

/** The user's live views of one table, oldest first so a tab strip keeps a stable order. */
export async function listUserTableViews(
  db: Db,
  userId: string,
  tableKey: string,
): Promise<UserTableView[]> {
  return db
    .select()
    .from(userTableViews)
    .where(
      and(
        eq(userTableViews.userId, userId),
        eq(userTableViews.tableKey, tableKey),
        isNull(userTableViews.deletedAt),
      ),
    )
    .orderBy(userTableViews.createdAt, desc(userTableViews.id));
}

/** One of the user's own views, or null when the id is not theirs (or is deleted). */
export async function getUserTableView(
  db: Db,
  userId: string,
  id: string,
): Promise<UserTableView | null> {
  const [row] = await db
    .select()
    .from(userTableViews)
    .where(
      and(
        eq(userTableViews.id, id),
        eq(userTableViews.userId, userId),
        isNull(userTableViews.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Clears the active flag on every one of the user's views of a table (one active at a time). */
async function deactivateAll(db: Db, userId: string, tableKey: string): Promise<void> {
  await db
    .update(userTableViews)
    .set({ isActive: false, updatedAt: new Date(), updatedBy: userId })
    .where(
      and(
        eq(userTableViews.userId, userId),
        eq(userTableViews.tableKey, tableKey),
        isNull(userTableViews.deletedAt),
      ),
    );
}

/** Creates a view for the user and makes it their active view of the table. */
export async function createUserTableView(
  db: Db,
  userId: string,
  tableKey: string,
  name: string,
  config: UserTableViewConfigInput = {},
): Promise<UserTableView> {
  await deactivateAll(db, userId, tableKey);
  const [row] = await db
    .insert(userTableViews)
    .values({
      userId,
      tableKey,
      name,
      viewType: config.viewType ?? 'grid',
      visibleFields: config.visibleFields ?? null,
      fieldOrder: config.fieldOrder ?? [],
      frozenFields: config.frozenFields ?? [],
      sort: config.sort ?? null,
      filter: config.filter ?? '',
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();
  if (row === undefined) throw new Error('user_table_views insert returned no row');
  return row;
}

/** Renames one of the user's views; null when the id is not theirs. */
export async function renameUserTableView(
  db: Db,
  userId: string,
  id: string,
  name: string,
): Promise<UserTableView | null> {
  const [row] = await db
    .update(userTableViews)
    .set({ name, updatedAt: new Date(), updatedBy: userId })
    .where(
      and(
        eq(userTableViews.id, id),
        eq(userTableViews.userId, userId),
        isNull(userTableViews.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/** Writes part of a view's config (the Fields popover, a sort, a freeze); null when not theirs. */
export async function updateUserTableViewConfig(
  db: Db,
  userId: string,
  id: string,
  config: UserTableViewConfigInput,
): Promise<UserTableView | null> {
  const [row] = await db
    .update(userTableViews)
    .set({ ...config, updatedAt: new Date(), updatedBy: userId })
    .where(
      and(
        eq(userTableViews.id, id),
        eq(userTableViews.userId, userId),
        isNull(userTableViews.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Makes one of the user's views the active one for its table, or none when `id` is null (the
 * table's default lens). Returns the activated view, or null when the id is not theirs.
 */
export async function activateUserTableView(
  db: Db,
  userId: string,
  tableKey: string,
  id: string | null,
): Promise<UserTableView | null> {
  await deactivateAll(db, userId, tableKey);
  if (id === null) return null;
  const [row] = await db
    .update(userTableViews)
    .set({ isActive: true, updatedAt: new Date(), updatedBy: userId })
    .where(
      and(
        eq(userTableViews.id, id),
        eq(userTableViews.userId, userId),
        eq(userTableViews.tableKey, tableKey),
        isNull(userTableViews.deletedAt),
      ),
    )
    .returning();
  return row ?? null;
}

/** Soft-deletes one of the user's views (never `DELETE FROM`); false when the id is not theirs. */
export async function deleteUserTableView(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(userTableViews)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date(), updatedBy: userId })
    .where(
      and(
        eq(userTableViews.id, id),
        eq(userTableViews.userId, userId),
        isNull(userTableViews.deletedAt),
      ),
    )
    .returning({ id: userTableViews.id });
  return rows.length > 0;
}
