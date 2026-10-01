import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import type { SmPlatformsKey, SmTaskStatusesKey } from './enums';

/**
 * SM Campaign Management Feed (Airtable `tblLRajTW55XEhVhk`): the social-media task feed — one row
 * per scheduled post or campaign chore, with the platform it targets, a due moment, a three-step
 * status and free notes. Five stored fields, mapped one to one: Task Name → `task_name` (the primary
 * field, always present), Platform → `platform` (`smPlatforms`), Due Date → `due_date` (an Airtable
 * dateTime, so `timestamptz`, never `date`), Status → `status` (`smTaskStatuses`), Notes → `notes`.
 *
 * Deliberately NOT stored — "Reminder Trigger", the formula
 * `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")`: it is a clock-dependent
 * value (true from twelve hours before the due moment), so it is computed in the query layer
 * (`due_date - interval '12 hours' <= now()`) and by the reminder job, never persisted, or a stored
 * copy would be stale the moment it was written.
 *
 * Branded and propagation-enabled like every other per-brand content table: `withBrand` scopes every
 * read and write. The live table is Gratsi-only (the template base has no social-media feed), so
 * template rows stay empty until the team adds some; the columns are here so a child never diverges
 * structurally from the parent.
 */
export const smCampaignFeedTasks = pgTable(
  'sm_campaign_feed_tasks',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    taskName: text('task_name').notNull(),
    platform: text('platform').$type<SmPlatformsKey>(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    status: text('status').$type<SmTaskStatusesKey>(),
    notes: text('notes'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('sm_campaign_feed_tasks_brand_id_idx').on(table.brandId),
    index('sm_campaign_feed_tasks_template_row_id_idx').on(table.templateRowId),
  ],
);

export type SmCampaignFeedTask = typeof smCampaignFeedTasks.$inferSelect;
export type NewSmCampaignFeedTask = typeof smCampaignFeedTasks.$inferInsert;
