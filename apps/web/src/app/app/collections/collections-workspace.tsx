'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CollectionListRow } from '@tas/db';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import {
  countLabel,
  EM_DASH,
  matchesSearch,
  NO_COLLECTIONS_HINT,
  NO_MATCHES_HINT_PREFIX,
  UPLOAD_SOON_HINT,
} from './fields';
import { CollectionPanel, NEW_COLLECTION } from './collections-panel';

/**
 * The Collections table, its header actions and its side panel — the same shape as
 * `products/products-workspace.tsx`.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open collection lives in the `?collection=` query
 * parameter, written with the History API so opening a row is instant and a refresh still reopens
 * it.
 *
 * The filter is URL-backed the same way, in `?q=`: the two pieces of table state behave alike, a
 * refresh keeps the rows you had narrowed to, and a filtered view is a link you can send. The
 * search box is also the way the empty state is reached: filtering to nothing says so in words and
 * offers to clear the filter, so the table area is never a blank rectangle.
 */
export interface CollectionItem {
  readonly collection: CollectionListRow;
  /** The URL's host, computed on the server; the full URL is the cell's `title`. */
  readonly urlHost: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CollectionsWorkspaceProps {
  readonly items: readonly CollectionItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'collection' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function CollectionsWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
}: CollectionsWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('collection', id);
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
    () => (query === '' ? items : items.filter((item) => matchesSearch(item.collection, query))),
    [items, query],
  );

  const open = items.find((item) => item.collection.id === selection)?.collection ?? null;
  const creating = selection === NEW_COLLECTION;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Collections</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Collections</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                select(NEW_COLLECTION);
              }}
              data-slot="new-collection"
            >
              New collection
            </Button>
            {/*
              Upload CSV has no action behind it yet, so it is disabled in both modes — but it
              always explains itself, with the demo-mode hint when there is no session to write
              with.
            */}
            <DisabledWrite hint={demo ? DEMO_WRITE_HINT : UPLOAD_SOON_HINT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className={disabledWriteClassName}
                data-slot="upload-csv"
              >
                Upload CSV
              </Button>
            </DisabledWrite>
          </div>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="collection-count">{countLabel(visible.length, items.length)}</span> — the
          campaign, angle and product a set of creatives is built around.
        </p>
      </header>

      <section aria-labelledby="collections-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="collections-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name, URL or linked work"
            aria-label="Search collections"
            data-slot="collection-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="collections-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">URL</TableHead>
                <TableHead className="px-3">Campaign</TableHead>
                <TableHead className="px-3">Angle</TableHead>
                <TableHead className="px-3">Product</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-3 py-10">
                    <div
                      data-slot="collections-empty"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <p className="text-sm text-text2">
                        {items.length === 0
                          ? NO_COLLECTIONS_HINT
                          : `${NO_MATCHES_HINT_PREFIX} “${term}”. Try a collection name or a domain.`}
                      </p>
                      {items.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            select(NEW_COLLECTION);
                          }}
                          data-slot="empty-new-collection"
                        >
                          New collection
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
                visible.map(({ collection, urlHost, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={collection.id}
                    data-slot="collection-row"
                    data-collection-id={collection.id}
                    data-state={collection.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={collection.name}
                    onClick={() => {
                      select(collection.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, collection.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      <span className="flex items-center gap-1.5">
                        {collection.name}
                        <PropagationBadge
                          templateRowId={collection.templateRowId}
                          overriddenFields={collection.overriddenFields}
                        />
                      </span>
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5 text-text2"
                      title={collection.url ?? undefined}
                    >
                      {urlHost ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">
                      {collection.campaignName ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">
                      {collection.angleName ?? <span className="text-text4">{EM_DASH}</span>}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2">
                      {collection.productName ?? <span className="text-text4">{EM_DASH}</span>}
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
        <CollectionPanel
          key={selection}
          collection={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
