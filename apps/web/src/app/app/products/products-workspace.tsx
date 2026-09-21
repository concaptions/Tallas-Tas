'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductListRow } from '@tas/db';
import { toCsv } from '@tas/domain/csv';
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

import { EM_DASH } from './fields';
import { NEW_PRODUCT, ProductPanel } from './product-panel';

/**
 * The Products table, its header actions and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open product lives in the `?product=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it.
 *
 * The filter is URL-backed the same way, in `?q=`: the two pieces of table state behave alike, a
 * refresh keeps the rows you had narrowed to, and "here are the sleep masks" is a link you can send.
 * The search box is also the way the empty state is reached: filtering to nothing says so in words
 * and offers to clear the filter, so the table area is never a blank rectangle.
 */
export interface ProductItem {
  readonly product: ProductListRow;
  /** The landing page host, computed on the server; the full URL is the cell's `title`. */
  readonly linkHost: string;
  /** The collection host, or null when the product has no collection link. */
  readonly collectionHost: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface ProductsWorkspaceProps {
  readonly items: readonly ProductItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  /** `PRODUCT_CSV_COLUMNS`, passed as data so `@tas/db` stays out of the browser bundle. */
  readonly templateColumns: readonly string[];
}

/** The file a strategist gets from "Download template". */
const TEMPLATE_FILENAME = 'products-template.csv';

/** Why Upload CSV is inert outside demo mode: the import phase has not shipped yet. */
const UPLOAD_SOON_HINT = 'Bulk upload arrives with the CSV import phase.';

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'product' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * Builds the template in the browser and hands it to the download manager. No fetch, no Server
 * Action, no database: `toCsv` is a pure function from `@tas/domain/csv` and the column list arrived
 * with the page, which is why this control stays enabled in demo mode (ticket criterion 7).
 */
function downloadCsv(columns: readonly string[]): void {
  const blob = new Blob([toCsv(columns, [])], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = TEMPLATE_FILENAME;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download before the browser has read the blob.
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1_000);
}

function matches(item: ProductItem, query: string): boolean {
  const { name, link, collectionLink } = item.product;
  return [name, link, collectionLink ?? ''].some((value) => value.toLowerCase().includes(query));
}

export function ProductsWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
  templateColumns,
}: ProductsWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('product', id);
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
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.product.id === selection)?.product ?? null;
  const creating = selection === NEW_PRODUCT;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Products</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Products</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                select(NEW_PRODUCT);
              }}
              data-slot="new-product"
            >
              New product
            </Button>
            {/*
              Upload CSV has no action behind it yet, so it is disabled in both modes — but it always
              explains itself, with the demo-mode hint when there is no session to write with.
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv(templateColumns);
              }}
              title={`Header row: ${templateColumns.join(',')}`}
              data-slot="download-template"
            >
              Download template
            </Button>
          </div>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="product-count">
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'product' : 'products'}`
              : `${String(visible.length)} of ${String(items.length)} products`}
          </span>{' '}
          — the landing pages every angle is written against.
        </p>
      </header>

      <section aria-labelledby="products-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="products-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name or URL"
            aria-label="Search products by name or URL"
            data-slot="product-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="products-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Product name</TableHead>
                <TableHead className="px-3">Landing page URL</TableHead>
                <TableHead className="px-3">Collection link</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-3 py-10">
                    <div
                      data-slot="products-empty"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <p className="text-sm text-text2">
                        {items.length === 0
                          ? 'No products yet. Start with the landing page you are sending traffic to.'
                          : `Nothing matches “${term}”. Try a product name or a domain.`}
                      </p>
                      {items.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            select(NEW_PRODUCT);
                          }}
                          data-slot="empty-new-product"
                        >
                          New product
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
                visible.map(({ product, linkHost, collectionHost, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={product.id}
                    data-slot="product-row"
                    data-product-id={product.id}
                    data-state={product.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={product.name}
                    onClick={() => {
                      select(product.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, product.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      <span className="flex items-center gap-1.5">
                        {product.name}
                        <PropagationBadge
                          templateRowId={product.templateRowId}
                          overriddenFields={product.overriddenFields}
                        />
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text2" title={product.link}>
                      {linkHost}
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5 text-text2"
                      title={product.collectionLink ?? undefined}
                    >
                      {collectionHost ?? <span className="text-text4">{EM_DASH}</span>}
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
        <ProductPanel
          key={selection}
          product={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
