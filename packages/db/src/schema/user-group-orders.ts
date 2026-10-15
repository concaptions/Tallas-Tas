import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { brands } from './brands';
import { users } from './users';
import { userTableViews } from './user-table-views';

/**
 * One entry of a user's manually ordered groups on a grouped table view (Phase B5 commit 2;
 * migration 0072). `value` is the raw group value (status key, assignee id, …); `position` is the
 * 0-indexed slot the user put it in; `pinned` lifts it above every unpinned entry — several pinned
 * entries keep their relative `position`.
 */
export interface GroupOrderEntry {
  readonly value: string;
  readonly position: number;
  readonly pinned: boolean;
}

/**
 * Per-user ordering of group values on a grouped view (Phase B5 commit 2). One row stores the
 * manual order the user has arranged for a specific (user, brand, table, grouping field) scope,
 * either GLOBALLY for that scope (`view_id` NULL — one row per `(user, brand, table, field)`) or
 * inside one saved VIEW (`view_id` NOT NULL — one row per `(user, brand, view, table, field)`).
 * The partial unique indexes on migration 0072 enforce exactly that pair of rules, which a plain
 * UNIQUE across a nullable column cannot do (Postgres treats NULL ≠ NULL for uniqueness).
 *
 * This table deliberately OMITS the shared `baseColumns()` members (`created_at`, `created_by`,
 * `deleted_at`, …). It is a user-preference log, not business data: the migration keeps only `id`,
 * the scope keys, the `order_json` payload and `updated_at`. Reads and writes hard-delete rows
 * (`clearGroupOrder`); nothing here participates in propagation, soft-delete or activity log.
 */
export const userGroupOrders = pgTable(
  'user_group_orders',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    viewId: uuid('view_id').references(() => userTableViews.id, { onDelete: 'cascade' }),
    tableKey: text('table_key').notNull(),
    fieldKey: text('field_key').notNull(),
    orderJson: jsonb('order_json').$type<GroupOrderEntry[]>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_group_orders_scope_unique_null_view')
      .on(table.userId, table.brandId, table.tableKey, table.fieldKey)
      .where(sql`${table.viewId} IS NULL`),
    uniqueIndex('user_group_orders_scope_unique_with_view')
      .on(table.userId, table.brandId, table.viewId, table.tableKey, table.fieldKey)
      .where(sql`${table.viewId} IS NOT NULL`),
    index('user_group_orders_lookup_idx').on(
      table.userId,
      table.brandId,
      table.tableKey,
      table.fieldKey,
    ),
  ],
);

export type UserGroupOrder = typeof userGroupOrders.$inferSelect;
export type NewUserGroupOrder = typeof userGroupOrders.$inferInsert;
