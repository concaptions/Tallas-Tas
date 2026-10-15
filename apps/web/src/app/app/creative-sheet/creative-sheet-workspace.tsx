'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeSheetItemListRow } from '@tas/db';
import { getTableCapability, type UserViewConfig, type ViewType } from '@tas/domain';
import { creativeDimensionDisplay, normalizeCreativeDimensions } from '@tas/domain/creatives';
import { EDITOR_STAGE_KEYS } from '@tas/domain/state';
import { Button, DEMO_WRITE_HINT, formatSheetDate, Input, StatusChip } from '@tas/ui';
import { Captions, Copy, Link, RefreshCw, Trash } from '@tas/ui/icons';

import {
  ColumnNotices,
  duplicateShortcut,
  GroupByControl,
  GroupSortableContext,
  KanbanBoard,
  RowContextMenu,
  SelectionBar,
  SelectionDeleteConfirm,
  SelectionStatusPicker,
  SortableGroupHeader,
  useGroupOrder,
  useGroupOrderIo,
  useTableView,
  ViewToolbar,
  type ContextMenuItem,
  type KanbanItem,
  type SelectionAction,
  type SelectionStatusTrack,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  applyFilters,
  groupableFields,
  groupRows,
  pruneSelection,
  toggleAllSelected,
  toggleSelected,
} from '@/components/views/airtable-grid-logic';
import {
  booleanGroupLabel,
  CountCell,
  statusGroupHeader,
  TextCell,
} from '@/components/views/grid-cells';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { moveBriefStageAction, startBriefAction } from '@/app/app/creative-design/actions';
import { briefPath, creativeSheetPath } from '@/lib/routes';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { saveViewPreferenceAction } from '@/lib/view-preference-actions';

import { moveCreativeSheetItemAction } from './actions';
import { CreativeSheetPanel } from './creative-sheet-panel';
import { editorBoardItems, offBoardLabel, type EditorBoardBrief } from './editor-board';
import {
  type PendingCreative,
  pendingOnSubmit,
  pendingAfterRows,
  pendingSheetRow,
  rowsWithPendingCreative,
  applyKanbanMoves,
  countLabel,
  EM_DASH,
  GROUP_PARAM,
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  isKanbanField,
  kanbanColumnsFor,
  kanbanGroupValue,
  kanbanView,
  matchesSearch,
  QA_CHECKS,
  SEARCH_PARAM,
  SELECTION_PARAM,
  STATUS_OPTIONS,
  statusView,
  type CreativeSheetKanbanField,
  type SheetStatusView,
} from './fields';
import { FocusModeView } from './focus-mode-view';
import { NewCreativeDialog, type ConceptOption } from './new-creative-dialog';
import {
  bulkMoveCreativesAction,
  deleteCreativesAction,
  duplicateCreativesAction,
} from './review-actions';

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
 *
 * Ticket 7: the grid is the viewer's saved view like every other table's (`useTableView` +
 * `ViewToolbar`, Sprint 7 / VIEWS-01) — fields, order, freeze, sort, conditions and the Group
 * popover all persist into `user_table_views`, so hidden columns no longer live in the browser's
 * own store. The board's field is the same `GroupByControl` without a "None" row; it is a per-brand
 * setting rather than a lens, so it keeps its own store (`user_view_preferences
 * .kanban_group_by_field`, Sprint 5) and the URL (`?groupBy=`) instead of the view's `groupBy`.
 *
 * The board's third grouping, "Editing stage", is the editor's board re-homed from the retired
 * Creative Design list (2026-10-09): its cards are BRIEFS (`editor-board.ts`), grouped by
 * `creative_briefs.internal_status`, a drop writes through `moveBriefStageAction`, Start through
 * `startBriefAction`, and a click opens the brief's own page. The two sheet groupings are untouched
 * by it: they never read a brief's status and it never reads a sheet row's.
 *
 * Oct 12 client sync: a THIRD view, Focus Mode (`focus-mode-view.tsx`, one creative at a time);
 * the row panel is a shadcn Sheet (`creative-sheet-panel.tsx`); and the grid is multi-selectable —
 * a checkbox column, a right-click menu on every row and a floating action bar over the selection
 * (Duplicate, Change status, Delete), all writing through `review-actions.ts`.
 */
/**
 * The thirteen `Creative Name` lookup cells (GRATSI-MATCH, 2026-10-04), each resolved on the
 * server by `build-items.ts` through the sheet row's brief link with `lookupRollup` — never
 * stored, never editable, and null (or empty, for the attachments) wherever the link points at
 * nothing, which the grid renders as the muted em dash.
 */
export interface SheetLookups {
  /** The brief's own concept name; null is the §8 standalone (Oct 12 sidebar and Focus Mode). */
  readonly concept: string | null;
  readonly performance: string | null;
  readonly internalProduct: string | null;
  readonly angle: string | null;
  readonly conceptsFromAngle: string | null;
  readonly designFiles: readonly string[];
  readonly designLinkUrl: string | null;
  readonly platform: string | null;
  readonly funnel: string | null;
  readonly type: string | null;
  readonly proposedCopy: string | null;
  readonly creativeModule: string | null;
}

