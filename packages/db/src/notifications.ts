import { asc, eq } from 'drizzle-orm';

import type { Db } from './db';
import {
  notificationSettings,
  notificationTriggers,
  type BrandRole,
  type NotificationChannel,
  type NotificationSetting,
  type NotificationTriggerKey,
} from './schema';
import { withBrand } from './tenancy';

/**
 * The Notifications page's data access (PRD §12: one row per trigger, a Slack DM switch and an email
 * switch). Every function takes the database as its first argument (no module-level singleton) and
 * reads and writes through `withBrand(db, brandId)`, so
 * `brand_id = $brandId AND deleted_at IS NULL` is on every statement and one brand's routing can
 * neither be read nor switched off from another brand's session. Nothing here contains business
 * logic: WHAT the eight triggers are is `notificationTriggers` in `schema/enums.ts`, and who
 * actually receives a DM is the brand's team assignment, not a value on these rows.
 */

/** Which of §12's two channels a write switches. Re-exported so a caller needs one import. */
export type { NotificationChannel };

/**
 * A notification setting as the table renders it: the stored row plus the §12 vocabulary its
 * `triggerKey` names — the trigger's label, the §11 roles the DM goes to, and the short reading of
 * those roles the Recipient column shows.
 *
 * The vocabulary is JOINED IN here rather than stored on the row for the reason the table
 * documents: the label and the recipient roles are the same for every brand, so duplicating them
 * into eight rows per brand would make a PRD wording change a data migration. `demoNotifications`
 * satisfies `NotificationSettingRow[]`, so the page reads demo fixtures and database rows through
 * one type and without a branch.
 *
 * `label` and `recipientLabel` are NULLABLE, and `recipients` is empty rather than null, for a row
 * whose `triggerKey` is not in the tuple — a trigger retired or renamed in a later PRD revision,
 * which `trigger_key` being plain `text` deliberately allows. The page falls back to the raw key
 * instead of the read throwing, exactly as `listPersonas` returns a null `productName` rather than
 * dropping a persona whose product has gone.
 */
export type NotificationSettingRow = NotificationSetting & {
  label: string | null;
  recipients: readonly BrandRole[];
  recipientLabel: string | null;
};

/** The §12 vocabulary by key, built once: eight entries, looked up per row. */
const triggersByKey = new Map<string, (typeof notificationTriggers)[number]>(
  notificationTriggers.map((trigger) => [trigger.key, trigger]),
);

/** Decorates one stored row with the vocabulary its key names, or with nulls when it names none. */
function withTrigger(row: NotificationSetting): NotificationSettingRow {
  const trigger = triggersByKey.get(row.triggerKey);
  return {
    ...row,
    label: trigger?.label ?? null,
    recipients: trigger?.recipients ?? [],
    recipientLabel: trigger?.recipientLabel ?? null,
  };
}

/**
 * The brand's live notification settings in PRD §12's order, each with its label and recipient.
 *
 * One scoped read and a lookup in TypeScript, not a SQL join: the §12 vocabulary is a tuple in the
 * schema, not a table, so there is nothing to join to. Ordered by `position`, never by insertion
 * order or by the clock, so a row updated today stays where §12 lists it.
 *
 * Rows with both switches off are RETURNED, not filtered: this is the settings screen's read and it
 * must show a muted trigger in order to switch it back on.
 */
export async function listNotificationSettings(
  db: Db,
  brandId: string,
): Promise<NotificationSettingRow[]> {
  const rows = await withBrand(db, brandId)
    .select(notificationSettings)
    .orderBy(asc(notificationSettings.position));
  return rows.map(withTrigger);
}

/**
 * Switches one channel of one trigger on or off for the brand and returns the row, or null when the
 * brand has no live row for that key — another brand's settings and a soft-deleted row are the same
 * outcome here: zero rows changed.
 *
 * Addressed by TRIGGER KEY rather than by row id, because that is what the caller has: the page
 * renders §12's eight triggers and a switch reports "email, on, for `ad_submitted`". The scope
 * turns that into one row, and the other channel is untouched — §12's two channels are independent,
 * so turning email on for a trigger must not restate whether Slack is on.
 */
export async function setChannel(
  db: Db,
  brandId: string,
  triggerKey: NotificationTriggerKey,
  channel: NotificationChannel,
  enabled: boolean,
  actorId: string,
): Promise<NotificationSettingRow | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      notificationSettings,
      {
        ...(channel === 'slack' ? { slackEnabled: enabled } : { emailEnabled: enabled }),
        updatedBy: actorId,
        updatedAt: new Date(),
      },
      eq(notificationSettings.triggerKey, triggerKey),
    )
    .returning();
  return row === undefined ? null : withTrigger(row);
}

/**
 * `listNotificationSettings` and `setChannel` under the names the Notifications ticket's app layer
 * calls them: the page asks for NOTIFICATIONS, the table stores notification SETTINGS. Aliases
 * rather than second queries, so there is only ever one statement to audit — the arrangement
 * `listTeamMembers` already uses.
 */
export const listNotifications = listNotificationSettings;
export const setNotificationChannel = setChannel;

/** `NotificationSettingRow` under the row-shaped name the page uses; see `listNotifications`. */
export type NotificationRow = NotificationSettingRow;
