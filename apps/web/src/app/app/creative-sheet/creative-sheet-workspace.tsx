'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeSheetItemListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
} from '@tas/ui';

import { KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import { moveCreativeSheetItemAction } from './actions';
import { CreativeSheetPanel, NEW_ITEM, type LinkOption } from './creative-sheet-panel';
import {
  countLabel,
  EM_DASH,
  internalStatusView,
  kanbanColumnsFor,
  kanbanView,
  matchesSearch,
  QA_CHECKS,
  SEARCH_PARAM,
  SELECTION_PARAM,
  statusView,
  winningView,
  type CreativeSheetKanbanField,
  type SheetStatusView,
} from './fields';

/**
 * The Creative Sheet grid, its Kanban board and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open row lives in the `?creative-sheet=` query
 * parameter, written with the History API so opening a row is instant and a refresh still reopens
 * it; the filter lives in `?q=` the same way.
 *
 * Two views, from `getTableCapability('creative-sheet')`: the Airtable-style grid and a Kanban
 * board grouped by Internal Status or Status. A card dropped in another column is one write through
 * `moveCreativeSheetItemAction`; in demo mode the board ignores the drop.
 */
export interface SheetItemView {
  readonly item: CreativeSheetItemListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CreativeSheetWorkspaceProps {
  readonly items: readonly SheetItemView[];
  readonly briefs: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  readonly initialKanbanField?: CreativeSheetKanbanField;
}

const CAP = getTableCapability('creative-sheet') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

function syncUrl(key: typeof SELECTION_PARAM | typeof SEARCH_PARAM, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** One checkbox as a grid glyph: a tick in the ok tone, or a hollow dot in the quietest text tone. */
export function Tick({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      data-slot="sheet-tick"
      data-checked={on ? 'true' : 'false'}
      role="img"
      aria-label={`${label}: ${on ? 'done' : 'not done'}`}
      title={label}
      className={on ? 'font-mono text-ok' : 'font-mono text-text4'}
    >
      {on ? '✓' : '○'}
    </span>
  );
}

/** The grid's QA cell: the three reviewer ticks in checklist order. */
export function QaTicks({ item }: { item: CreativeSheetItemListRow }) {
  return (
    <span className="inline-flex items-center gap-1.5" data-slot="sheet-qa">
      {QA_CHECKS.map((check) => (
        <Tick key={check.name} on={item[check.name]} label={check.label} />
      ))}
    </span>
  );
}

function chipOrDash(view: SheetStatusView | null) {
  return view === null ? (
    <span className="text-text4">{EM_DASH}</span>
  ) : (
    <StatusChip tone={view.tone} label={view.label} />
  );
}

/**
 * The Airtable-style grid columns: the frozen generated name in `font-mono`, the linked brief, the
 * three selects as `StatusChip`s, Used as one tick and QA as three.
 */
export const CREATIVE_SHEET_COLUMNS: readonly GridColumn<SheetItemView>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 260,
    sortValue: ({ item }) => item.name,
    render: ({ item }) => <span className="font-mono text-xs font-medium">{item.name}</span>,
  },
  {
    key: 'brief',
    header: 'Brief',
    sortValue: ({ item }) => item.briefName ?? '',
    cellTitle: ({ item }) => item.briefName ?? undefined,
    render: ({ item }) =>
      item.briefName === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="font-mono text-xs">{item.briefName}</span>
      ),
  },
  {
    key: 'internalStatus',
    header: 'Internal Status',
    sortValue: ({ item }) => internalStatusView(item.internalStatus)?.label ?? '',
    render: ({ item }) => chipOrDash(internalStatusView(item.internalStatus)),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: ({ item }) => statusView(item.status)?.label ?? '',
    render: ({ item }) => chipOrDash(statusView(item.status)),
  },
  {
    key: 'winning',
    header: 'Winning',
    sortValue: ({ item }) => winningView(item.winning)?.label ?? '',
    render: ({ item }) => chipOrDash(winningView(item.winning)),
  },
  {
    key: 'used',
    header: 'Used',
    align: 'center',
    sortValue: ({ item }) => (item.used ? 1 : 0),
    render: ({ item }) => <Tick on={item.used} label="Used" />,
  },
  {
    key: 'qa',
    header: 'QA',
    sortValue: ({ item }) => QA_CHECKS.filter((check) => item[check.name]).length,
    render: ({ item }) => <QaTicks item={item} />,
  },
];