/** One comment on the creative, as Focus Mode's Feedback panel lists it. */
export interface SheetComment {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  /** Absolute and relative wording, computed on the server with the page's one clock. */
  readonly at: string;
  readonly ago: string;
}

export interface SheetItemView {
  readonly item: CreativeSheetItemListRow;
  readonly lookups: SheetLookups;
  /** The creative's comments, oldest first (Oct 12 Focus Mode). */
  readonly comments: readonly SheetComment[];
  /** `created_at` / `updated_at` as Airtable's `Created` / `Last Modified` display columns. */
  readonly createdLabel: string;
  readonly createdTitle: string;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CreativeSheetWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCreativeSheetColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly SheetItemView[];
  /** Every brief of the brand, the "Editing stage" board's cards; `[]` keeps that board empty. */
  readonly boardBriefs?: readonly EditorBoardBrief[];
  /** The "New creative" dialog's Concept select; standalone is always offered. */
  readonly conceptOptions?: readonly ConceptOption[];
  /** The number the "New creative" preview shows; the server allocates the real one. */
  readonly nextNumber?: number;
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  /** A `?view=` the page was opened with: applied once, over the saved view's own type. */
  readonly initialView?: ViewType | null;
  /**
   * The view the sheet opens on with no `?view=` and no active saved view — the viewer's stored
   * preference (`loadViewPreference`), the grid by default.
   */
  readonly defaultView?: ViewType;
  readonly initialKanbanField?: CreativeSheetKanbanField;
  /** The viewer's saved views (`loadUserViews`); absent in a story or a test, the browser keeps them. */
  readonly userViews?: UserViewsResult;
}

const CAP = getTableCapability('creative-sheet') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/** The board's three fields, in the capability's order, as the Group control lists them. */
const KANBAN_OPTIONS = CAP.kanbanFields.map(({ field, label }) => ({ key: field, label }));

/** No saved views: a story or a test mount, where `useTableView` keeps the state in the browser. */
const NO_USER_VIEWS: UserViewsResult = { userId: null, views: [] };

/** The bulk Change-status picker's two tracks; "Client Approval" per Oct 11 item 5b. */
const STATUS_TRACKS: readonly SelectionStatusTrack[] = [
  { key: 'internalStatus', label: 'Internal Status', options: INTERNAL_STATUS_OPTIONS },
  { key: 'status', label: 'Client Approval', options: STATUS_OPTIONS },
];

const DELETE_DETAIL = 'They leave the sheet, the queues and the portal; nothing is erased.';

function syncUrl(
  key: typeof SELECTION_PARAM | typeof SEARCH_PARAM | typeof GROUP_PARAM,
  value: string | null,
): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  // The retired Creative Design redirect arrives as `?group=`; a pick consumes the alias so the
  // shared URL names one board, not two.
  if (key === GROUP_PARAM) url.searchParams.delete('group');
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

/**
 * Ticket 6 due-date tone (Oct 14). The ISO comparison runs over calendar-day boundaries (UTC) so
 * a timezone shift does not flip a date from "today" into "yesterday"; `now` is a parameter so
 * the grid, the sidebar and the story can run against a fixed clock in tests.
 */
export function dueDateTone(due: Date, now: Date): string {
  const DAY_MS = 86_400_000;
  const today = Math.floor(now.getTime() / DAY_MS);
  const dueDay = Math.floor(due.getTime() / DAY_MS);
  const diff = dueDay - today;
  if (diff < 0) return 'text-bad';
  if (diff <= 3) return 'text-warn';
  return 'text-text';
}

function chipOrDash(view: SheetStatusView | null) {
  return view === null ? (
    <span className="font-mono text-xs text-text4">{EM_DASH}</span>
  ) : (
    <StatusChip tone={view.tone} label={view.label} />
  );
}

/**
 * THE Creative Sheet renderer registry, keyed by the resolver's `column_key`.
 *
 * `name` is a VIRTUAL column — `creative_sheet_items` has no `name` column at all, because
 * Airtable's field 1 is a formula and storing the result would let the month drift from
 * `created_at`. The value arrives on the row already computed by `creativeSheetName`, and it renders
 * in `font-mono` as generated output does. Gratsi words the column `Name` where the parent calls it
 * `Name + Angle + Offer`; the formula survives that relabel because the resolver reads it from the
 * parent row.
 *
 * THE THREE QA CHECKS ARE THREE COLUMNS, not one. The grid used to draw a single `QA` header over
 * all three booleans, which left the resolver returning three columns where the page drew one cell —
 * so an admin hiding "QA" in Column Admin would have been hiding something other than what they
 * saw. Airtable has three separate fields, and mirroring Airtable is the rule, so each gets its own
 * tick. `QaTicks` is still exported for the panel, which groups them on purpose.
 */
