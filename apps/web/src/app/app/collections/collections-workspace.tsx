'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CollectionListRow } from '@tas/db';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
} from '@tas/ui';

import { ColumnNotices } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import {
  countLabel,
  EM_DASH,
  matchesSearch,
  NO_COLLECTIONS_HINT,
  NO_MATCHES_HINT_PREFIX,
  UPLOAD_SOON_HINT,
  type LinkedRecord,
} from './fields';
import { CollectionPanel, NEW_COLLECTION } from './collections-panel';

/**
 * The Collections grid, its header actions and its side panel. GRATSI-MATCH collections
 * (2026-10-04): the grid reads its column set from the resolver — label, order and visibility are
 * DATA per brand — and the renderers below draw a cell for every key either base can resolve. The
 * reverse links (`youtube_copy_collections`, `concept_collections`,
 * `creative_briefs.collection_id`) were already resolved to named records for the panel; they are
 * read-only grid columns now too, because the Gratsi base displays them as fields.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open collection lives in the `?collection=` query
 * parameter, written with the History API so opening a row is instant and a refresh still reopens
 * it; the filter is URL-backed the same way, in `?q=`.
 */
export interface CollectionItem {
  readonly collection: CollectionListRow;
  /** The URL's host, computed on the server; the full URL is the cell's `title`. */
  readonly urlHost: string | null;
  /** The email campaigns that link to this collection (`email_campaign_collections`), read-only. */
  readonly emailCampaigns: readonly LinkedRecord[];
  /** The YouTube copy that links to this collection (`youtube_copy_collections`), read-only. */
  readonly youtubeCopy: readonly LinkedRecord[];
  /** The concepts linked to this collection (`concept_collections`), read-only. */
  readonly concepts: readonly LinkedRecord[];
  /** The briefs whose `collection_id` is this collection (`creative_briefs.collection_id`), read-only. */
  readonly creativeDesigns: readonly LinkedRecord[];
  /** The Meta copy `collections.copywriting_id` points at, or null when there is none. */
  readonly metaCopy: LinkedRecord | null;
  /** The brief `collections.creative_design_2_id` points at, or null when there is none. */
  readonly creativeDesign2: LinkedRecord | null;
}

interface CollectionsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCollectionColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly CollectionItem[];
  /** The campaign picker's options, loaded once by the page. */
  readonly campaigns: readonly { readonly id: string; readonly name: string }[];
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

/** The em-dash every empty cell renders, so blank never means "forgot to draw". */
function emptyCell() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/**
 * A read-only linked-records cell: the far rows' names, comma-joined and truncated, the full list
 * in the tooltip. Generated system titles (§7 names, Copy #s, Batch-Angle-Theme names) always
 * render in `font-mono` (CLAUDE.md non-negotiable 6), and every list this grid draws is one.
 */
function linkedNamesCell(links: readonly LinkedRecord[]) {
  if (links.length === 0) return emptyCell();
  return (
    <span className="block max-w-[20rem] truncate font-mono text-xs">
      {links.map((link) => link.label).join(', ')}
    </span>
  );
}

const linkedTitle = (links: readonly LinkedRecord[]) =>
  links.length === 0 ? undefined : links.map((link) => link.label).join(', ');

/** One linked record as a cell — the stored single links (`copywriting_id`, `creative_design_2_id`). */
function linkedOneCell(link: LinkedRecord | null) {
  return link === null ? (
    emptyCell()
  ) : (
    <span className="font-mono text-xs whitespace-nowrap">{link.label}</span>
  );
}

/**
 * THE Collections renderer registry, keyed by the resolver's `column_key`: the parent's eight
 * columns and Gratsi's three junction-backed reverse links. Every key either base can resolve has
 * an entry, so the "Configured but not drawn here" notice never fires.
 */
