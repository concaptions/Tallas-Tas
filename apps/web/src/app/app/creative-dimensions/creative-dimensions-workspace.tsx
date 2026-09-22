'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeDimensionListRow } from '@tas/db';
import {
  Button,
  Input,
  PropagationBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import { CreativeDimensionPanel, NEW_CREATIVE_DIMENSION } from './creative-dimensions-panel';
import { EM_DASH, EMPTY_SEARCH_HINT, EMPTY_TABLE_TEXT, countLabel, matchesQuery } from './fields';

/**
 * The Creative Dimensions table, its header actions and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open row lives in the `?dimension=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it.
 *
 * The filter is URL-backed the same way, in `?q=`: the two pieces of table state behave alike, a
 * refresh keeps the rows you had narrowed to, and "here are the story sizes" is a link you can send.
 */
export interface CreativeDimensionItem {
  readonly dimension: CreativeDimensionListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CreativeDimensionsWorkspaceProps {
  readonly items: readonly CreativeDimensionItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'dimension' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function CreativeDimensionsWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
}: CreativeDimensionsWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('dimension', id);
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
    () => (query === '' ? items : items.filter((item) => matchesQuery(item.dimension, query))),
    [items, query],
  );

  const open = items.find((item) => item.dimension.id === selection)?.dimension ?? null;
  const creating = selection === NEW_CREATIVE_DIMENSION;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          Creative Dimensions
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Dimensions</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_CREATIVE_DIMENSION);
            }}
            data-slot="new-creative-dimension"
          >
            New dimension
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="creative-dimension-count">
            {countLabel(visible.length, items.length)}
          </span>{' '}
          — the sizes and formats a creative design is exported to.
        </p>
      </header>

      <section aria-labelledby="creative-dimensions-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="creative-dimensions-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name or dimensions"
            aria-label="Search creative dimensions by name or dimensions"
            data-slot="creative-dimension-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="creative-dimensions-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Dimensions</TableHead>
                <TableHead className="px-3">Link Description</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-3 py-10">
                    <div
                      data-slot="creative-dimensions-empty"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <p className="text-sm text-text2">
                        {items.length === 0
                          ? EMPTY_TABLE_TEXT
                          : `Nothing matches “${term}”. ${EMPTY_SEARCH_HINT}`}
                      </p>
                      {items.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            select(NEW_CREATIVE_DIMENSION);
                          }}
                          data-slot="empty-new-creative-dimension"
                        >
                          New dimension
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
                visible.map(({ dimension, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={dimension.id}
                    data-slot="creative-dimension-row"
                    data-creative-dimension-id={dimension.id}
                    data-state={dimension.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={dimension.name}
                    onClick={() => {
                      select(dimension.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, dimension.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      <span className="flex items-center gap-1.5">
                        {dimension.name}
                        <PropagationBadge
                          templateRowId={dimension.templateRowId}
                          overriddenFields={dimension.overriddenFields}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-1.5 font-mono text-text2">
                      {dimension.dimensions ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">
                      {dimension.linkDescription ?? <span className="text-text4">{EM_DASH}</span>}
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
        <CreativeDimensionPanel
          key={selection}
          dimension={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
