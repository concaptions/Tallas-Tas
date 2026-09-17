'use client';

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { Button, Input } from '@tas/ui';
import {
  NOTIFICATION_ROUTING_LINK_LABEL,
  routingNote,
  type NotificationChannel,
} from '@tas/domain';

import { teamPath } from '@/lib/routes';

import { setNotificationChannelAction, type NotificationActionResult } from './actions';
import {
  NO_NOTIFICATIONS_BODY,
  NO_NOTIFICATIONS_TITLE,
  SLACK_DM_NOTE,
  applyChannelSave,
  notificationCountLabel,
  type NotificationItem,
} from './fields';
import { NotificationTable } from './notification-row';

/**
 * The Notifications settings screen (PRD §12): one row per trigger, a Slack DM switch and an email
 * switch, and a note saying that the Recipient column is not something you edit here.
 *
 * THE ONLY WRITE IS ONE SWITCH. There is no draft and no Save button — unlike Interface Config,
 * where the whole page is one draft because the preview is the point, a settings switch that needed
 * a second click to mean anything would be a worse control than the one it replaces. A toggle
 * applies to the table immediately, dispatches `setNotificationChannelAction` with the value the row
 * should BECOME, and is put back if the server refuses; the error then says why in words.
 *
 * ONE `useActionState` FOR SIXTEEN SWITCHES, not one per switch. The result carries `triggerKey`,
 * `channel` and `enabled`, so a success reconciles exactly one cell through the pure
 * `applyChannelSave`, and `savedAt` changes on every save so two identical saves still re-render.
 *
 * IN DEMO MODE EVERY SWITCH IS DISABLED (ticket criterion 10), through `DisabledWrite` +
 * `disabledWriteClassName` with the tooltip "Sign in required to save changes" — the same sentence
 * the action returns. The action refuses again on the server, before any validation, actor lookup or
 * connection, so the disabled switch is the courtesy and the action is the guarantee.
 *
 * The filter is URL-backed in `?q=` exactly as the Team and Products tables are: "here is what the
 * media buyer gets" is then a link you can paste into Slack, a refresh keeps it, and it is also the
 * only way to reach the empty state, which says so in words and offers the way out.
 */
export interface NotificationsWorkspaceProps {
  readonly items: readonly NotificationItem[];
  readonly demo: boolean;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/** What the save in flight is addressed to, so only that one switch goes inert while it runs. */
interface PendingSave {
  readonly triggerKey: string;
  readonly channel: NotificationChannel;
  /** The value to put back if the server refuses. */
  readonly previous: boolean;
}

/**
 * Writes the filter to the URL without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(value: string): void {
  const url = new URL(window.location.href);
  if (value.trim() === '') {
    url.searchParams.delete('q');
  } else {
    url.searchParams.set('q', value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function NotificationsWorkspace({
  items,
  demo,
  initialSearch,
}: NotificationsWorkspaceProps) {
  const [rows, setRows] = useState<readonly NotificationItem[]>(items);
  const [search, setSearch] = useState(initialSearch);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<PendingSave | null>(null);
  const [state, formAction, pending] = useActionState<NotificationActionResult | null, FormData>(
    setNotificationChannelAction,
    null,
  );

  useEffect(() => {
    if (state === null) {
      return;
    }
    const attempt = inFlight.current;
    inFlight.current = null;

    if (state.ok) {
      setError(null);
      setRows((current) =>
        applyChannelSave(current, state.triggerKey, state.channel, state.enabled),
      );
      return;
    }

    setError(state.error);
    if (attempt !== null) {
      setRows((current) =>
        applyChannelSave(current, attempt.triggerKey, attempt.channel, attempt.previous),
      );
    }
  }, [state]);

  const onToggle = useCallback(
    (triggerKey: string, channel: NotificationChannel, enabled: boolean) => {
      inFlight.current = { triggerKey, channel, previous: !enabled };
      setRows((current) => applyChannelSave(current, triggerKey, channel, enabled));

      const formData = new FormData();
      formData.set('trigger', triggerKey);
      formData.set('channel', channel);
      formData.set('enabled', String(enabled));
      startTransition(() => {
        formAction(formData);
      });
    },
    [formAction],
  );

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(next);
  }, []);

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? rows : rows.filter((row) => row.search.includes(query))),
    [rows, query],
  );

  const attempt = inFlight.current;
  const savingKey = pending && attempt !== null ? `${attempt.triggerKey}:${attempt.channel}` : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Notifications</h1>
        <p className="text-sm text-text2">
          <span data-slot="notification-count">
            {notificationCountLabel(visible.length, rows.length)}
          </span>{' '}
          — every moment PRD §12 says somebody should hear about, and the two channels it can go out
          on.
        </p>
        <p data-slot="slack-dm-note" className="max-w-prose text-sm text-text3">
          {SLACK_DM_NOTE}
        </p>
        <p
          data-slot="routing-note"
          className="max-w-prose rounded-card border border-line bg-surface2 p-3 text-sm text-text3"
        >
          {routingNote()}{' '}
          <Link
            href={teamPath}
            data-slot="routing-note-link"
            className="text-accent underline-offset-2 hover:underline"
          >
            {NOTIFICATION_ROUTING_LINK_LABEL}
          </Link>
        </p>
        {error === null ? null : (
          <p data-slot="save-error" className="text-sm text-bad">
            {error}
          </p>
        )}
      </header>

      <section aria-labelledby="notifications-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="notifications-heading" className="text-sm font-medium text-text2">
            Triggers
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search triggers"
            aria-label="Search the notification triggers by wording or recipient"
            data-slot="notification-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <NotificationTable
          items={visible}
          demo={demo}
          savingKey={savingKey}
          onToggle={onToggle}
          emptyState={
            <div
              data-slot="notifications-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              {rows.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-text2">{NO_NOTIFICATIONS_TITLE}</p>
                  <p className="max-w-prose text-[13px] leading-relaxed text-text3">
                    {NO_NOTIFICATIONS_BODY}
                  </p>
                  <Button asChild variant="outline" size="sm" data-slot="empty-manage-team">
                    <Link href={teamPath}>{NOTIFICATION_ROUTING_LINK_LABEL}</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-text2">
                    No trigger matches “{term}”. Try a word from the trigger, or a role such as
                    media buyer.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      filter('');
                    }}
                    data-slot="clear-search"
                  >
                    Clear search
                  </Button>
                </>
              )}
            </div>
          }
        />
      </section>
    </div>
  );
}