const COLLECTION_RENDERERS: ColumnRegistry<CollectionItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.collection.name}
        <PropagationBadge
          templateRowId={item.collection.templateRowId}
          overriddenFields={item.collection.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.collection.name,
  },
  url: {
    render: (item) => (item.urlHost === null ? emptyCell() : <span>{item.urlHost}</span>),
    sortValue: (item) => item.urlHost,
    cellTitle: (item) => item.collection.url ?? undefined,
  },
  campaign_id: {
    render: (item) =>
      item.collection.campaignName === null ? (
        emptyCell()
      ) : (
        // The campaign's generated Holiday-Offer-Code name: system output, font-mono.
        <span className="font-mono text-xs whitespace-nowrap">{item.collection.campaignName}</span>
      ),
    sortValue: (item) => item.collection.campaignName,
  },
  angle_id: {
    render: (item) => item.collection.angleName ?? emptyCell(),
    sortValue: (item) => item.collection.angleName,
  },
  product_id: {
    render: (item) => item.collection.productName ?? emptyCell(),
    sortValue: (item) => item.collection.productName,
  },
  creative_design_note: {
    render: (item) =>
      item.collection.creativeDesignNote === null ? (
        emptyCell()
      ) : (
        <span className="block max-w-[22rem] truncate">{item.collection.creativeDesignNote}</span>
      ),
    cellTitle: (item) => item.collection.creativeDesignNote ?? undefined,
    minWidth: 200,
  },
  copywriting_id: {
    render: (item) => linkedOneCell(item.metaCopy),
    sortValue: (item) => item.metaCopy?.label ?? null,
  },
  creative_design_2_id: {
    render: (item) => linkedOneCell(item.creativeDesign2),
    sortValue: (item) => item.creativeDesign2?.label ?? null,
  },
  // Gratsi's `Copywriting`: the inverse of Youtube Copywriting › Collections (youtube_copy_collections).
  youtube_copy_collections: {
    render: (item) => linkedNamesCell(item.youtubeCopy),
    sortValue: (item) => item.youtubeCopy.length,
    cellTitle: (item) => linkedTitle(item.youtubeCopy),
  },
  // Gratsi's `Angles`, which links CONCEPTS despite its name (concept_collections).
  concept_collections: {
    render: (item) => linkedNamesCell(item.concepts),
    sortValue: (item) => item.concepts.length,
    cellTitle: (item) => linkedTitle(item.concepts),
  },
  // Gratsi's `(Internal) Creative Design`: the briefs whose `collection_id` points here.
  creative_briefs: {
    render: (item) => linkedNamesCell(item.creativeDesigns),
    sortValue: (item) => item.creativeDesigns.length,
    cellTitle: (item) => linkedTitle(item.creativeDesigns),
  },
};

export function CollectionsWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  campaigns,
  demo,
  initialSelection,
  initialSearch,
}: CollectionsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, COLLECTION_RENDERERS, { freezeFirst: true, frozenMinWidth: 220 }),
    [columns],
  );
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

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesSearch(item.collection, query))),
    [items, query],
  );

  const open = items.find((item) => item.collection.id === selection) ?? null;
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

        <ColumnNotices
          slotPrefix="collection"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="COLLECTION_RENDERERS in collections-workspace.tsx"
        />

        <AirtableGrid
          tableKey="collections"
          columns={grid.columns}
          rows={visible}
          rowId={(item) => item.collection.id}
          rowLabel={(item) => item.collection.name}
          rowAttributes={(item) => ({ 'data-collection-id': item.collection.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.collection.id);
          }}
          tableSlot="collections-table"
          rowSlot="collection-row"
          empty={
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
          }
        />
      </section>

      {creating || open !== null ? (
        <CollectionPanel
          key={selection}
          collection={open === null ? null : open.collection}
          emailCampaigns={open === null ? [] : open.emailCampaigns}
          youtubeCopy={open === null ? [] : open.youtubeCopy}
          concepts={open === null ? [] : open.concepts}
          creativeDesigns={open === null ? [] : open.creativeDesigns}
          metaCopy={open === null ? null : open.metaCopy}
          campaigns={campaigns}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
