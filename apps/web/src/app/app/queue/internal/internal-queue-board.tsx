'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@tas/ui';
import { groupByInternalStatus } from '@tas/domain/state';

import { QueueColumnPanel, QueueStrip } from '@/components/queue/queue-strip';
import { briefsPath } from '@/lib/routes';

import { QueueCard } from './queue-card';
import {
  ALL_VIEW,
  ALL_VIEW_LABEL,
  brandViewLabel,
  EMPTY_COLUMN_NOTE,
  filteredQueueCountLabel,
  matchesQueueView,
  mineViewLabel,
  noBrandNote,
  noMineNote,
  NO_BRIEFS_NOTE,
  ONE_BRAND_NOTE,
  OPEN_BRIEFS_LABEL,
  QUEUE_INTRO_NOTE,
  QUEUE_VIEW_PARAM,
  queueColumnView,
  queueCountLabel,
  queueViewParam,
  READ_ONLY_NOTE,
  sameQueueView,
  SHOW_ALL_LABEL,
  type QueueBrandChoice,
  type QueueItem,
  type QueueView,
} from './fields';

/**
 * The Internal Queue board (PRD §9, §13; ticket criteria 2, 3, 7, 11 and 12).
 *
 * A horizontal strip of columns, one per internal status, in PRD §9 order — and that order, those
 * labels and the grouping are entirely `internalQueueColumns()` and `groupByInternalStatus()` in
 * `@tas/domain/state`. This file never lists a status, compares one to a literal or sorts anything:
 * a step added to a ladder appears here with no edit.
 *
 * EMPTY COLUMNS KEEP THEIR PLACE. A stage with nothing in it renders with a count of 0 and a quiet
 * line rather than collapsing, because a board that hides its empty stages hides exactly the work
 * that is not moving — which is the thing §13 says this page exists to show.
 *
 * THE STRIP SCROLLS, THE PAGE DOES NOT. `overflow-x-auto` lives on the strip's own container and
 * every ancestor carries `min-w-0`, so at 390px the columns slide inside the board while the shell's
 * `<main>` stays exactly as wide as the viewport. The shell's `overflow-x-hidden` is the backstop,
 * not the mechanism. The strip and the column themselves are `QueueStrip` and `QueueColumnPanel` in
 * `@/components/queue`, which the Client Queue board renders too: two boards, one shape, so neither
 * can quietly grow a different column.
 *
 * THE FILTER IS THE ADDRESS. Selecting a view rewrites `?view=` with the History API exactly as
 * `briefs-workspace.tsx` writes `?q=` — instant, no server round trip, and a reload restores the same
 * board because `page.tsx` parses the same parameter on the way in. `all` deletes the parameter
 * instead of writing `?view=all`, so the plain board has a clean, shareable URL.
 *
 * THERE ARE NO WRITES. Nothing on this board mutates a brief, so there is no `DisabledWrite` and no
 * dead button with a tooltip promising a save that was never built (criterion 11). The page says so
 * in one quiet line instead.
 */
interface InternalQueueBoardProps {
  readonly items: readonly QueueItem[];
  /** The name "Mine" compares against: the demo assignee, or the signed-in actor's full name. */
  readonly viewer: string;
  /** Derived from the loaded rows on the server, never a hardcoded list (criterion 8). */
  readonly brands: readonly QueueBrandChoice[];
  /** The view the page was opened with, already parsed by `parseQueueView`. */
  readonly initialView: QueueView;
}

