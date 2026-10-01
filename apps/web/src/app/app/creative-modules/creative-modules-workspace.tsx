'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeModuleListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, PropagationBadge, StatusChip } from '@tas/ui';

import { ViewSwitcher } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import { CreativeModulePanel, NEW_CREATIVE_MODULE, type LinkOption } from './creative-module-panel';
import { angleCountLabel, designCountLabel, EM_DASH, linkCountTone } from './fields';

/**
 * The Creative Modules grid, its header actions and its side panel. A copy of
 * `products-workspace.tsx` with the two link counts as columns and the two chip pickers in the panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open module lives in the `?module=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it. The
 * filter is URL-backed the same way, in `?q=`.
 */
export interface CreativeModuleItem {
  readonly creativeModule: CreativeModuleListRow;
  /** The Foreplay board host, computed on the server, or null when there is no link. */
  readonly foreplayHost: string | null;
  /** The two Airtable record-link counts, computed on the server from the junction ids. */
  readonly angleCount: number;
  readonly designCount: number;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CreativeModulesWorkspaceProps {
  readonly items: readonly CreativeModuleItem[];
  /** The brand's angles and briefs, the options the panel's two chip pickers offer. */
  readonly angles: readonly LinkOption[];
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const TABLE_KEY = 'creative-modules';

const CREATIVE_MODULES_CAP = getTableCapability(TABLE_KEY) as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'module' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The search reads what the grid and the panel show: name, link, linked angles and designs. */
function matches(item: CreativeModuleItem, query: string): boolean {
  const { moduleName, foreplayLink, angleNames, briefNames } = item.creativeModule;
  return [moduleName, foreplayLink ?? '', angleNames.join(' '), briefNames.join(' ')].some(
    (value) => value.toLowerCase().includes(query),
  );
}

/**
 * The Airtable-style grid columns: the frozen name column carries the propagation badge; the link
 * column shows the host and keeps the full URL in the cell title; the two counts are the shared
 * `StatusChip` in the count tones, never bare text, so a zero is a visible chip.
 */
const CREATIVE_MODULE_COLUMNS: readonly GridColumn<CreativeModuleItem>[] = [
  {
    key: 'moduleName',
    header: 'Module name',
    frozen: true,
    minWidth: 220,
    sortValue: (item) => item.creativeModule.moduleName,
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.creativeModule.moduleName}
        <PropagationBadge
          templateRowId={item.creativeModule.templateRowId}
          overriddenFields={item.creativeModule.overriddenFields}
        />
      </span>
    ),
  },
  {
    key: 'foreplayLink',
    header: 'Foreplay link',
    sortValue: (item) => item.foreplayHost,
    cellTitle: (item) => item.creativeModule.foreplayLink ?? undefined,
    render: (item) => item.foreplayHost ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'angles',
    header: 'Angles',
    sortValue: (item) => item.angleCount,
    cellTitle: (item) => item.creativeModule.angleNames.join(', ') || undefined,
    render: (item) => (
      <StatusChip tone={linkCountTone(item.angleCount)} label={angleCountLabel(item.angleCount)} />
    ),
  },
  {
    key: 'designs',
    header: 'Creative designs',
    sortValue: (item) => item.designCount,
    cellTitle: (item) => item.creativeModule.briefNames.join(', ') || undefined,
    render: (item) => (
      <StatusChip
        tone={linkCountTone(item.designCount)}
        label={designCountLabel(item.designCount)}
      />
    ),
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

export function CreativeModulesWorkspace({
  items,
  angles,
  briefs,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
}: CreativeModulesWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('module', id);
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

  const open = items.find((item) => item.creativeModule.id === selection)?.creativeModule ?? null;
  const creating = selection === NEW_CREATIVE_MODULE;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Modules</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Modules</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_CREATIVE_MODULE);
            }}
            data-slot="new-creative-module"
          >
            New module
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="creative-module-count">
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'module' : 'modules'}`
              : `${String(visible.length)} of ${String(items.length)} modules`}
          </span>{' '}
          — the creative patterns briefs are grouped under, each with its Foreplay board.
        </p>
      </header>

      <section aria-labelledby="creative-modules-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="creative-modules-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, link, angle or design"
              aria-label="Search creative modules"
              data-slot="creative-module-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...CREATIVE_MODULES_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={null}
            />
          </div>
        </div>

        <AirtableGrid
          tableKey={TABLE_KEY}
          columns={CREATIVE_MODULE_COLUMNS}
          rows={visible}
          rowId={(item) => item.creativeModule.id}
          rowLabel={(item) => item.creativeModule.moduleName}
          rowAttributes={(item) => ({ 'data-creative-module-id': item.creativeModule.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.creativeModule.id);
          }}
          tableSlot="creative-modules-table"
          rowSlot="creative-module-row"
          empty={
            <div
              data-slot="creative-modules-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              <p className="text-sm text-text2">
                {items.length === 0
                  ? 'No creative modules yet. Start with the pattern your best briefs share.'
                  : `Nothing matches “${term}”. Try a module name, an angle or a design.`}
              </p>
              {items.length === 0 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    select(NEW_CREATIVE_MODULE);
                  }}
                  data-slot="empty-new-creative-module"
                >
                  New module
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
        <CreativeModulePanel
          key={selection}
          creativeModule={creating ? null : open}
          angles={angles}
          briefs={briefs}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
