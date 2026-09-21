import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * Every notification the platform has sent or attempted (PRD §12, P5-005). One row per delivery:
 * a trigger that fires for two recipients on two channels produces four rows.
 *
 * `brand_id` IS NOT NULL: every notification is about a brand's data, and the brand's session
 * should be able to audit what was sent on its behalf. `withBrand` is NOT used for the admin
 * read (an agency admin wants the full log across brands), but IS used for the per-brand read.
 *
 * `status` tracks the delivery lifecycle: `queued` → `sent` or `failed`. Inngest jobs update
 * the row after the API call completes.
 */
export const notificationLog = pgTable(
  'notification_log',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    triggerKey: text('trigger_key').notNull(),
    channel: text('channel').$type<'slack' | 'email'>().notNull(),
    recipientUserId: text('recipient_user_id').notNull(),
    recipientName: text('recipient_name').notNull(),
    message: text('message').notNull(),
    deepLink: text('deep_link'),
    status: text('status').$type<NotificationLogStatus>().notNull().default('queued'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('notification_log_brand_id_idx').on(table.brandId),
    index('notification_log_status_idx').on(table.status),
    index('notification_log_trigger_key_idx').on(table.triggerKey),
  ],
);

export type NotificationLogStatus = 'queued' | 'sent' | 'failed';
export type NotificationLogEntry = typeof notificationLog.$inferSelect;
export type NewNotificationLogEntry = typeof notificationLog.$inferInsert;
