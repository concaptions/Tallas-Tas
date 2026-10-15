import { and, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from './db';
import { userGroupOrders, type GroupOrderEntry } from './schema';

/**
 * Per-user, per-scope ordering of group values on a grouped table view (Phase B5 commit 2;
 * migration 0072). Reader + writer + hard-delete. Everything scoped by `(user_id, brand_id,
 * table_key, field_key, view_id?)`. There is no soft-delete here: this is a UI preference, not
 * business data; a hard delete is `clearGroupOrder`.
 *
 * `view_id` is nullable: a NULL row stores the user's GLOBAL order for a table+field across every
 * view they have of it; a non-null row overrides the global one for THAT view. The read fallback
 * chain is view-first, then global.
 *
 * Why the writer branches on `view_id` rather than a single `onConflictDoUpdate(target: all)`:
 * migration 0072 enforces uniqueness with two PARTIAL indexes (one `WHERE view_id IS NULL`, one
 * `WHERE view_id IS NOT NULL`), because a plain UNIQUE across a nullable column does not treat
 * NULL as equal to NULL. Postgres's ON CONFLICT needs the exact matching index predicate, so the
 * writer picks the one that applies to the row it is sending.
 */
export interface GroupOrderScope {
  readonly db: Db;
  readonly userId: string;
  readonly brandId: string;
  /** `null` means the global order for this (user, brand, table, field) scope. */
  readonly viewId: string | null;
  readonly tableKey: string;
  readonly fieldKey: string;
}

export type { GroupOrderEntry } from './schema';

/**
 * The viewer's saved order of the groups on one grouped table (view-first, then global). Returns
 * `null` when neither row exists: the caller then falls back to the vocabulary's default order
 * (status enum for a status column, alphabetical otherwise — `applyGroupOrder` owns that rule).
 */
export async function getGroupOrder(scope: GroupOrderScope): Promise<GroupOrderEntry[] | null> {
  const { db, userId, brandId, viewId, tableKey, fieldKey } = scope;

  if (viewId !== null) {
    const [row] = await db
      .select({ orderJson: userGroupOrders.orderJson })
      .from(userGroupOrders)
      .where(
        and(
          eq(userGroupOrders.userId, userId),
          eq(userGroupOrders.brandId, brandId),
          eq(userGroupOrders.viewId, viewId),
          eq(userGroupOrders.tableKey, tableKey),
          eq(userGroupOrders.fieldKey, fieldKey),
        ),
      );
    if (row) return row.orderJson;
  }

  const [global] = await db
    .select({ orderJson: userGroupOrders.orderJson })
    .from(userGroupOrders)
    .where(
      and(
        eq(userGroupOrders.userId, userId),
        eq(userGroupOrders.brandId, brandId),
        isNull(userGroupOrders.viewId),
        eq(userGroupOrders.tableKey, tableKey),
        eq(userGroupOrders.fieldKey, fieldKey),
      ),
    );

  return global ? global.orderJson : null;
}

/**
 * Writes the viewer's order for this scope, replacing whatever was there. One row per scope: the
 * writer upserts against the correct partial unique index, so a save of the same scope twice
 * yields exactly one row (idempotency pin in the tests).
 */
export async function saveGroupOrder(
  input: GroupOrderScope & { readonly order: readonly GroupOrderEntry[] },
): Promise<void> {
  const { db, userId, brandId, viewId, tableKey, fieldKey, order } = input;
  const orderJson = order as GroupOrderEntry[];

  if (viewId === null) {
    await db
      .insert(userGroupOrders)
      .values({ userId, brandId, viewId: null, tableKey, fieldKey, orderJson })
      .onConflictDoUpdate({
        target: [
          userGroupOrders.userId,
          userGroupOrders.brandId,
          userGroupOrders.tableKey,
          userGroupOrders.fieldKey,
        ],
        targetWhere: sql`${userGroupOrders.viewId} IS NULL`,
        set: { orderJson, updatedAt: new Date() },
      });
    return;
  }

  await db
    .insert(userGroupOrders)
    .values({ userId, brandId, viewId, tableKey, fieldKey, orderJson })
    .onConflictDoUpdate({
      target: [
        userGroupOrders.userId,
        userGroupOrders.brandId,
        userGroupOrders.viewId,
        userGroupOrders.tableKey,
        userGroupOrders.fieldKey,
      ],
      targetWhere: sql`${userGroupOrders.viewId} IS NOT NULL`,
      set: { orderJson, updatedAt: new Date() },
    });
}

/**
 * Removes the viewer's stored order for this scope. No-op when no row matches (not an error — the
 * caller may be clearing a scope that was never saved). This is the one place in the codebase that
 * hard-deletes a user row, allowed here because the row is a preference, not business data (see
 * module header).
 */
export async function clearGroupOrder(scope: GroupOrderScope): Promise<void> {
  const { db, userId, brandId, viewId, tableKey, fieldKey } = scope;
  const scopeCondition =
    viewId === null ? isNull(userGroupOrders.viewId) : eq(userGroupOrders.viewId, viewId);

  await db
    .delete(userGroupOrders)
    .where(
      and(
        eq(userGroupOrders.userId, userId),
        eq(userGroupOrders.brandId, brandId),
        scopeCondition,
        eq(userGroupOrders.tableKey, tableKey),
        eq(userGroupOrders.fieldKey, fieldKey),
      ),
    );
}
