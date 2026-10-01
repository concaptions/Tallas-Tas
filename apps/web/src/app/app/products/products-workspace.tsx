'use client';

import { useCallback, useMemo, useState } from 'react';
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
} from '@tas/ui';

import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import { EM_DASH, type LinkedRecord } from './fields';
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
  /** The email campaigns promoting this product, indexed on the server from the junction. */
  readonly emailCampaigns: readonly LinkedRecord[];
  /** The YouTube copy rows written for this product, indexed the same way. */
  readonly youtubeCopy: readonly LinkedRecord[];
  /** The briefs whose `product_id` is this product, indexed the same way. */
  readonly creativeDesigns: readonly LinkedRecord[];
  /** The creators booked for this product through `creator_products`, indexed the same way. */
  readonly creators: readonly LinkedRecord[];
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

/**
 * The Airtable-style grid columns for Products (P2A): the frozen name column carries the propagation
 * badge; the two link columns show the host and keep the full URL in the cell title; every column but
 * the collection link is sortable. Column order and headers are the same the plain table used, so the
 * page's existing automation contract is unchanged.
 */
const PRODUCT_COLUMNS: readonly GridColumn<ProductItem>[] = [
  {
    key: 'name',
    header: 'Product name',
    frozen: true,
    minWidth: 200,
    sortValue: (item) => item.product.name,
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.product.name}
        <PropagationBadge
          templateRowId={item.product.templateRowId}
          overriddenFields={item.product.overriddenFields}
        />
      </span>
    ),
  },
  {
    key: 'link',
    header: 'Landing page URL',
    sortValue: (item) => item.linkHost,
    cellTitle: (item) => item.product.link,
    render: (item) => item.linkHost,
  },
  {
    key: 'collection',
    header: 'Collection link',
    cellTitle: (item) => item.product.collectionLink ?? undefined,
    render: (item) => item.collectionHost ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

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

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const openItem = items.find((item) => item.product.id === selection) ?? null;
  const open = openItem?.product ?? null;
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

        <AirtableGrid
          tableKey="products"
          columns={PRODUCT_COLUMNS}
          rows={visible}
          rowId={(item) => item.product.id}
          rowLabel={(item) => item.product.name}
          rowAttributes={(item) => ({ 'data-product-id': item.product.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.product.id);
          }}
          tableSlot="products-table"
          rowSlot="product-row"
          empty={
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
          }
        />
      </section>

      {creating || open !== null ? (
        <ProductPanel
          key={selection}
          product={creating ? null : open}
          emailCampaigns={openItem?.emailCampaigns ?? []}
          youtubeCopy={openItem?.youtubeCopy ?? []}
          creativeDesigns={openItem?.creativeDesigns ?? []}
          creators={openItem?.creators ?? []}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
