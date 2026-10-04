'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompetitiveResearchListRow } from '@tas/db';
import { Button, Input, PropagationBadge, StatusChip } from '@tas/ui';

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
  EMPTY_NO_MATCH_HINT,
  EMPTY_NO_MATCH_PREFIX,
  EMPTY_NO_ROWS,
  matchesQuery,
  typeTone,
} from './fields';
import { CompetitiveResearchPanel, NEW_COMPETITIVE_RESEARCH } from './competitive-research-panel';

/**
 * The Competitive Research grid, its header actions and its side panel. GRATSI-MATCH
 * competitive_research (2026-10-04): the grid reads its column set from the resolver — the table
 * is identical in both bases (seven stored fields, no flags), so every brand resolves Name, Type,
 * Website, Insta, FB Page, Meta Ads Library and Analysis, under per-brand labels and order the
 * moment a brand configures any.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open entry lives in the `?entry=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it; the
 * filter is URL-backed the same way, in `?q=`.
 */
export interface CompetitiveResearchItem {
  readonly entry: CompetitiveResearchListRow;
  /** The website host, computed on the server; the full URL is the cell's `title`. */
  readonly websiteHost: string | null;
}

interface CompetitiveResearchWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCompetitiveResearchColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
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

/** The em-dash every empty cell renders, so blank never means "forgot to draw". */
function emptyCell() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/** A long-text cell, truncated with the full value as the tooltip. */
function longTextCell(value: string | null) {
  return value === null || value === '' ? (
    emptyCell()
  ) : (
    <span className="block max-w-[24rem] truncate text-text2">{value}</span>
  );
}

/**
 * THE Competitive Research renderer registry, keyed by the resolver's `column_key`. Seven entries
 * — the full set either base can resolve — so the "Configured but not drawn here" notice never
 * fires.
 */
const COMPETITIVE_RESEARCH_RENDERERS: ColumnRegistry<CompetitiveResearchItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.entry.name}
        <PropagationBadge
          templateRowId={item.entry.templateRowId}
          overriddenFields={item.entry.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.entry.name,
  },
  type: {
    render: (item) =>
      item.entry.type === null ? (
        emptyCell()
      ) : (
        <StatusChip tone={typeTone(item.entry.type)} label={item.entry.type} />
      ),
    sortValue: (item) => item.entry.type,
  },
  website: {
    render: (item) => (item.websiteHost === null ? emptyCell() : <span>{item.websiteHost}</span>),
    sortValue: (item) => item.websiteHost,
    cellTitle: (item) => item.entry.website ?? undefined,
  },
  instagram: {
    render: (item) => item.entry.instagram ?? emptyCell(),
    sortValue: (item) => item.entry.instagram,
  },
  facebook_page: {
    render: (item) => longTextCell(item.entry.facebookPage),
    cellTitle: (item) => item.entry.facebookPage ?? undefined,
  },
  meta_ads_library: {
    render: (item) => longTextCell(item.entry.metaAdsLibrary),
    cellTitle: (item) => item.entry.metaAdsLibrary ?? undefined,
    minWidth: 220,
  },
  analysis: {
    render: (item) => longTextCell(item.entry.analysis),
    cellTitle: (item) => item.entry.analysis ?? undefined,
    minWidth: 220,
  },
};

export function CompetitiveResearchWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  demo,
  initialSelection,
  initialSearch,
}: CompetitiveResearchWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, COMPETITIVE_RESEARCH_RENDERERS, {
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

        <ColumnNotices
          slotPrefix="competitive-research"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="COMPETITIVE_RESEARCH_RENDERERS in competitive-research-workspace.tsx"
        />

        <AirtableGrid
          tableKey="competitive-research"
          columns={grid.columns}
          rows={visible}
          rowId={(item) => item.entry.id}
          rowLabel={(item) => item.entry.name}
          rowAttributes={(item) => ({ 'data-competitive-research-id': item.entry.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.entry.id);
          }}
          tableSlot="competitive-research-table"
          rowSlot="competitive-research-row"
          empty={
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
          }
        />
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