export const CREATIVE_SHEET_RENDERERS: ColumnRegistry<SheetItemView> = {
  name: {
    render: ({ item }) => <span className="font-mono text-xs font-medium">{item.name}</span>,
    sortValue: ({ item }) => item.name,
  },
  brief_id: {
    render: ({ item }) =>
      item.briefName === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="font-mono text-xs">{item.briefName}</span>
      ),
    sortValue: ({ item }) => item.briefName ?? '',
    cellTitle: ({ item }) => item.briefName ?? undefined,
  },
  status: {
    render: ({ item }) => chipOrDash(statusView(item.status)),
    sortValue: ({ item }) => statusView(item.status)?.label ?? '',
    groupHeader: statusGroupHeader,
  },
  internal_status: {
    render: ({ item }) => chipOrDash(internalStatusView(item.internalStatus)),
    sortValue: ({ item }) => internalStatusView(item.internalStatus)?.label ?? '',
    groupHeader: statusGroupHeader,
  },
  qa_checklist_doc: {
    render: ({ item }) => <CountCell count={item.qaChecklistDoc?.length ?? 0} noun="file" />,
    sortValue: ({ item }) => item.qaChecklistDoc?.length ?? 0,
  },
  qa_video_editor: {
    render: ({ item }) => <Tick on={item.qaVideoEditor} label="Video Editor QA" />,
    sortValue: ({ item }) => (item.qaVideoEditor ? 1 : 0),
    groupLabel: booleanGroupLabel,
    align: 'center',
  },
  qa_designer: {
    render: ({ item }) => <Tick on={item.qaDesigner} label="Graphic Designer QA" />,
    sortValue: ({ item }) => (item.qaDesigner ? 1 : 0),
    groupLabel: booleanGroupLabel,
    align: 'center',
  },
  qa_strategist: {
    render: ({ item }) => <Tick on={item.qaStrategist} label="Creative Strategist QA" />,
    sortValue: ({ item }) => (item.qaStrategist ? 1 : 0),
    groupLabel: booleanGroupLabel,
    align: 'center',
  },
  spell_check_requested: {
    render: ({ item }) => (
      <Tick on={item.spellCheckRequested} label="Click for AI Spell Checker Again" />
    ),
    sortValue: ({ item }) => (item.spellCheckRequested ? 1 : 0),
    groupLabel: booleanGroupLabel,
    align: 'center',
  },
  spelling_feedback: {
    render: ({ item }) => <TextCell value={item.spellingFeedback} maxWidth={280} />,
    cellTitle: ({ item }) => item.spellingFeedback ?? undefined,
  },
  /*
   * The ratios the creative ships in (migration 0059): the sheet row's own stored array, §8 keys
   * and legacy placement names alike, drawn as plain text through the domain's display rule so a
   * mapped Airtable name reads as its ratio and an unknown one as itself. Replaces the Creative
   * Dimensions workspace.
   */
  dimensions: {
    render: ({ item }) => (
      <TextCell
        value={
          item.dimensions.length === 0
            ? null
            : normalizeCreativeDimensions(item.dimensions).map(creativeDimensionDisplay).join(', ')
        }
        maxWidth={200}
      />
    ),
    sortValue: ({ item }) => normalizeCreativeDimensions(item.dimensions).join(', '),
  },
  /*
   * The thirteen Creative Name lookups (GRATSI-MATCH, 2026-10-04): read-only echoes of the linked
   * brief, resolved by `build-items.ts` and seeded as `lookupRollup` virtual columns — Gratsi's
   * base has every one alive; the template's twelve copies are dead and resolve for no inheriting
   * brand (docs/decisions/overnight-dead-lookups.md). `Proposed Copy` is the linked Meta copies'
   * generated titles, so it keeps the mono face (CLAUDE.md non-negotiable 6), as does the
   * attachment count cell's noun pattern from `qa_checklist_doc`.
   */
  performance: {
    render: ({ lookups }) => <TextCell value={lookups.performance} maxWidth={200} />,
    sortValue: ({ lookups }) => lookups.performance,
  },
  internal_product: {
    render: ({ lookups }) => <TextCell value={lookups.internalProduct} maxWidth={200} />,
    sortValue: ({ lookups }) => lookups.internalProduct,
  },
  angle: {
    render: ({ lookups }) => <TextCell value={lookups.angle} maxWidth={220} />,
    sortValue: ({ lookups }) => lookups.angle,
  },
  concepts_from_angle: {
    render: ({ lookups }) => <TextCell value={lookups.conceptsFromAngle} maxWidth={240} />,
    sortValue: ({ lookups }) => lookups.conceptsFromAngle,
  },
  design_file: {
    render: ({ lookups }) => <CountCell count={lookups.designFiles.length} noun="file" />,
    sortValue: ({ lookups }) => lookups.designFiles.length,
  },
  design_link_url: {
    render: ({ lookups }) => <TextCell value={lookups.designLinkUrl} maxWidth={240} />,
    sortValue: ({ lookups }) => lookups.designLinkUrl,
  },
  platform: {
    render: ({ lookups }) => <TextCell value={lookups.platform} maxWidth={180} />,
    sortValue: ({ lookups }) => lookups.platform,
  },
  funnel: {
    render: ({ lookups }) => <TextCell value={lookups.funnel} maxWidth={120} />,
    sortValue: ({ lookups }) => lookups.funnel,
  },
  type: {
    render: ({ lookups }) =>
      lookups.type === null ? (
        <span className="font-mono text-xs text-text4">{EM_DASH}</span>
      ) : (
        <StatusChip tone="mute" label={lookups.type} />
      ),
    sortValue: ({ lookups }) => lookups.type,
  },
  proposed_copy: {
    render: ({ lookups }) =>
      lookups.proposedCopy === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="font-mono text-xs">{lookups.proposedCopy}</span>
      ),
    sortValue: ({ lookups }) => lookups.proposedCopy,
  },
  creative_module: {
    render: ({ lookups }) => <TextCell value={lookups.creativeModule} maxWidth={200} />,
    sortValue: ({ lookups }) => lookups.creativeModule,
  },
  /*
   * Ticket 6 due_date (Oct 14, migration 0069 column on `creative_briefs`; AI-49 platform seed):
   * the strategist's cut deadline. Hidden by default — the parent template's platform row carries
   * `is_visible = false`, so a brand needs its own visible row to see the column (Gratsi has one).
   * The tone comes from an ISO day-diff against `new Date()` the renderer is called under: an
   * overdue date reads `text-bad`, due within three calendar days reads `text-warn`, otherwise
   * the default `text-text`. An unset date reads the em dash.
   */
  due_date: {
    render: ({ item }) => {
      const date = item.detail.dueDate;
      if (date === null) {
        return <span className="font-mono text-xs text-text4">{EM_DASH}</span>;
      }
      const tone = dueDateTone(date, new Date());
      return (
        <span className={`whitespace-nowrap text-xs ${tone}`} title={date.toISOString()}>
          {formatSheetDate(date)}
        </span>
      );
    },
    sortValue: ({ item }) =>
      item.detail.dueDate === null ? Number.POSITIVE_INFINITY : item.detail.dueDate.getTime(),
  },
  /* Airtable's `Created` / `Last Modified` system fields: the shared audit timestamps, displayed. */
  created_at: {
    render: (view) => (
      <span className="text-xs whitespace-nowrap text-text3" title={view.createdTitle}>
        {view.createdLabel}
      </span>
    ),
    sortValue: ({ item }) => item.createdAt.getTime(),
  },
  updated_at: {
    render: (view) => (
      <span className="text-xs whitespace-nowrap text-text3" title={view.updatedTitle}>
        {view.updatedLabel}
      </span>
    ),
    sortValue: ({ item }) => item.updatedAt.getTime(),
  },
};

