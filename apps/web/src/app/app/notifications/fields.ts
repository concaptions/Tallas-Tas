import type { NotificationSettingRow } from '@tas/db';
import {
  NOTIFICATION_CHANNELS,
  channelLabel,
  notificationTriggerLabel,
  type NotificationChannel,
} from '@tas/domain';

/**
 * Everything the Notifications table shows about one trigger, resolved once on the server (PRD §12).
 *
 * One module, so the page, the table and the design-system story cannot drift: the column headings,
 * the four cells, the two paragraphs above the table and the empty state are stated here and
 * nowhere else. Every trigger label and every channel label comes from `@tas/domain` — no component
 * in this route writes a trigger string, a recipient string or a channel name (ticket criterion 7,
 * CLAUDE.md UI governance rules 1 and 2 applied to the §12 vocabulary).
 *
 * Only TYPES are imported from `@tas/db`, so the driver never reaches the browser bundle.
 *
 * THE RECIPIENT IS ROW DATA. `recipientLabel` arrives on the row, already joined in from the §12
 * tuple, and this module only decides what to print when a stored key names no trigger at all. Who
 * actually receives the DM is the brand's team assignment made at onboarding, which is not a value
 * on these rows and is not editable from this page — that is what `ROUTING_NOTE` says out loud.
 */

/** The four columns, in the ticket's order: the two fixed ones, then one per §12 channel. */
export const NOTIFICATION_COLUMNS: readonly string[] = [
  'Trigger',
  'Recipient',
  ...NOTIFICATION_CHANNELS.map(channelLabel),
];

/**
 * What §12 opens with, and therefore the first thing the page says: the DMs go to a person through
 * the bot that already exists, and nothing is posted into a channel. §12 exists because "today
 * automations post into Slack channels and it's noise nobody reads", so a page that showed eight
 * switches without saying that would be showing the solution with the problem left off.
 */
export const SLACK_DM_NOTE =
  'Every trigger below sends a Slack direct message through the existing TAS Bot app — to one ' +
  'person, never into a channel. Email is the optional second copy.';

/** The Recipient cell for a stored key that names no §12 trigger. Never blank, never a dash. */
export const UNROUTED_RECIPIENT = 'No recipient — this trigger is no longer in use.';

/** The empty table in live mode: a brand whose settings have not been seeded yet. */
export const NO_NOTIFICATIONS_TITLE = 'This brand has no notification triggers yet.';

export const NO_NOTIFICATIONS_BODY =
  'The eight PRD §12 triggers are seeded with the brand at onboarding, alongside its team ' +
  'assignment. Set the team up and they appear here, Slack on and email off.';

/** One trigger, fully resolved: four cells and the string the `?q=` filter matches. */
export interface NotificationItem {
  readonly id: string;
  /** The row's identity on this page: what `data-trigger` carries and what a save submits. */
  readonly triggerKey: string;
  readonly label: string;
  readonly recipient: string;
  /** True when the recipient cell is the fallback above rather than a §12 role reading. */
  readonly unrouted: boolean;
  readonly slackEnabled: boolean;
  readonly emailEnabled: boolean;
  /** Trigger wording, recipient and key, lower-cased once, for the `?q=` filter. */
  readonly search: string;
}

/** What `?q=` matches: the §12 wording first, plus the recipient and the stored key. */
export function searchText(item: Omit<NotificationItem, 'search'>): string {
  return [item.label, item.recipient, item.triggerKey].join(' ').toLowerCase();
}

/**
 * One row, fully resolved. The label falls back through the domain rather than through a `??` in a
 * cell, so a row written before a trigger was renamed still renders its key instead of an empty
 * cell.
 */
export function toNotificationItem(row: NotificationSettingRow): NotificationItem {
  const partial = {
    id: row.id,
    triggerKey: row.triggerKey,
    label: row.label ?? notificationTriggerLabel(row.triggerKey),
    recipient: row.recipientLabel ?? UNROUTED_RECIPIENT,
    unrouted: row.recipientLabel === null,
    slackEnabled: row.slackEnabled,
    emailEnabled: row.emailEnabled,
  };
  return { ...partial, search: searchText(partial) };
}

/** One row's stored value for one channel, so no cell writes `channel === 'slack' ? …` itself. */
export function channelValue(item: NotificationItem, channel: NotificationChannel): boolean {
  return channel === 'slack' ? item.slackEnabled : item.emailEnabled;
}

/**
 * The switch's accessible name: the channel, then the trigger it belongs to. Two switches per row
 * with the same visible label would otherwise be indistinguishable to a screen reader.
 */
export function switchLabel(item: NotificationItem, channel: NotificationChannel): string {
  return `${channelLabel(channel)} for ${item.label}`;
}

/**
 * The table after one successful save: the named channel of the named trigger takes its new value
 * and every other cell is left exactly as it was.
 *
 * Pure, and deliberately NOT a flip — `enabled` is what the row should BECOME, the same value the
 * Server Action wrote, so the optimistic state and the database can never disagree about which way
 * the switch went. The channel not named is untouched, because §12's two channels are independent.
 */
export function applyChannelSave(
  items: readonly NotificationItem[],
  triggerKey: string,
  channel: NotificationChannel,
  enabled: boolean,
): readonly NotificationItem[] {
  return items.map((item) =>
    item.triggerKey === triggerKey
      ? {
          ...item,
          slackEnabled: channel === 'slack' ? enabled : item.slackEnabled,
          emailEnabled: channel === 'email' ? enabled : item.emailEnabled,
        }
      : item,
  );
}

/** "8 triggers", or "2 of 8 triggers" while the filter is narrowing. */
export function notificationCountLabel(visible: number, total: number): string {
  const word = total === 1 ? 'trigger' : 'triggers';
  return visible === total
    ? `${String(total)} ${word}`
    : `${String(visible)} of ${String(total)} ${word}`;
}
