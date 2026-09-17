'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { groupByClientStatus } from '@tas/domain/state';
import { Button } from '@tas/ui';

import { QueueColumnPanel, QueueStrip } from '@/components/queue/queue-strip';
import { internalQueuePath } from '@/lib/routes';

import { ClientQueueCard } from './client-queue-card';
import {
  ALL_FILTER,
  ALL_FILTER_LABEL,
  CLIENT_QUEUE_FILTER_PARAM,
  CLIENT_QUEUE_INTRO_NOTE,
  CLIENT_QUEUE_RULE_NOTE,
  clientQueueColumnView,
  clientQueueCountLabel,
  clientQueueFilterParam,
  EMPTY_COLUMN_NOTE,
  filteredClientQueueCountLabel,
  matchesClientQueueFilter,
  mineFilterLabel,
  noMineNote,
  NO_CLIENT_WORK_NOTE,
  OPEN_INTERNAL_QUEUE_LABEL,
  sameClientQueueFilter,
  SHOW_ALL_LABEL,
  withheldNote,
  type ClientQueueFilter,
  type ClientQueueItem,
} from './fields';

/**
 * The Client Queue board (PRD §9, §10; ticket `client-queue` criteria 2, 3, 5, 8 and 10).
 *
 * The Internal Queue's board over a different vocabulary: a horizontal strip of columns, one per
 * CLIENT status, in PRD §9 order — and that order, those labels and the grouping are entirely
 * `clientQueueColumns()` and `groupByClientStatus()` in `@tas/domain/state`. This file never lists a
 * status, compares one to a literal or sorts anything: a status added to `CLIENT_STATUS` appears
 * here with no edit. The strip and the column are `QueueStrip` and `QueueColumnPanel` in
 * `@/components/queue`, the identical components the Internal Queue renders, so the two boards
 * cannot drift apart.
 *
 * IT IS A SMALLER BOARD THAN THE BRIEFS LIST, ON PURPOSE, AND IT SAYS SO. PRD §9 gates the client
 * track behind internal sign-off, so most briefs are simply not here. `withheldNote` turns the
 * loader's own count into one muted line (criterion 5), because a page that is quietly shorter than
 * the data reads as broken rather than as gated.
 *
 * EMPTY COLUMNS KEEP THEIR PLACE, and an empty BOARD says which kind of empty it is: nothing waiting
 * on the client at all is a different situation from a filter that matched nothing, and they have
 * different ways out. Neither is ever a blank panel.
 *
 * THE FILTER IS THE ADDRESS. Selecting one rewrites `?filter=` with the History API exactly as the
 * Internal Queue writes `?view=` — instant, no server round trip, and a reload restores the same
 * board because `page.tsx` parses the same parameter on the way in. `all` deletes the parameter
 * instead of writing `?filter=all`, so the plain board has a clean, shareable URL.
 */
interface ClientQueueBoardProps {
  readonly items: readonly ClientQueueItem[];
  /** The name "Mine" compares against: the demo assignee, or the signed-in actor's full name. */
  readonly viewer: string;
  /** True when no identity provider is configured: every write is refused and shown as refused. */
  readonly demo: boolean;
  /** Every brief the loader read, before PRD §9's gate. The board is a subset of this. */
  readonly total: number;
  /** How many the gate held back. Counted by the loader; this page never receives those rows. */
  readonly withheld: number;
  /** The filter the page was opened with, already parsed by `parseClientQueueFilter`. */
  readonly initialFilter: ClientQueueFilter;
}

/** Writes the filter into the address without a server round trip; Next.js reads History back. */
function syncUrl(filter: ClientQueueFilter): void {
  const url = new URL(window.location.href);
  const param = clientQueueFilterParam(filter);
  if (param === null) {
    url.searchParams.delete(CLIENT_QUEUE_FILTER_PARAM);
  } else {
    url.searchParams.set(CLIENT_QUEUE_FILTER_PARAM, param);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function ClientQueueBoard({
  items,
  viewer,
  demo,
  total,
  withheld,
  initialFilter,
}: ClientQueueBoardProps) {
  const [filter, setFilter] = useState<ClientQueueFilter>(initialFilter);

  const select = useCallback((next: ClientQueueFilter) => {
    setFilter(next);
    syncUrl(next);
  }, []);

  const visible = useMemo(
    () => items.filter((item) => matchesClientQueueFilter(item, filter, viewer)),
    [items, filter, viewer],
  );

  const columns = useMemo(() => groupByClientStatus(visible), [visible]);
  const narrowed = visible.length !== items.length;
  const gateNote = withheldNote(withheld, total);

  const options: readonly { key: string; label: string; filter: ClientQueueFilter }[] = [
    { key: 'mine', label: mineFilterLabel(viewer), filter: { kind: 'mine' } },
    { key: 'all', label: ALL_FILTER_LABEL, filter: ALL_FILTER },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Approvals</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Client Queue</h1>
        <p data-slot="client-queue-rule" className="text-sm text-text2">
          {CLIENT_QUEUE_RULE_NOTE}
        </p>
        <p className="text-sm text-text2">
          <span data-slot="client-queue-count">
            {narrowed
              ? filteredClientQueueCountLabel(visible.length, items.length)
              : clientQueueCountLabel(items.length)}
          </span>{' '}
          — {CLIENT_QUEUE_INTRO_NOTE}
        </p>
        {gateNote === null ? null : (
          <p data-slot="client-queue-withheld" className="text-xs text-text4">
            {gateNote}
          </p>
        )}
      </header>

      <section aria-labelledby="client-queue-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 id="client-queue-heading" className="text-sm font-medium text-text2">
            Board
          </h2>
          <div
            data-slot="client-queue-filter"
            role="group"
            aria-label="Filter the client queue"
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            {options.map((option) => {
              const active = sameClientQueueFilter(option.filter, filter);
              return (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={active ? 'secondary' : 'outline'}
                  aria-pressed={active}
                  data-slot="client-queue-filter-option"
                  data-filter={option.key}
                  data-active={active}
                  onClick={() => {
                    select(option.filter);
                  }}
                  className="h-8 max-w-full truncate"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="client-queue-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="max-w-md text-sm text-text2">
              {narrowed && filter.kind === 'mine' ? noMineNote(viewer) : NO_CLIENT_WORK_NOTE}
            </p>
            {narrowed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-slot="client-queue-show-all"
                onClick={() => {
                  select(ALL_FILTER);
                }}
              >
                {SHOW_ALL_LABEL}
              </Button>
            ) : (
              <Button asChild size="sm" data-slot="client-queue-open-internal">
                <Link href={internalQueuePath}>{OPEN_INTERNAL_QUEUE_LABEL}</Link>
              </Button>
            )}
          </div>
        ) : (
          <QueueStrip slot="client-queue-board" label="Client status board">
            {columns.map((column) => {
              const head = clientQueueColumnView(column);
              return (
                <QueueColumnPanel
                  key={column.key}
                  slot="client-queue-column"
                  statusKey={column.key}
                  label={column.label}
                  description={column.description}
                  tone={head.tone}
                  count={column.count}
                  countLabel={clientQueueCountLabel(column.count)}
                  emptyNote={EMPTY_COLUMN_NOTE}
                >
                  {column.rows.map((item) => (
                    <ClientQueueCard key={item.id} item={item} demo={demo} />
                  ))}
                </QueueColumnPanel>
              );
            })}
          </QueueStrip>
        )}
      </section>
    </div>
  );
}