export function CreativeSheetWorkspace({
  items,
  briefs,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  initialKanbanField = 'internalStatus',
}: CreativeSheetWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanField, setKanbanField] = useState<CreativeSheetKanbanField>(initialKanbanField);
  const [, startTransition] = useTransition();

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl(SELECTION_PARAM, id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(SEARCH_PARAM, next);
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
    () => (query === '' ? items : items.filter(({ item }) => matchesSearch(item, query))),
    [items, query],
  );

  const open = items.find(({ item }) => item.id === selection)?.item ?? null;
  const creating = selection === NEW_ITEM;

  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      visible.map(({ item }) => {
        const view = kanbanView(kanbanField, item);
        return {
          id: item.id,
          name: item.name,
          groupValue: view?.key ?? '',
          subtitle: item.briefName ?? 'No creative linked',
          chipLabel: view?.label,
          chipTone: view?.tone,
          accentTone: view?.tone,
        };
      }),
    [visible, kanbanField],
  );

  const kanbanColumns = useMemo(() => kanbanColumnsFor(kanbanField), [kanbanField]);
  const kanbanLabels = useMemo(
    () => Object.fromEntries(kanbanColumns.map((column) => [column.key, column.label])),
    [kanbanColumns],
  );

  const handleKanbanMove = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      startTransition(() => {
        const formData = new FormData();
        formData.set('id', itemId);
        formData.set('field', kanbanField);
        formData.set('value', newValue);
        void moveCreativeSheetItemAction(null, formData).then((result) => {
          if (result.ok) router.refresh();
        });
      });
    },
    [demo, kanbanField, router],
  );

  const openCard = useCallback(
    (card: KanbanItem) => {
      select(card.id);
    },
    [select],
  );

  const newRow = (slot: string) => (
    <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
      <Button
        size="sm"
        disabled={demo}
        className={demo ? disabledWriteClassName : undefined}
        onClick={() => {
          select(NEW_ITEM);
        }}
        data-slot={slot}
      >
        New sheet row
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Sheet</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Sheet</h1>
          {newRow('new-creative-sheet-item')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="creative-sheet-count">{countLabel(items.length, visible.length)}</span> —
          the month&apos;s client-facing sheet, one row per creative, named for you.
        </p>
      </header>

      <section aria-labelledby="creative-sheet-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="creative-sheet-heading" className="text-sm font-medium text-text2">
              Sheet
            </h2>
            <ViewSwitcher
              tableKey={CAP.tableKey}
              supportedViews={[...CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanField}
            />
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'kanban' ? (
              <select
                value={kanbanField}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === 'internalStatus' || next === 'status') setKanbanField(next);
                }}
                className="h-8 rounded-input border border-line bg-surface px-2 text-xs text-text"
                aria-label="Group by"
                data-slot="creative-sheet-group-by"
              >
                {CAP.kanbanFields.map((option) => (
                  <option key={option.field} value={option.field}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, brief or status"
              aria-label="Search the sheet by name, brief or status"
              data-slot="creative-sheet-search"
              className="h-8 w-full sm:w-64"
            />
          </div>
        </div>

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns.map((column) => column.key)}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            onCardClick={openCard}
            demo={demo}
          />
        ) : (
          <AirtableGrid
            tableKey={CAP.tableKey}
            columns={CREATIVE_SHEET_COLUMNS}
            rows={visible}
            rowId={({ item }) => item.id}
            rowLabel={({ item }) => item.name}
            rowAttributes={({ item }) => ({ 'data-creative-sheet-id': item.id })}
            selectedId={selection}
            onRowClick={({ item }) => {
              select(item.id);
            }}
            tableSlot="creative-sheet-table"
            rowSlot="creative-sheet-row"
            empty={
              <div
                data-slot="creative-sheet-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No sheet rows yet. Add the first creative of the month.'
                    : `Nothing matches “${term}”. Try a creative name or a status.`}
                </p>
                {items.length === 0 ? (
                  newRow('empty-new-creative-sheet-item')
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
        <CreativeSheetPanel
          key={selection}
          item={creating ? null : open}
          briefs={briefs}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
