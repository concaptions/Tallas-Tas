'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CompetitiveResearchListRow } from '@tas/db';
import {
  Button,
  Input,
  PropagationBadge,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import {
  COMPETITIVE_RESEARCH_COLUMNS,
  countLabel,
  EM_DASH,
  EMPTY_NO_MATCH_HINT,
  EMPTY_NO_MATCH_PREFIX,
  EMPTY_NO_ROWS,
  matchesQuery,
  typeTone,
} from './fields';
import { CompetitiveResearchPanel, NEW_COMPETITIVE_RESEARCH } from './competitive-research-panel';

/**
 * The Competitive Research table, its header actions and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open entry lives in the `?entry=` query parameter, written
 * with the History API so opening a row is instant and a refresh still reopens it.
 *
 * The filter is URL-backed the same way, in `?q=`: the two pieces of table state behave alike, a
 * refresh keeps the rows you had narrowed to, and "here are the direct competitors" is a link you
 * can send. The search box is also the way the empty state is reached: filtering to nothing says so
 * in words and offers to clear the filter, so the table area is never a blank rectangle.
 */
export interface CompetitiveResearchItem {
  readonly entry: CompetitiveResearchListRow;
  /** The website host, computed on the server; the full URL is the cell's `title`. */
  readonly websiteHost: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CompetitiveResearchWorkspaceProps {
  readonly items: readonly CompetitiveResearchItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'entry' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function CompetitiveResearchWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
}: CompetitiveResearchWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('entry', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const saved = useCallback(
    (id: string) => {
      select(id);
      router.refresh();
    },
    [router, select],
  );

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    }
  };

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => items.filter((item) => matchesQuery(item.entry, query)),
    [items, query],
  );

  const open = items.find((item) => item.entry.id === selection)?.entry ?? null;
  const creating = selection === NEW_COMPETITIVE_RESEARCH;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          Competitive Research
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Competitive Research</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_COMPETITIVE_RESEARCH);
            }}
            data-slot="new-competitive-research"
          >
            New competitor
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="competitive-research-count">
            {countLabel(visible.length, items.length)}
          </span>{' '}
          — the competitors every angle is written against.
        </p>
      </header>

      <section aria-labelledby="competitive-research-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="competitive-research-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name, type or URL"
            aria-label="Search competitive research by name, type or URL"
            data-slot="competitive-research-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="competitive-research-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {COMPETITIVE_RESEARCH_COLUMNS.map((column) => (
                  <TableHead key={column.key} className="px-3">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COMPETITIVE_RESEARCH_COLUMNS.length} className="px-3 py-10">
                    <div
                      data-slot="competitive-research-empty"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <p className="text-sm text-text2">
                        {items.length === 0
                          ? EMPTY_NO_ROWS
                          : `${EMPTY_NO_MATCH_PREFIX} “${term}”. ${EMPTY_NO_MATCH_HINT}`}
                      </p>
                      {items.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            select(NEW_COMPETITIVE_RESEARCH);
                          }}
                          data-slot="empty-new-competitive-research"
                        >
                          New competitor
                        </Button>
                      ) : (
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(({ entry, websiteHost, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={entry.id}
                    data-slot="competitive-research-row"
                    data-competitive-research-id={entry.id}
                    data-state={entry.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={entry.name}
                    onClick={() => {
                      select(entry.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, entry.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      <span className="flex items-center gap-1.5">
                        {entry.name}
                        <PropagationBadge
                          templateRowId={entry.templateRowId}
                          overriddenFields={entry.overriddenFields}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      {entry.type === null ? (
                        <span className="text-text4">{EM_DASH}</span>
                      ) : (
                        <StatusChip tone={typeTone(entry.type)} label={entry.type} />
                      )}
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5 text-text2"
                      title={entry.website ?? undefined}
                    >
                      {websiteHost ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">
                      {entry.instagram ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text3" title={updatedTitle}>
                      {updatedLabel}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {creating || open !== null ? (
        <CompetitiveResearchPanel
          key={selection}
          entry={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
