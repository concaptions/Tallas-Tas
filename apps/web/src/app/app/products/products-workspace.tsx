'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductListRow } from '@tas/db';
import { getTableCapability } from '@tas/domain';
import { toCsv } from '@tas/domain/csv';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
} from '@tas/ui';

import {
  ColumnNotices,
  GalleryView,
  galleryItemsFrom,
  ListView,
  useTableView,
  ViewToolbar,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { CountCell, TextCell } from '@/components/views/grid-cells';

import { EM_DASH, type CreatorOption, type LinkedRecord } from './fields';
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
  /** The angles linked through `angle_products`, by id, for the panel's two-way field. */
  readonly angleIds: readonly string[];
}

interface ProductsWorkspaceProps {
  readonly items: readonly ProductItem[];
  /** The brand's ordered, labelled, visible Products columns, from `loadProductColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /**
   * True when `columns` is the parent master-set fallback because the brand resolved none of its own.
   * Stated on the page rather than passed off as the brand's configuration — the counterpart of the
   * `missing` notice, for the other direction.
   */
  readonly unconfiguredColumns?: boolean;
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  /** `PRODUCT_CSV_COLUMNS`, passed as data so `@tas/db` stays out of the browser bundle. */
  readonly templateColumns: readonly string[];
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
  /** The brand's angles, for the panel's two-way Linked angles field (LINK-01). */
  readonly angleOptions?: readonly { readonly id: string; readonly name: string }[];
  /** The brand's creators, for the panel's two-way Creators field (LINK-01). */
  readonly creatorOptions?: readonly CreatorOption[];
}

// Safe: 'products' is always in TABLE_VIEW_CAPABILITIES
const PRODUCTS_CAP = getTableCapability('products') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

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
 * THE Products renderer registry, keyed by the resolver's `column_key` — a Postgres column, or the
 * table that carries the foreign key back to `products` for a link column.
 *
 * This replaces the hand-written `PRODUCT_COLUMNS` array, and the difference is the whole point:
 * there is no header string and no ordering here. Labels, order and visibility arrive as data from
 * `column_definitions`; this says only how a cell is DRAWN — the propagation badge beside the name,
 * a host with the full URL in the cell title, a joined name list, a count with its noun.
 *
 * It covers every column this page can draw, not the set any one brand shows. Three parent columns
 * are deliberately absent — `collections`, `campaigns_offers` and `copywriting`, the reverse links
 * the parent base defines and this page has never displayed. Drawing them would mean three more
 * whole-table reads on a page that already makes six, so they come back in `missing` and are stated
 * on the page instead of being silently omitted. Gratsi hides all three, so only an inheriting brand
 * sees that notice.
 */
const PRODUCT_RENDERERS: ColumnRegistry<ProductItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.product.name}
        <PropagationBadge
          templateRowId={item.product.templateRowId}
          overriddenFields={item.product.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.product.name,
  },
  link: {
    render: (item) => item.linkHost,
    sortValue: (item) => item.linkHost,
    cellTitle: (item) => item.product.link,
  },
  // A stored column with no Airtable field in either base, so a platform row
  // (docs/decisions/column-key-relations-2026-10-03.md).
  collection_link: {
    render: (item) => item.collectionHost ?? <span className="text-text4">{EM_DASH}</span>,
    cellTitle: (item) => item.product.collectionLink ?? undefined,
  },
  // The junction, by name rather than by count: the angles are few and worth reading in the row.
  angle_products: {
    render: (item) => <TextCell value={item.product.angleNames.join(', ')} maxWidth={320} />,
    sortValue: (item) => item.product.angleNames.length,
  },
  // Two hops away and computed on read; see the gate's documented exemption in column-seed.test.ts.
  concepts: {
    render: (item) => <CountCell count={item.product.conceptCount} noun="concept" />,
    sortValue: (item) => item.product.conceptCount,
  },
  creative_briefs: {
    render: (item) => <CountCell count={item.creativeDesigns.length} noun="design" />,
    sortValue: (item) => item.creativeDesigns.length,
  },
  creator_products: {
    render: (item) => <CountCell count={item.creators.length} noun="creator" />,
    sortValue: (item) => item.creators.length,
  },
  email_campaign_products: {
    render: (item) => <CountCell count={item.emailCampaigns.length} noun="campaign" />,
    sortValue: (item) => item.emailCampaigns.length,
  },
  youtube_copy_products: {
    render: (item) => <CountCell count={item.youtubeCopy.length} noun="copy" />,
    sortValue: (item) => item.youtubeCopy.length,
  },
};

export function ProductsWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
  templateColumns,
  userViews,
  angleOptions = [],
  creatorOptions = [],
  columns,
  unconfiguredColumns = false,
}: ProductsWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, PRODUCT_RENDERERS, { freezeFirst: true, frozenMinWidth: 200 }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, and its label, in resolved order (VIEWS-01). */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('product', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'products',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    initialViewType: null,
    fieldKeys,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const setActiveView = tableView.setViewType;
  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      tableView.setFilter(next);
    },
    [filter, tableView],
  );

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

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(
        visible,
        grid.columns,
        (item) => ({
          id: item.product.id,
          name: item.product.name,
          subtitle: item.linkHost,
        }),
        { fieldOrder: tableView.config.fieldOrder },
      ),
    [visible, grid, tableView.config.fieldOrder],
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
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="products-heading" className="text-sm font-medium text-text2">
              Library
            </h2>
            <ViewToolbar
              tableKey="products"
              supportedViews={[...PRODUCTS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={null}
              views={tableView.views}
              activeViewId={tableView.activeView?.id ?? null}
              onActivateView={tableView.activateView}
              onCreateView={tableView.createView}
              onRenameView={tableView.renameView}
              onDeleteView={tableView.deleteView}
              fields={fieldOptions}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              onMoveField={tableView.moveField}
              error={tableView.error}
            />
          </div>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
            }}
            placeholder="Search name or URL"
            aria-label="Search products by name or URL"
            data-slot="product-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <ColumnNotices
          slotPrefix="product"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="PRODUCT_RENDERERS in products-workspace.tsx"
        />

        {activeView === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            cardSlot="product-card"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : activeView === 'list' ? (
          <ListView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            rowSlot="product-list-row"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="products"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={grid.columns}
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
        )}
      </section>

      {creating || open !== null ? (
        <ProductPanel
          key={selection}
          product={creating ? null : open}
          emailCampaigns={openItem?.emailCampaigns ?? []}
          youtubeCopy={openItem?.youtubeCopy ?? []}
          creativeDesigns={openItem?.creativeDesigns ?? []}
          creators={openItem?.creators ?? []}
          creatorOptions={creatorOptions}
          angleOptions={angleOptions}
          angleIds={openItem?.angleIds ?? []}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
