'use client';

import type { ReactNode } from 'react';
import {
  DisabledWrite,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  disabledWriteClassName,
} from '@tas/ui';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from '@tas/domain';

import { NOTIFICATION_COLUMNS, channelValue, switchLabel, type NotificationItem } from './fields';

/**
 * The Notifications table (PRD §12): one `<table>`, four columns, one row per trigger. No detail
 * panel, no row click, no add, no delete, no reorder — the only interactive things on the page are
 * the two switches per row and the filter above it (ticket criterion 5).
 *
 * Presentational and stateless: every value arrives resolved from `fields.ts`, and toggling is
 * handed up through `onToggle`. That is what lets the design-system page mount this table with
 * plain objects and see exactly what the route renders, and it is what keeps the Server Action
 * dispatch in one place (`notifications-workspace.tsx`) instead of in sixteen switches.
 *
 * THE RECIPIENT CELL IS TEXT, never a control (criterion 4). There is no picker, no menu and no
 * link inside the cell, because routing is the brand's team assignment made at onboarding; the note
 * above the table is what makes that legible rather than looking like a missing feature.
 *
 * `emptyState` is rendered inside the table body rather than in place of the table, so the headings
 * stay put and the empty case is never a blank rectangle.
 */

/**
 * The checked look survives `disabledWriteClassName`. That class mutes a disabled control onto
 * `bg-surface3`, which on a switch would erase the one thing the row is stating — whether the
 * channel is on. Two stacked variants beat the single `disabled:` one on specificity regardless of
 * stylesheet order, so a demo-mode switch reads as "on, and not yours to change" rather than "off".
 */
const CHECKED_WHILE_DISABLED =
  'data-[state=checked]:disabled:border-accent-line data-[state=checked]:disabled:bg-accent-soft';

export interface NotificationSwitchProps {
  readonly item: NotificationItem;
  readonly channel: NotificationChannel;
  /** Demo mode: the switch is disabled through `DisabledWrite` and explains why on hover. */
  readonly demo: boolean;
  /** True while this exact switch's save is in flight. */
  readonly busy: boolean;
  readonly onToggle: (triggerKey: string, channel: NotificationChannel, enabled: boolean) => void;
}

/**
 * One channel's switch for one trigger. It submits the value the row should BECOME, never a flip,
 * and it names its trigger and its channel — no row id travels, because the trigger key is the
 * row's identity on this page.
 */
export function NotificationSwitch({
  item,
  channel,
  demo,
  busy,
  onToggle,
}: NotificationSwitchProps) {
  const checked = channelValue(item, channel);

  return (
    <DisabledWrite active={demo}>
      <Switch
        data-slot="channel-switch"
        data-channel={channel}
        data-trigger={item.triggerKey}
        checked={checked}
        disabled={demo || busy}
        aria-label={switchLabel(item, channel)}
        className={demo ? cn(disabledWriteClassName, CHECKED_WHILE_DISABLED) : undefined}
        onCheckedChange={(next) => {
          onToggle(item.triggerKey, channel, next);
        }}
      />
    </DisabledWrite>
  );
}

export interface NotificationRowProps {
  readonly item: NotificationItem;
  readonly demo: boolean;
  /** `"<triggerKey>:<channel>"` of the save in flight, or null. */
  readonly savingKey: string | null;
  readonly onToggle: NotificationSwitchProps['onToggle'];
}

export function NotificationRow({ item, demo, savingKey, onToggle }: NotificationRowProps) {
  return (
    <TableRow data-slot="notification-row" data-trigger={item.triggerKey}>
      <TableCell className="px-2 py-2 align-top whitespace-normal sm:px-3">
        <span className="block font-medium text-text">{item.label}</span>
      </TableCell>
      <TableCell
        data-slot="notification-recipient"
        className={cn(
          'px-2 py-2 align-top whitespace-normal sm:px-3',
          item.unrouted ? 'text-text4' : 'text-text3',
        )}
      >
        {item.recipient}
      </TableCell>
      {NOTIFICATION_CHANNELS.map((channel) => (
        <TableCell key={channel} className="px-2 py-2 align-top sm:px-3">
          <NotificationSwitch
            item={item}
            channel={channel}
            demo={demo}
            busy={savingKey === `${item.triggerKey}:${channel}`}
            onToggle={onToggle}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

export interface NotificationTableProps {
  readonly items: readonly NotificationItem[];
  readonly demo: boolean;
  readonly savingKey?: string | null;
  readonly onToggle: NotificationSwitchProps['onToggle'];
  /** Shown across all four columns when `items` is empty. */
  readonly emptyState?: ReactNode;
}

export function NotificationTable({
  items,
  demo,
  savingKey = null,
  onToggle,
  emptyState,
}: NotificationTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <Table data-slot="notification-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {NOTIFICATION_COLUMNS.map((column) => (
              <TableHead key={column} className="px-2 whitespace-normal sm:px-3">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={NOTIFICATION_COLUMNS.length}
                className="px-2 py-10 whitespace-normal sm:px-3"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                demo={demo}
                savingKey={savingKey}
                onToggle={onToggle}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