/** Writes the view into the address without a server round trip; Next.js reads History back. */
function syncUrl(view: QueueView): void {
  const url = new URL(window.location.href);
  const param = queueViewParam(view);
  if (param === null) {
    url.searchParams.delete(QUEUE_VIEW_PARAM);
  } else {
    url.searchParams.set(QUEUE_VIEW_PARAM, param);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function InternalQueueBoard({
  items,
  viewer,
  brands,
  initialView,
}: InternalQueueBoardProps) {
  const [view, setView] = useState<QueueView>(initialView);

  const select = useCallback((next: QueueView) => {
    setView(next);
    syncUrl(next);
  }, []);

  const visible = useMemo(
    () => items.filter((item) => matchesQueueView(item, view, viewer)),
    [items, view, viewer],
  );

  const columns = useMemo(() => groupByInternalStatus(visible), [visible]);
  const narrowed = visible.length !== items.length;

  /** The three kinds of option, built from data so the row never hardcodes a brand. */
  const options: readonly { key: string; label: string; view: QueueView }[] = [
    { key: 'mine', label: mineViewLabel(viewer), view: { kind: 'mine' } },
    { key: 'all', label: ALL_VIEW_LABEL, view: ALL_VIEW },
    ...brands.map((brand) => ({
      key: `brand:${brand.id}`,
      label: brandViewLabel(brand),
      view: { kind: 'brand', brandId: brand.id } as const,
    })),
  ];

  /**
   * The empty state's sentence, which depends on WHY the board is empty. A workspace with no briefs
   * is a different problem from a filter that matched nothing, and they have different ways out.
   */
  const emptyNote = (): string => {
    if (!narrowed) {
      return NO_BRIEFS_NOTE;
    }
    if (view.kind === 'mine') {
      return noMineNote(viewer);
    }
    if (view.kind === 'brand') {
      return noBrandNote(brands.find((brand) => brand.id === view.brandId)?.name ?? view.brandId);
    }
    return NO_BRIEFS_NOTE;
  };

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Approvals</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Internal Queue</h1>
        <p className="text-sm text-text2">
          <span data-slot="queue-count">
            {narrowed
              ? filteredQueueCountLabel(visible.length, items.length)
              : queueCountLabel(items.length)}
          </span>{' '}
          — {QUEUE_INTRO_NOTE}
        </p>
        <p data-slot="queue-read-only" className="text-xs text-text4">
          {READ_ONLY_NOTE}
        </p>
      </header>

      <section aria-labelledby="internal-queue-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 id="internal-queue-heading" className="text-sm font-medium text-text2">
            Board
          </h2>
          <div
            data-slot="queue-filter"
            role="group"
            aria-label="Filter the internal queue"
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            {options.map((option) => {
              const active = sameQueueView(option.view, view);
              return (
                <Button
                  key={option.key}
                  type="button"
                  size="sm"
                  variant={active ? 'secondary' : 'outline'}
                  aria-pressed={active}
                  data-slot="queue-view-option"
                  data-view={option.key}
                  data-active={active}
                  onClick={() => {
                    select(option.view);
                  }}
                  className="h-8 max-w-full truncate"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        {brands.length === 1 ? (
          <p data-slot="queue-brand-note" className="text-xs text-text4">
            {ONE_BRAND_NOTE}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div
            data-slot="queue-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="max-w-md text-sm text-text2">{emptyNote()}</p>
            {narrowed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-slot="queue-show-all"
                onClick={() => {
                  select(ALL_VIEW);
                }}
              >
                {SHOW_ALL_LABEL}
              </Button>
            ) : (
              <Button asChild size="sm" data-slot="queue-open-briefs">
                <Link href={briefsPath}>{OPEN_BRIEFS_LABEL}</Link>
              </Button>
            )}
          </div>
        ) : (
          <QueueStrip slot="queue-board" label="Internal status board">
            {columns.map((column) => {
              const head = queueColumnView(column);
              return (
                <QueueColumnPanel
                  key={column.key}
                  slot="queue-column"
                  statusKey={column.key}
                  label={column.label}
                  description={column.description}
                  tone={head.tone}
                  count={column.count}
                  countLabel={queueCountLabel(column.count)}
                  emptyNote={EMPTY_COLUMN_NOTE}
                >
                  {column.rows.map((item) => (
                    <QueueCard key={item.id} item={item} />
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
