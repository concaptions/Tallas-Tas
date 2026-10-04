'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeDimensionListRow } from '@tas/db';
import { Button, Input, PropagationBadge } from '@tas/ui';

import { ColumnNotices } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { CreativeDimensionPanel, NEW_CREATIVE_DIMENSION } from './creative-dimensions-panel';
import {
  EM_DASH,
  EMPTY_SEARCH_HINT,
  EMPTY_TABLE_TEXT,
  countLabel,
  matchesQuery,
  type LinkedDesign,
} from './fields';

/**
 * The Creative Dimensions grid, its header actions and its side panel. GRATSI-MATCH
 * creative_dimensions (2026-10-04): the grid reads its column set from the resolver — both bases
 * define the same four fields, so every brand resolves Name, Dimensions, Link Description and the
 * `(Internal) Creative Design` reverse link, whose briefs the page resolves to names.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open row lives in the `?dimension=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it; the
 * filter is URL-backed the same way, in `?q=`.
 */
export interface CreativeDimensionItem {
  readonly dimension: CreativeDimensionListRow;
  /** The briefs linked to this dimension (`creative_briefs.dimensions` by placement name, plus the stored uuid). */
  readonly linkedDesigns: readonly LinkedDesign[];
}

interface CreativeDimensionsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCreativeDimensionColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
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

/** The em-dash every empty cell renders, so blank never means "forgot to draw". */
function emptyCell() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/**
 * THE Creative Dimensions renderer registry, keyed by the resolver's `column_key`. Four entries —
 * the full set either base can resolve — so the "Configured but not drawn here" notice never fires.
 */
const CREATIVE_DIMENSION_RENDERERS: ColumnRegistry<CreativeDimensionItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.dimension.name}
        <PropagationBadge
          templateRowId={item.dimension.templateRowId}
          overriddenFields={item.dimension.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.dimension.name,
  },
  dimensions: {
    render: (item) =>
      item.dimension.dimensions === null ? (
        emptyCell()
      ) : (
        <span className="font-mono text-xs text-text2">{item.dimension.dimensions}</span>
      ),
    sortValue: (item) => item.dimension.dimensions,
  },
  link_description: {
    render: (item) => item.dimension.linkDescription ?? emptyCell(),
    sortValue: (item) => item.dimension.linkDescription,
  },
  // The reverse of the briefs' Dimensions link: generated §7 names, always font-mono.
  creative_design_id: {
    render: (item) =>
      item.linkedDesigns.length === 0 ? (
        emptyCell()
      ) : (
        <span className="block max-w-[22rem] truncate font-mono text-xs">
          {item.linkedDesigns.map((design) => design.label).join(', ')}
        </span>
      ),
    sortValue: (item) => item.linkedDesigns.length,
    cellTitle: (item) =>
      item.linkedDesigns.length === 0
        ? undefined
        : item.linkedDesigns.map((design) => design.label).join(', '),
  },
};

export function CreativeDimensionsWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  demo,
  initialSelection,
  initialSearch,
}: CreativeDimensionsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, CREATIVE_DIMENSION_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 200,
      }),
    [columns],
  );
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

        <ColumnNotices
          slotPrefix="creative-dimension"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="CREATIVE_DIMENSION_RENDERERS in creative-dimensions-workspace.tsx"
        />

        <AirtableGrid
          tableKey="creative-dimensions"
          columns={grid.columns}
          rows={visible}
          rowId={(item) => item.dimension.id}
          rowLabel={(item) => item.dimension.name}
          rowAttributes={(item) => ({ 'data-creative-dimension-id': item.dimension.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.dimension.id);
          }}
          tableSlot="creative-dimensions-table"
          rowSlot="creative-dimension-row"
          empty={
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
          }
        />
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
