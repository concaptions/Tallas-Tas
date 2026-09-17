'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@tas/ui';
import {
  NOTIFICATION_ROUTING_LINK_LABEL,
  NOTIFICATION_TRIGGER_KEYS,
  notificationTriggerLabel,
  routingNote,
  type NotificationChannel,
} from '@tas/domain';

import {
  NO_NOTIFICATIONS_BODY,
  NO_NOTIFICATIONS_TITLE,
  SLACK_DM_NOTE,
  UNROUTED_RECIPIENT,
  applyChannelSave,
  searchText,
  type NotificationItem,
} from '@/app/app/notifications/fields';
import { NotificationTable } from '@/app/app/notifications/notification-row';
import { teamPath } from '@/lib/routes';

/**
 * The block that sits above the table: one short paragraph in `text-text3` inside a `rounded-card`
 * `border-line` `bg-surface2` block, with the link to the Team page rendered AFTER the sentence.
 * The sentence itself is `routingNote()` from `@tas/domain` and the anchor text is
 * `NOTIFICATION_ROUTING_LINK_LABEL`, so the component writes no copy at all — the day §12's DMs
 * actually send, the email footer says the same thing rather than a second, slightly different one.
 */
export function NotificationRoutingNoteStory() {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-prose text-sm text-text3">{SLACK_DM_NOTE}</p>
      <p className="max-w-prose rounded-card border border-line bg-surface2 p-3 text-sm text-text3">
        {routingNote()}{' '}
        <Link href={teamPath} className="text-accent underline-offset-2 hover:underline">
          {NOTIFICATION_ROUTING_LINK_LABEL}
        </Link>
      </p>
    </div>
  );
}

/**
 * The shapes `/app/notifications` introduces (CLAUDE.md UI governance rule 4): a four-column
 * settings table whose last two columns are switches, a read-only Recipient column, and the two
 * states that table can be in — live, and disabled by demo mode.
 *
 * Nothing is re-drawn here. This is the route's own `NotificationTable`, mounted with sample rows.
 * Every trigger label comes from `notificationTriggerLabel` and every column header from
 * `NOTIFICATION_COLUMNS`, so no §12 string is written in this file and a story cannot show a
 * trigger the product does not have (ticket criterion 7).
 *
 * The recipient strings below are the only §12 wording restated anywhere outside the tuple, and
 * they are restated because these rows are NOT database rows: `recipientLabel` is joined in by
 * `@tas/db` from the table's own vocabulary, and importing that into a story would pull the driver
 * towards the browser. Three rows, three shapes of recipient — a pair of production roles, two
 * client-facing roles, and a single role.
 *
 * KEYED BY TRIGGER, never by the sample's position: a story that showed `ad_submitted` going to the
 * media buyer would be worse than no story at all, because the design-system page is what the rest
 * of the team reads the page's behaviour off. The keys are the tuple's, so a renamed trigger shows
 * the fallback here instead of a quietly wrong recipient.
 */
const SAMPLE_RECIPIENTS: Readonly<Record<string, string>> = {
  brief_assigned: 'Video Editor / Designer',
  ad_submitted: 'Strategist + CSM',
  creative_ready_to_launch: 'Media Buyer',
};

function sampleRow(index: number, slack: boolean, email: boolean): NotificationItem {
  const triggerKey = NOTIFICATION_TRIGGER_KEYS[index] ?? `ds-trigger-${String(index)}`;
  const recipient = SAMPLE_RECIPIENTS[triggerKey];
  const partial = {
    id: `ds-notification-${String(index)}`,
    triggerKey,
    label: notificationTriggerLabel(triggerKey),
    recipient: recipient ?? UNROUTED_RECIPIENT,
    unrouted: recipient === undefined,
    slackEnabled: slack,
    emailEnabled: email,
  };
  return { ...partial, search: searchText(partial) };
}

/** Three rows: the seeded default, both channels on, and Slack switched off. */
function sampleRows(): readonly NotificationItem[] {
  return [sampleRow(0, true, false), sampleRow(2, true, true), sampleRow(5, false, false)];
}

/**
 * The table as a signed-in workspace sees it: both switches live, a toggle applying to the row
 * immediately. The Recipient cell is text in the mute tone and never a control, which is the whole
 * reason the route carries a routing note above it.
 */
export function NotificationTableStory() {
  const [rows, setRows] = useState<readonly NotificationItem[]>(sampleRows);

  return (
    <NotificationTable
      items={rows}
      demo={false}
      onToggle={(triggerKey, channel: NotificationChannel, enabled) => {
        setRows((current) => applyChannelSave(current, triggerKey, channel, enabled));
      }}
    />
  );
}

/**
 * The same table in demo mode. Every switch is wrapped in `DisabledWrite` and carries the tooltip
 * "Sign in required to save changes"; a switch that is ON stays visibly on while disabled, because
 * the row's job is to state the setting even when it is not yours to change.
 */
export function NotificationTableDemoStory() {
  return <NotificationTable items={sampleRows()} demo onToggle={() => undefined} />;
}

/**
 * The empty state, which on this page is a brand whose settings have not been seeded yet. It says so
 * in words and offers the one action that leads anywhere — never a blank panel, never raw JSON. The
 * `?q=` filter reaches a second, narrower version of it with a Clear search button.
 */
export function NotificationsEmptyStory() {
  return (
    <NotificationTable
      items={[]}
      demo={false}
      onToggle={() => undefined}
      emptyState={
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-text2">{NO_NOTIFICATIONS_TITLE}</p>
          <p className="max-w-prose text-[13px] leading-relaxed text-text3">
            {NO_NOTIFICATIONS_BODY}
          </p>
          <Button type="button" variant="outline" size="sm">
            {NOTIFICATION_ROUTING_LINK_LABEL}
          </Button>
        </div>
      }
    />
  );
}
