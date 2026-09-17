'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import {
  BRIEF_COLUMNS,
  EM_DASH,
  NEW_BRIEF_SOON_HINT,
  NO_BRIEFS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  STANDALONE_CONCEPT_SLUG,
  briefCountLabel,
  filteredBriefCountLabel,
  matchesQuery,
  type BriefItem,
} from './fields';

/**
 * The Creative Briefs list (PRD §5.10, ticket criteria 1–3).
 *
 * Six columns, one row per creative asset, and the row IS the link: a click or Enter navigates to
 * `/app/briefs/<id>`, a real route segment, so the list is gone and Back restores it with the `?q=`
 * it had. Deliberately not a side panel — a brief carries a generated name, three prose sections,
 * an inspiration board and an approval rail, which is a page's worth of material.
 *
 * NOTHING IS RE-LABELLED HERE. The page resolved every status label, chip tone and type label
 * through the domain before this component saw a row; this file renders what it is handed. The
 * Concept cell is the one cell with a decision in it, and it is not a colour decision: a brief with
 * no parent concept is the ordinary PRD §8 case, so it shows the standalone slug as a muted
 * `StatusChip` rather than a blank or a bare em dash.
 *
 * The search is written into `?q=` with the History API exactly as the Concepts table writes it:
 * typing is instant, a refresh restores it, and an empty search leaves a clean address. Filtering
 * to nothing says so in its own words and offers to clear the search — a different sentence from
 * the brand with no briefs at all, because those are different problems with different ways out.
 */
interface BriefsWorkspaceProps {
  readonly items: readonly BriefItem[];
  readonly demo: boolean;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/** Writes the search without a server round trip; Next.js reads the History API back. */
function syncUrl(search: string): void {
  const url = new URL(window.location.href);
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function BriefsWorkspace({ items, demo, initialSearch }: BriefsWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(next);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    syncUrl('');
  }, []);

  const open = useCallback(
    (item: BriefItem) => {
      router.push(item.href);
    },
    [router],
  );

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, item: BriefItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(item);
    }
  };

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;

  /**
   * "New brief" is a write, so demo mode disables it with the standard reason. It is disabled in
   * live mode too, with its own reason: `createBriefAction` is written and tested, but the create
   * FORM is a later ticket, so the button has nothing to submit and says so rather than opening a
   * page that cannot save.
   */
  const newBrief = (slot: string) => (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_BRIEF_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot={slot}>
        New brief
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Briefs</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Briefs</h1>
          {newBrief('new-brief')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="brief-count">
            {narrowed
              ? filteredBriefCountLabel(visible.length, items.length)
              : briefCountLabel(items.length)}
          </span>{' '}
          — one record per creative asset, named for you.
        </p>
      </header>

      <section aria-labelledby="briefs-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="briefs-heading" className="text-sm font-medium text-text2">
            Pipeline
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search briefs"
            aria-label="Search briefs by name, concept, type, priority, assignee or status"
            data-slot="brief-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="briefs-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_BRIEFS_NOTE}</p>
            {narrowed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSearch}
                data-slot="clear-search"
              >
                Clear search
              </Button>
            ) : (
              newBrief('empty-new-brief')
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <Table data-slot="briefs-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {BRIEF_COLUMNS.map((column) => (
                    <TableHead key={column} className="px-3">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow
                    key={item.id}
                    data-slot="brief-row"
                    data-brief-id={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={item.name}
                    onClick={() => {
                      open(item);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, item);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell
                      data-slot="brief-row-name"
                      className="px-3 py-1.5 font-mono text-xs whitespace-normal text-text"
                    >
                      {item.name}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.conceptName ?? (
                        <span data-slot="brief-standalone">
                          <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">{item.typeLabel}</TableCell>
                    <TableCell className="px-3 py-1.5">
                      {item.priority === null ? (
                        <span className="text-text4">{EM_DASH}</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <StatusChip tone={item.priority.tone} label={item.priority.label} />
                          {item.priority.sla === null ? null : (
                            <span className="font-mono text-[11px] text-text3">
                              {item.priority.sla}
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.assignee ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <StatusChip tone={item.status.tone} label={item.status.label} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