export function CreativeSheetWorkspace({
  items,
  boardBriefs = [],
  conceptOptions = [],
  nextNumber = 1,
  demo,
  initialSelection,
  initialSearch,
  initialView = null,
  defaultView = 'grid',
  initialKanbanField = 'internalStatus',
  userViews = NO_USER_VIEWS,
  columns,
  unconfiguredColumns = false,
}: CreativeSheetWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, CREATIVE_SHEET_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 260,
      }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, its label, and the ones the grid can bucket. */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );
  const groupFields = useMemo(() => groupableFields(grid.columns), [grid]);
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [kanbanField, setKanbanField] = useState<CreativeSheetKanbanField>(initialKanbanField);
  const [, startTransition] = useTransition();
  const [busy, startBulk] = useTransition();

  // Multi-select (Oct 12 scope 3): the set the grid reports into, the row a right-click opened a
  // menu on, the bar's inline Change-status picker, the Delete confirmation, and the last outcome.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<{
    readonly view: SheetItemView;
    readonly position: { readonly x: number; readonly y: number };
  } | null>(null);
  const [statusPicker, setStatusPicker] = useState<{
    field: 'internalStatus' | 'status';
    value: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  /**
   * Drops the server has not confirmed yet, card id → column (SMOKE-10). Applied to the cards
   * below so a drop moves the card at once; cleared when fresh rows arrive from the refresh the
   * save triggers, and on a refused save, which puts the card back where the server says it is.
   */
  const [moves, setMoves] = useState<Readonly<Record<string, string>>>({});
  const withoutMove = (current: Readonly<Record<string, string>>, id: string) =>
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));
  useEffect(() => {
    // Only a real reset re-renders: `boardBriefs` defaults to a fresh `[]` per render, and a new
    // `{}` on every pass would loop the effect (a client render; the server never runs it).
    setMoves((current) => (Object.keys(current).length === 0 ? current : {}));
  }, [items, boardBriefs]);
  /**
   * The creative "New creative" just made, shown as a pending row until the refresh brings the
   * real one (SMOKE-14): the save and the refresh of a 400-row sheet take seconds in production,
   * and the dialog closing with nothing on screen read as a hang. Cleared when the rows arrive.
   */
  const [pending, setPending] = useState<PendingCreative | null>(null);
  useEffect(() => {
    setPending((current) =>
      pendingAfterRows(
        current,
        items.map(({ item }) => item.id),
      ),
    );
  }, [items]);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl(SELECTION_PARAM, id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(SEARCH_PARAM, next);
  }, []);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: CAP.tableKey,
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: defaultView,
    initialViewType: initialView,
    fieldKeys,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const setActiveView = tableView.setViewType;
  const setViewFilter = tableView.setFilter;
  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      setViewFilter(next);
    },
    [filter, setViewFilter],
  );

  /**
   * The board's field: state, the URL (`?groupBy=`, so the link shares it) and the viewer's
   * per-brand preference — the Sprint 5 store the view switcher already writes on a tab change —
   * so a reload lands on the same board. Demo mode's action answers ok without writing; the URL
   * and the browser's view store carry the choice there.
   */
  const changeKanbanField = useCallback((next: CreativeSheetKanbanField) => {
    setKanbanField(next);
    syncUrl(GROUP_PARAM, next);
    startTransition(() => {
      void saveViewPreferenceAction({
        tableKey: CAP.tableKey,
        viewType: 'kanban',
        kanbanGroupByField: next,
      });
    });
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
  /**
   * The view's field conditions applied once, here, so the grid, the board and Focus Mode all
   * read the SAME narrowed row set (AI-32): `visible` already passed the search, the grid sorts
   * afterwards. With no conditions this is the same array back.
   */
  const viewFilters = tableView.config.filters;
  const filtered = useMemo(
    () => applyFilters(visible, viewFilters, grid.columns),
    [visible, viewFilters, grid],
  );
  // The pending creative as a row of the grid (SMOKE-24), first until the refresh carries it.
  const pendingRow = useMemo(
    () => (pending === null ? null : pendingSheetRow(pending, new Date())),
    [pending],
  );
  const rows = rowsWithPendingCreative(pendingRow, filtered);

  /**
   * Phase B5 commit 3 — per-user group ordering, wired for the Creative Sheet grid. The DAO scope
   * is `creative_briefs` (the live table; `creative_sheet_items` is frozen) by the active column key
   * and the viewer's active user view id. `useGroupOrder` resolves the final display order through
   * the view-specific → user-global → status-enum / alpha fallback chain; the hook has nothing to
   * do when `groupBy === null` because `naturalOrder` is empty and the context never mounts a header.
   */
  const groupByField = tableView.config.groupBy;
  const groupViewId = tableView.activeView?.id ?? null;
  const naturalGroupOrder = useMemo<readonly string[]>(() => {
    if (groupByField === null) return [];
    const groups = groupRows(rows, groupByField, grid.columns);
    return groups === null ? [] : groups.map((entry) => entry.value);
  }, [grid, groupByField, rows]);
  const [groupOrderNotice, setGroupOrderNotice] = useState<string | null>(null);
  const groupOrderIo = useGroupOrderIo(
    { tableKey: 'creative_briefs', fieldKey: groupByField ?? '', viewId: groupViewId },
    { demo },
  );
  const groupOrderController = useGroupOrder({
    fieldKey: groupByField ?? '',
    naturalOrder: naturalGroupOrder,
    io: groupOrderIo,
    onError: setGroupOrderNotice,
  });

  const open = items.find(({ item }) => item.id === selection) ?? null;

  useEffect(() => {
    setSelected((current) =>
      pruneSelection(
        current,
        items.map(({ item }) => item.id),
      ),
    );
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setStatusPicker(null);
    setConfirmDelete(false);
    setBulkNotice(null);
  }, []);

  const focus = useCallback(
    (id: string) => {
      select(id);
      setActiveView('focus');
    },
    [select, setActiveView],
  );

  const finish = useCallback(
    (notice: string | null) => {
      setBulkNotice(notice);
      setStatusPicker(null);
      setConfirmDelete(false);
      router.refresh();
    },
    [router],
  );

  const duplicate = useCallback(
    (ids: readonly string[]) => {
      if (demo || ids.length === 0) return;
      setBulkNotice(null);
      startBulk(async () => {
        const result = await duplicateCreativesAction(ids);
        if (!result.ok) {
          setBulkNotice(result.error);
          return;
        }
        clearSelection();
        finish(
          `${String(result.created.length)} ${result.created.length === 1 ? 'copy' : 'copies'} created` +
            (result.created.length === 1 && result.created[0] !== undefined
              ? `: ${result.created[0].name}`
              : '.'),
        );
      });
    },
    [clearSelection, demo, finish],
  );

  const remove = useCallback(
    (ids: readonly string[]) => {
      if (demo || ids.length === 0) return;
      setBulkNotice(null);
      startBulk(async () => {
        const result = await deleteCreativesAction(ids);
        if (!result.ok) {
          setBulkNotice(result.error);
          return;
        }
        if (selection !== null && result.deleted.includes(selection)) select(null);
        clearSelection();
        finish(
          `${String(result.deleted.length)} ${result.deleted.length === 1 ? 'creative' : 'creatives'} deleted.`,
        );
      });
    },
    [clearSelection, demo, finish, select, selection],
  );

  const applyStatus = useCallback(() => {
    if (demo || statusPicker === null || statusPicker.value === '' || selected.size === 0) return;
    setBulkNotice(null);
    const ids = [...selected];
    startBulk(async () => {
      const result = await bulkMoveCreativesAction(ids, statusPicker.field, statusPicker.value);
      if (!result.ok) {
        setBulkNotice(result.error);
        return;
      }
      const refused =
        result.refused.length === 0
          ? ''
          : ` ${String(result.refused.length)} refused: ${result.refused
              .map((entry) => `${entry.name} — ${entry.reason}`)
              .join('; ')}`;
      finish(`${String(result.moved.length)} moved.${refused}`);
    });
  }, [demo, finish, selected, statusPicker]);

  // ⌘D / Ctrl+D duplicates THE MENU'S ROW while a context menu is up — the hint sits on that row,
  // ticked or not (B3.A20) — and the selection otherwise.
  useEffect(() => {
    if (selected.size === 0 && contextMenu === null) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, select') !== null) {
          return;
        }
        event.preventDefault();
        if (contextMenu !== null) {
          setContextMenu(null);
          duplicate([contextMenu.view.item.id]);
        } else {
          duplicate([...selected]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu, duplicate, selected]);

  const copyLink = useCallback((id: string) => {
    const url = `${window.location.origin}${creativeSheetPath}?${SELECTION_PARAM}=${encodeURIComponent(id)}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setBulkNotice('Link copied.');
      },
      () => {
        setBulkNotice(url);
      },
    );
  }, []);

  const contextItems = useMemo((): readonly ContextMenuItem[] => {
    if (contextMenu === null) return [];
    const id = contextMenu.view.item.id;
    // The menu only exists after a right-click, so `navigator` is always there when this runs.
    const shortcut = duplicateShortcut(navigator.userAgent);
    return [
      {
        label: 'Duplicate',
        shortcut,
        icon: <Copy className="size-4" strokeWidth={1.75} />,
        disabled: demo,
        slot: 'context-duplicate',
        onSelect: () => {
          duplicate([id]);
        },
      },
      {
        label: 'Open in Focus Mode',
        icon: <Captions className="size-4" strokeWidth={1.75} />,
        slot: 'context-focus',
        onSelect: () => {
          focus(id);
        },
      },
      {
        label: 'Copy link',
        icon: <Link className="size-4" strokeWidth={1.75} />,
        slot: 'context-copy-link',
        onSelect: () => {
          copyLink(id);
        },
      },
      {
        label: 'Delete',
        icon: <Trash className="size-4" strokeWidth={1.75} />,
        tone: 'bad',
        divider: true,
        disabled: demo,
        slot: 'context-delete',
        onSelect: () => {
          // Delete asks once, in the bar: the row becomes the selection and the bar confirms.
          setSelected(new Set([id]));
          setStatusPicker(null);
          setConfirmDelete(true);
        },
      },
    ];
  }, [contextMenu, copyLink, demo, duplicate, focus]);

  const selectionActions = useMemo((): readonly SelectionAction[] => {
    const count = selected.size;
    const hint = demo ? DEMO_WRITE_HINT : busy ? 'Saving…' : '';
    const disabled = demo || busy;
    return [
      {
        label: `Duplicate (${String(count)})`,
        icon: <Copy className="size-3.5" strokeWidth={1.75} />,
        disabled,
        hint,
        slot: 'selection-duplicate',
        onSelect: () => {
          duplicate([...selected]);
        },
      },
      {
        label: 'Change status',
        icon: <RefreshCw className="size-3.5" strokeWidth={1.75} />,
        disabled,
        hint,
        slot: 'selection-change-status',
        onSelect: () => {
          setConfirmDelete(false);
          setStatusPicker((current) =>
            current === null ? { field: 'internalStatus', value: '' } : null,
          );
        },
      },
      {
        label: `Delete (${String(count)})`,
        icon: <Trash className="size-3.5" strokeWidth={1.75} />,
        tone: 'bad',
        disabled,
        hint,
        slot: 'selection-delete',
        onSelect: () => {
          setStatusPicker(null);
          setConfirmDelete(true);
        },
      },
    ];
  }, [busy, demo, duplicate, selected]);

  const editorBoard = kanbanField === 'editorStage';

  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      kanbanField === 'editorStage'
        ? []
        : filtered.map(({ item }) => {
            const view = kanbanView(kanbanField, item);
            return {
              id: item.id,
              name: item.name,
              groupValue: kanbanGroupValue(kanbanField, view),
              subtitle: item.briefName ?? 'No creative linked',
              chipLabel: view?.label,
              chipTone: view?.tone,
              accentTone: view?.tone,
            };
          }),
    [filtered, kanbanField],
  );
  const shownKanbanItems = useMemo(
    () => applyKanbanMoves(kanbanItems, moves),
    [kanbanItems, moves],
  );

  // The editor board's two writes (Start, a drop) each report their refusal under the board.
  const [startError, setStartError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const startBrief = useCallback(
    (id: string) => {
      setStartError(null);
      startTransition(async () => {
        const result = await startBriefAction(id);
        if (result.ok) {
          router.refresh();
        } else {
          setStartError(result.error);
        }
      });
    },
    [router],
  );

  // Cards are briefs, every brief of the brand; the search narrows them by name like the grid.
  const board = useMemo(
    () =>
      editorBoardItems(
        query === ''
          ? boardBriefs
          : boardBriefs.filter((brief) => brief.name.toLowerCase().includes(query)),
        items.map(({ item }) => item),
        demo,
        startBrief,
      ),
    [boardBriefs, items, query, demo, startBrief],
  );

  const kanbanColumns = useMemo(() => kanbanColumnsFor(kanbanField), [kanbanField]);
  const kanbanLabels = useMemo(
    () => Object.fromEntries(kanbanColumns.map((column) => [column.key, column.label])),
    [kanbanColumns],
  );

  const handleKanbanMove = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      if (kanbanField === 'editorStage') {
        // A brief dropped in another stage: the status move, through the briefs' own action,
        // which validates the stage again — a Server Action is a POST endpoint.
        if (!(EDITOR_STAGE_KEYS as readonly string[]).includes(newValue)) return;
        setMoveError(null);
        setMoves((current) => ({ ...current, [itemId]: newValue }));
        startTransition(async () => {
          const result = await moveBriefStageAction(itemId, newValue);
          if (result.ok) {
            router.refresh();
          } else {
            setMoves((current) => withoutMove(current, itemId));
            setMoveError(result.error);
          }
        });
        return;
      }
      // The card moves NOW; the write and the refresh follow in the background (SMOKE-10). A
      // refusal — the server re-running the QA gate on a drop into Approved — snaps the card back
      // AND says why (B4.A11): a silent bounce read as a broken board.
      setMoveError(null);
      setMoves((current) => ({ ...current, [itemId]: newValue }));
      startTransition(() => {
        const formData = new FormData();
        formData.set('id', itemId);
        formData.set('field', kanbanField);
        formData.set('value', newValue);
        void moveCreativeSheetItemAction(null, formData).then((result) => {
          if (result.ok) {
            router.refresh();
          } else {
            setMoves((current) => withoutMove(current, itemId));
            setMoveError(result.error);
          }
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

  // A brief card opens the brief's own page: the detail route stays live after the list retired.
  const openBrief = useCallback(
    (card: KanbanItem) => {
      router.push(card.href ?? briefPath(card.id));
    },
    [router],
  );

  // "New creative" (2026-10-09, audit item 7): the ONE way a creative is added here. It creates
  // the brief — auto-named, numbered under the brand's lock — and, the sheet being a view over the
  // briefs, the creative is on the sheet at once. There is no sheet-only row to create any more.
  const onPending = useCallback((previewName: string) => {
    setPending(pendingOnSubmit(previewName));
  }, []);
  const onCreated = useCallback(
    (created: PendingCreative) => {
      setPending(created);
      select(created.id);
    },
    [select],
  );
  const onFailed = useCallback(() => {
    setPending(null);
  }, []);
  const newCreative = (
    <NewCreativeDialog
      demo={demo}
      conceptOptions={conceptOptions}
      nextNumber={nextNumber}
      onPending={onPending}
      onCreated={onCreated}
      onFailed={onFailed}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Sheet</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Sheet</h1>
            <span data-slot="creative-sheet-count">
              <StatusChip tone="mute" label={countLabel(items.length, filtered.length)} />
            </span>
          </div>
          {newCreative}
        </div>
        {pending === null ? null : (
          <p
            className="font-mono text-xs text-text2"
            role="status"
            data-slot="creative-sheet-pending"
            data-creative-id={pending.id}
          >
            Creating {pending.name}… it opens here the moment the sheet has it.
          </p>
        )}
        <p className="text-sm text-text2">
          The month&apos;s client-facing sheet, one row per creative, named for you.
        </p>
      </header>

      <section aria-labelledby="creative-sheet-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="creative-sheet-heading" className="text-sm font-medium text-text2">
              Sheet
            </h2>
            <ViewToolbar
              tableKey={CAP.tableKey}
              supportedViews={[...CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanField}
              views={tableView.views}
              activeViewId={tableView.activeView?.id ?? null}
              onActivateView={tableView.activateView}
              onCreateView={tableView.createView}
              onRenameView={tableView.renameView}
              onDeleteView={tableView.deleteView}
              fields={fieldOptions}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              onMoveField={tableView.moveField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              onFiltersChange={tableView.setFilters}
              onGroupChange={tableView.setGroupBy}
              groupFields={groupFields}
              error={tableView.error}
            />
          </div>
          <div className="flex items-center gap-2">
            <ColumnNotices
              slotPrefix="sheet"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="CREATIVE_SHEET_RENDERERS in creative-sheet-workspace.tsx"
            />
            {activeView === 'kanban' ? (
              <GroupByControl
                options={KANBAN_OPTIONS}
                value={kanbanField}
                allowNone={false}
                menuLabel="Board columns by"
                slot="creative-sheet-group-by"
                onChange={(next) => {
                  if (next !== null && isKanbanField(next)) changeKanbanField(next);
                }}
              />
            ) : null}
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                onSearch(event.target.value);
              }}
              placeholder="Search name, creative or status"
              aria-label="Search the sheet by name, creative or status"
              data-slot="creative-sheet-search"
              className="h-8 w-full sm:w-64"
            />
          </div>
        </div>

        {/*
          HYDRATION BOUNDARY (smoke test, 2026-10-10: "first click ignored" on New creative and
          the Kanban tab). React drops a click that lands before the root has hydrated, and this
          page hydrates every cell of every row — seconds on the production sheet. Nothing here
          suspends; the boundary exists so React hydrates the header and its controls FIRST and
          the grid or board at lower priority, which is the React 18 "selective hydration" rule.
          The server-rendered rows stay on screen throughout; a click inside them before their
          turn hydrates that boundary synchronously and is replayed. No fallback is ever shown.
        */}
        <Suspense fallback={null}>
          {activeView === 'focus' ? (
            <FocusModeView items={filtered} focusedId={selection} onFocus={select} demo={demo} />
          ) : activeView === 'kanban' ? (
            <div className="flex flex-col gap-2">
              <KanbanBoard
                items={applyKanbanMoves(editorBoard ? board.items : shownKanbanItems, moves)}
                columns={kanbanColumns.map((column) => column.key)}
                columnLabels={kanbanLabels}
                onMove={handleKanbanMove}
                onCardClick={editorBoard ? openBrief : openCard}
                demo={demo}
              />
              {editorBoard ? (
                <p className="text-xs text-text3" data-slot="brief-off-board">
                  {offBoardLabel(board.offBoardBriefs, board.unlinkedSheetRows)}
                </p>
              ) : null}
              {editorBoard && startError !== null ? (
                <p className="text-sm text-bad" role="alert" data-slot="brief-start-error">
                  {startError}
                </p>
              ) : null}
              {moveError !== null ? (
                <p className="text-xs text-bad" role="alert" data-slot="kanban-move-error">
                  {moveError}
                </p>
              ) : null}
            </div>
          ) : (
            <GroupSortableContext
              orderedValues={groupOrderController.orderedValues}
              onReorder={groupOrderController.reorder}
            >
              <AirtableGrid
                tableKey={CAP.tableKey}
                view={tableView.config}
                onSortChange={tableView.setSort}
                columns={grid.columns}
                rows={rows}
                rowId={({ item }) => item.id}
                rowLabel={({ item }) => item.name}
                rowAttributes={({ item }) => ({
                  'data-creative-sheet-id': item.id,
                  'data-creative-sheet-pending':
                    pendingRow !== null && item.id === pendingRow.item.id ? 'true' : undefined,
                })}
                selectedId={selection}
                onRowClick={({ item }) => {
                  select(item.id);
                }}
                selection={{
                  selected,
                  onToggle: (id) => {
                    setSelected((current) => toggleSelected(current, id));
                  },
                  onToggleAll: (visibleIds) => {
                    setSelected((current) => toggleAllSelected(current, visibleIds));
                  },
                }}
                onRowContextMenu={(view, position) => {
                  setContextMenu({ view, position });
                }}
                contextRowId={contextMenu?.view.item.id ?? null}
                tableSlot="creative-sheet-table"
                rowSlot="creative-sheet-row"
                groupOrder={groupByField === null ? undefined : groupOrderController.orderedValues}
                onGroupContextMenu={
                  groupByField === null ? undefined : groupOrderController.openContextMenu
                }
                renderGroupHeader={
                  groupByField === null
                    ? undefined
                    : ({ value, label, count }) => (
                        <SortableGroupHeader
                          value={value}
                          label={label}
                          count={count}
                          pinned={
                            groupOrderController.saved?.some(
                              (entry) => entry.value === value && entry.pinned,
                            ) ?? false
                          }
                        />
                      )
                }
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
                      newCreative
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onSearch('');
                        }}
                        data-slot="clear-search"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                }
              />
              {groupOrderController.menu}
              {groupOrderNotice === null ? null : (
                <p
                  className="text-xs text-bad"
                  role="alert"
                  data-slot="creative-sheet-group-order-error"
                >
                  {groupOrderNotice}
                </p>
              )}
            </GroupSortableContext>
          )}
        </Suspense>
      </section>

      {open !== null && activeView !== 'focus' ? (
        <CreativeSheetPanel
          key={selection}
          item={open.item}
          lookups={open.lookups}
          demo={demo}
          onClose={close}
          onSaved={saved}
          onFocusMode={focus}
        />
      ) : null}

      {contextMenu === null ? null : (
        <RowContextMenu
          position={contextMenu.position}
          items={contextItems}
          label={contextMenu.view.item.name}
          onClose={() => {
            setContextMenu(null);
          }}
        />
      )}

      <SelectionBar
        count={selected.size}
        noun="creative"
        actions={selectionActions}
        onClear={clearSelection}
        notice={
          confirmDelete ? (
            <SelectionDeleteConfirm
              count={selected.size}
              noun="creative"
              detail={DELETE_DETAIL}
              disabled={demo || busy}
              onConfirm={() => {
                remove([...selected]);
              }}
              onCancel={() => {
                setConfirmDelete(false);
              }}
            />
          ) : (
            bulkNotice
          )
        }
      >
        {statusPicker === null ? null : (
          <SelectionStatusPicker
            tracks={STATUS_TRACKS}
            track={statusPicker.field}
            value={statusPicker.value}
            disabled={demo || busy}
            onTrackChange={(track) => {
              setStatusPicker({
                field: track === 'status' ? 'status' : 'internalStatus',
                value: '',
              });
            }}
            onValueChange={(value) => {
              setStatusPicker({ field: statusPicker.field, value });
            }}
            onApply={applyStatus}
          />
        )}
      </SelectionBar>
    </div>
  );
}
