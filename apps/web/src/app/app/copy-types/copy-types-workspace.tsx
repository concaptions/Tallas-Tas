'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, PropagationBadge, StatusChip } from '@tas/ui';

import { ColumnNotices, ViewSwitcher } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { CopyTypePanel, NEW_COPY_TYPE, type CopyTypeItem } from './copy-type-panel';
import { EM_DASH, linkCountTone, metaCopyCountLabel, youtubeCopyCountLabel } from './fields';

export type { CopyTypeItem };

/**
 * The Copy Types grid, its header actions and its side panel. A copy of `products-workspace.tsx`
 * with the two link counts as columns and the two read-only copy lists in the panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open copy type lives in the `?copyType=` query
 * parameter, written with the History API so opening a row is instant and a refresh still reopens
 * it. The filter is URL-backed the same way, in `?q=`.
 */
interface CopyTypesWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from the shared resolver loader. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly CopyTypeItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const TABLE_KEY = 'copy-types';

const COPY_TYPES_CAP = getTableCapability(TABLE_KEY) as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'copyType' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The search reads what the grid and the panel show: name, description and the linked copies. */
function matches(item: CopyTypeItem, query: string): boolean {
  const { name, description } = item.copyType;
  return [
    name,
    description ?? '',
    item.metaCopies.map((copy) => copy.label).join(' '),
    item.youtubeCopies.map((copy) => copy.label).join(' '),
  ].some((value) => value.toLowerCase().includes(query));
}

/**
 * THE Copy Types renderer registry, keyed by the resolver's `column_key` — a Postgres column, or the
 * junction that carries a foreign key back to `copy_types` for a link column.
 *
 * This replaces the hand-written `COPY_TYPE_COLUMNS` array: no header string and no ordering here,
 * only how a cell is drawn. The two counts stay the shared `StatusChip` in the count tones, never
 * bare text, so a zero is a visible chip rather than an empty cell.
 */
const COPY_TYPE_RENDERERS: ColumnRegistry<CopyTypeItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.copyType.name}
        <PropagationBadge
          templateRowId={item.copyType.templateRowId}
          overriddenFields={item.copyType.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.copyType.name,
  },
  description: {
    render: (item) => item.descriptionPreview ?? <span className="text-text4">{EM_DASH}</span>,
    sortValue: (item) => item.descriptionPreview,
    cellTitle: (item) => item.copyType.description ?? undefined,
    minWidth: 240,
  },
  copywriting_copy_types: {
    render: (item) => (
      <StatusChip
        tone={linkCountTone(item.metaCopies.length)}
        label={metaCopyCountLabel(item.metaCopies.length)}
      />
    ),
    sortValue: (item) => item.metaCopies.length,
    cellTitle: (item) => item.metaCopies.map((copy) => copy.label).join(', ') || undefined,
  },
  youtube_copy_copy_types: {
    render: (item) => (
      <StatusChip
        tone={linkCountTone(item.youtubeCopies.length)}
        label={youtubeCopyCountLabel(item.youtubeCopies.length)}
      />
    ),
    sortValue: (item) => item.youtubeCopies.length,
    cellTitle: (item) => item.youtubeCopies.map((copy) => copy.label).join(', ') || undefined,
  },
};

export function CopyTypesWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  columns,
  unconfiguredColumns = false,
}: CopyTypesWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, COPY_TYPE_RENDERERS, { freezeFirst: true, frozenMinWidth: 200 }),
    [columns],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('copyType', id);
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

  const open = items.find((item) => item.copyType.id === selection) ?? null;
  const creating = selection === NEW_COPY_TYPE;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Copy Types</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Copy Types</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_COPY_TYPE);
            }}
            data-slot="new-copy-type"
          >
            New copy type
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="copy-type-count">
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'copy type' : 'copy types'}`
              : `${String(visible.length)} of ${String(items.length)} copy types`}
          </span>{' '}
          — the kinds of copy a Meta or YouTube copy row is tagged with.
        </p>
      </header>

      <section aria-labelledby="copy-types-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="copy-types-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, description or copy"
              aria-label="Search copy types"
              data-slot="copy-type-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...COPY_TYPES_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={null}
            />
          </div>
        </div>

        <ColumnNotices
          slotPrefix="copy-type"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="COPY_TYPE_RENDERERS in copy-types-workspace.tsx"
        />

        <AirtableGrid
          tableKey={TABLE_KEY}
          columns={grid.columns}
          rows={visible}
          rowId={(item) => item.copyType.id}
          rowLabel={(item) => item.copyType.name}
          rowAttributes={(item) => ({ 'data-copy-type-id': item.copyType.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.copyType.id);
          }}
          tableSlot="copy-types-table"
          rowSlot="copy-type-row"
          empty={
            <div
              data-slot="copy-types-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              <p className="text-sm text-text2">
                {items.length === 0
                  ? 'No copy types yet. Start with the kind of copy you write most.'
                  : `Nothing matches “${term}”. Try a type name, a description or a headline.`}
              </p>
              {items.length === 0 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    select(NEW_COPY_TYPE);
                  }}
                  data-slot="empty-new-copy-type"
                >
                  New copy type
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
        <CopyTypePanel
          key={selection}
          item={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
