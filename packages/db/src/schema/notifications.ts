import { boolean, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import type { NotificationTriggerKey } from './enums';

/**
 * Which of PRD §12's eight triggers this brand wants to hear about, and on which channel (§12:
 * "notifications go as Slack direct messages to the assigned person, through our existing TAS Bot
 * app"; §2's onboarding list: "Slack, email notifications we can turn them ON or OFF").
 *
 * ONE ROW PER TRIGGER, PER BRAND. Branded (`brand_id` NOT NULL), so `withBrand` scopes every read
 * and write and one client's routing can never be read or switched off from another brand's
 * session. Eight rows per brand, written at onboarding from `notificationTriggers`.
 *
 * WHY A TABLE AND NOT COLUMNS ON `brands`. CLAUDE.md is explicit: never create per-brand Postgres
 * columns. Sixteen boolean columns on `brands` would make every new §12 trigger a migration and
 * every brand's preference a schema fact; a row per trigger makes "Niagara wants email for launch
 * readiness" ordinary data a CSM edits.
 *
 * WHAT IS DELIBERATELY ABSENT. No recipient column, no per-person override, no channel id, no
 * message template. §12 settles routing once: "routing comes from the team assignment made at
 * onboarding — filled once, never rebuilt by hand", so WHO gets the DM is derived from
 * `brand_assignments` through the trigger's `recipients` roles, and this table only says whether
 * that DM is sent at all. Two switches, nothing else.
 *
 * `trigger_key` is plain `text` `$type`d from `notificationTriggerKeys` rather than the
 * `notification_trigger` enum itself, the decision `copywriting.cta` documents: the vocabulary is
 * asserted in TypeScript, and a trigger renamed in a later PRD revision should not need a migration
 * to say something the database never enforces for the other single-selects either. A stored row
 * whose key no longer matches the tuple comes back from `listNotificationSettings` with a null
 * label rather than blowing up a read.
 *
 * `slack_enabled` defaults TRUE and `email_enabled` FALSE because §12 makes Slack the channel and
 * email the per-user extra: a brand onboarded today is already reachable on Slack for all eight
 * triggers, and nobody is emailed until someone asks to be.
 *
 * ORDER IS A COLUMN: `position` is what `listNotificationSettings` sorts by, so the table always
 * reads in PRD §12's order whatever order the rows were written in. 0-based and dense; nothing
 * reads it as an identifier.
 */
export const notificationSettings = pgTable(
  'notification_settings',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    /** Which §12 trigger this row switches; the storage vocabulary is `notificationTriggerKeys`. */
    triggerKey: text('trigger_key').$type<NotificationTriggerKey>().notNull(),
    slackEnabled: boolean('slack_enabled').notNull().default(true),
    emailEnabled: boolean('email_enabled').notNull().default(false),
    position: integer('position').notNull(),
  },
  (table) => [
    index('notification_settings_brand_id_idx').on(table.brandId),
    // The settings are always read as "this brand's triggers in §12 order", never as a global scan.
    index('notification_settings_brand_position_idx').on(table.brandId, table.position),
  ],
);

export type NotificationSetting = typeof notificationSettings.$inferSelect;
export type NewNotificationSetting = typeof notificationSettings.$inferInsert;
