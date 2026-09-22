import { pgTable, text, unique } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

export const viewPreferences = pgTable(
  'user_view_preferences',
  {
    ...baseColumns(),
    userId: text('user_id').notNull(),
    tableKey: text('table_key').notNull(),
    viewType: text('view_type').notNull().default('grid'),
    kanbanGroupByField: text('kanban_group_by_field'),
  },
  (t) => [unique('uq_user_table_view').on(t.userId, t.brandId, t.tableKey)],
);

export type ViewPreference = typeof viewPreferences.$inferSelect;
export type NewViewPreference = typeof viewPreferences.$inferInsert;
