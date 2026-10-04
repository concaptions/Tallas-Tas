import { boolean, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/**
 * One person's saved view of one table (Sprint 7, VIEWS-01): the view type, the visible fields and
 * their order, the frozen columns, the sort and the search, stored per Clerk user id + table key
 * and NEVER shared between users. `brand_id` stays null: a view is a lens on whichever brand the
 * viewer is standing in, not a per-brand row, so the shared column helper's nullable `brand_id` is
 * exactly right here. The data underneath is the same for everyone; only the lens is personal, which
 * is why every read and write in `user-table-views.ts` is keyed on `user_id` the way a branded read
 * is keyed on `brand_id`. The config columns are jsonb so a new view option is a code change, not a
 * migration; `@tas/domain`'s `parseUserViewConfig` narrows them on the way out.
 */
export const userTableViews = pgTable(
  'user_table_views',
  {
    ...baseColumns(),
    userId: text('user_id').notNull(),
    tableKey: text('table_key').notNull(),
    name: text('name').notNull(),
    viewType: text('view_type').notNull().default('grid'),
    visibleFields: jsonb('visible_fields').$type<string[] | null>(),
    fieldOrder: jsonb('field_order').$type<string[]>().notNull().default([]),
    frozenFields: jsonb('frozen_fields').$type<string[]>().notNull().default([]),
    sort: jsonb('sort').$type<{ key: string; direction: 'asc' | 'desc' } | null>(),
    filter: text('filter').notNull().default(''),
    // Which media column covers a gallery card, or NULL for the page's own default cover (action
    // item 16). Nullable rather than defaulted to '': "no choice recorded" and "this column" are
    // different states, and an empty string is not a column key.
    coverField: text('cover_field'),
    isActive: boolean('is_active').notNull().default(false),
  },
  (table) => [index('user_table_views_user_table_idx').on(table.userId, table.tableKey)],
);

export type UserTableView = typeof userTableViews.$inferSelect;
export type NewUserTableView = typeof userTableViews.$inferInsert;
