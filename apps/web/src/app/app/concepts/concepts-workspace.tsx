'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeTrack } from '@tas/domain/state';
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

import { conceptPath } from '@/lib/routes';

import { ConceptBoard } from './concept-board';
import {
  CONCEPT_COLUMNS,
  EM_DASH,
  NEW_CONCEPT,
  NO_CONCEPTS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  VIEW_PARAM,
  conceptColumns,
  conceptCountLabel,
  filteredConceptCountLabel,
  matchesQuery,
  type ConceptItem,
  type ConceptView,
} from './fields';
import { ViewToggle } from './view-toggle';

/**
 * The Concepts list: one set of rows, two ways of reading it (PRD §5.7, ticket criteria 2–5).
 *
 * TABLE is the default, because a concept list is a queue you work down and five columns read
 * faster than any card. BOARD is the same rows grouped by internal status, which is the question a
 * strategist actually asks on a Monday — what is stuck where. Neither view filters, sorts or
 * re-labels anything: `loadConcepts()` returns the rows newest edit first and the page already
 * resolved every status label and tone through `@tas/domain/state`.
 *
 * The chosen view lives in `?view=` and the search in `?q=`, both written with the History API
 * exactly as the Angles table writes `?angle=` and `?q=`: switching or typing is instant, a refresh
 * restores what you had, and the board — or the narrowed list — someone is looking at is a link
 * they can send. A value at its default is removed from the URL rather than written, so a clean
 * page has a clean address.
 *
 * ONE SEARCH, BOTH VIEWS. The filter runs on the rows before `conceptColumns` groups them, so the
 * board narrows with the table and a column's count is always the count of what is in it. Filtering
 * to nothing says so in its own words and offers to clear the search — a different sentence from
 * the brand that has no concepts at all, because those are different problems with different ways
 * out (`NO_MATCH_NOTE` and `NO_CONCEPTS_NOTE`).
 *
 * A row and a card are the same thing: a click on either navigates to `/app/concepts/<id>`, a real
 * route segment, so the list is gone and Back restores it with the `?view=` it had. This is
 * deliberately NOT a side panel — a concept carries a brief, an inherited block and an approval
 * rail, which is a page's worth of material.
 */
interface ConceptsWorkspaceProps {
  readonly items: readonly ConceptItem[];
  /** Which internal track a concept runs on, resolved on the server beside the data source. */
  readonly track: CreativeTrack;
  readonly demo: boolean;
  readonly initialView: ConceptView;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes both pieces of list state without a server round trip; Next.js reads the History API back.
 * A default is deleted rather than written as `?view=table` or `?q=`, so a cleared list leaves a
 * clean URL.
 */
function syncUrl(view: ConceptView, search: string): void {
  const url = new URL(window.location.href);
  if (view === 'table') {
    url.searchParams.delete(VIEW_PARAM);
  } else {
    url.searchParams.set(VIEW_PARAM, view);
  }
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function ConceptsWorkspace({
  items,
  track,
  demo,
  initialView,
  initialSearch,
}: ConceptsWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState<ConceptView>(initialView);
  const [search, setSearch] = useState(initialSearch);

  const pickView = useCallback(
    (next: ConceptView) => {
      setView(next);
      syncUrl(next, search);
    },
    [search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(view, next);
    },
    [view],
  );

  const clearSearch = useCallback(() => {
    setSearch('');
    syncUrl(view, '');
  }, [view]);

  const open = useCallback(
    (item: ConceptItem) => {
      router.push(item.href);
    },
    [router],
  );

  const create = useCallback(() => {
    router.push(conceptPath(NEW_CONCEPT));
  }, [router]);

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, item: ConceptItem) => {
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

  const columns = useMemo(() => conceptColumns(track, visible), [track, visible]);

  const newConcept = (
    <Button
      size="sm"
      disabled={demo}
      className={demo ? disabledWriteClassName : undefined}
      onClick={create}
      data-slot="new-concept"
    >
      New concept
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Concepts</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Concepts</h1>
          <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
            {newConcept}
          </DisabledWrite>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="concept-count">
            {narrowed
              ? filteredConceptCountLabel(visible.length, items.length)
              : conceptCountLabel(items.length)}
          </span>{' '}
          — one angle paired with one theme, named for you.
        </p>
      </header>

      <section aria-labelledby="concepts-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="concepts-heading" className="text-sm font-medium text-text2">
            Pipeline
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search concepts"
              aria-label="Search concepts by name, batch, angle, theme or status"
              data-slot="concept-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewToggle view={view} onChange={pickView} />
          </div>
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="concepts-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_CONCEPTS_NOTE}</p>
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
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                <Button
                  size="sm"
                  disabled={demo}
                  className={demo ? disabledWriteClassName : undefined}
                  onClick={create}
                  data-slot="empty-new-concept"
                >
                  New concept
                </Button>
              </DisabledWrite>
            )}
          </div>
        ) : view === 'board' ? (
          <ConceptBoard columns={columns} onOpen={open} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <Table data-slot="concepts-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {CONCEPT_COLUMNS.map((column) => (
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
                    data-slot="concept-row"
                    data-concept-id={item.id}
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
                      data-slot="concept-row-name"
                      className="px-3 py-1.5 font-mono text-xs whitespace-normal text-text"
                    >
                      {item.name}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 font-mono text-xs text-text2">
                      {item.batch ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.angleName ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 whitespace-normal text-text2">
                      {item.themeName ?? <span className="text-text4">{EM_DASH}</span>}
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
