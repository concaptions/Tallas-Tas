'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeSheetItemListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { creativeDimensionDisplay, normalizeCreativeDimensions } from '@tas/domain/creatives';
import { EDITOR_STAGE_KEYS } from '@tas/domain/state';
import { Button, Input, StatusChip } from '@tas/ui';

import { ColumnNotices, KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { CountCell, TextCell } from '@/components/views/grid-cells';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { moveBriefStageAction, startBriefAction } from '@/app/app/creative-design/actions';
import { briefPath } from '@/lib/routes';

import { moveCreativeSheetItemAction } from './actions';
import { CreativeSheetPanel } from './creative-sheet-panel';
import { editorBoardItems, offBoardLabel, type EditorBoardBrief } from './editor-board';
import { NewCreativeDialog, type ConceptOption } from './new-creative-dialog';
import {
  applyKanbanMoves,
  countLabel,
  EM_DASH,
  internalStatusView,
  isKanbanField,
  kanbanColumnsFor,
  kanbanGroupValue,
  kanbanView,
  matchesSearch,
  QA_CHECKS,
  SEARCH_PARAM,
  SELECTION_PARAM,
  statusView,
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
 *
 * The board's third grouping, "Editing stage", is the editor's board re-homed from the retired
 * Creative Design list (2026-10-09): its cards are BRIEFS (`editor-board.ts`), grouped by
 * `creative_briefs.internal_status`, a drop writes through `moveBriefStageAction`, Start through
 * `startBriefAction`, and a click opens the brief's own page. The two sheet groupings are untouched
 * by it: they never read a brief's status and it never reads a sheet row's.
 */
/**
 * The thirteen `Creative Name` lookup cells (GRATSI-MATCH, 2026-10-04), each resolved on the
 * server by `build-items.ts` through the sheet row's brief link with `lookupRollup` — never
 * stored, never editable, and null (or empty, for the attachments) wherever the link points at
 * nothing, which the grid renders as the muted em dash.
 */
export interface SheetLookups {
  readonly performance: string | null;
  readonly internalProduct: string | null;
  readonly angle: string | null;
  readonly conceptsFromAngle: string | null;
  readonly elementsWeAreTesting: string | null;
  readonly designFiles: readonly string[];
  readonly designLinkUrl: string | null;
  readonly collection: string | null;
  readonly platform: string | null;
  readonly funnel: string | null;
  readonly type: string | null;
  readonly proposedCopy: string | null;
  readonly creativeModule: string | null;
}

export interface SheetItemView {
  readonly item: CreativeSheetItemListRow;
  readonly lookups: SheetLookups;
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
  },
  internal_status: {
    render: ({ item }) => chipOrDash(internalStatusView(item.internalStatus)),
    sortValue: ({ item }) => internalStatusView(item.internalStatus)?.label ?? '',
  },
  qa_checklist_doc: {
    render: ({ item }) => <CountCell count={item.qaChecklistDoc?.length ?? 0} noun="file" />,
    sortValue: ({ item }) => item.qaChecklistDoc?.length ?? 0,
  },
  qa_video_editor: {
    render: ({ item }) => <Tick on={item.qaVideoEditor} label="Video Editor QA" />,
    sortValue: ({ item }) => (item.qaVideoEditor ? 1 : 0),
    align: 'center',
  },
  qa_designer: {
    render: ({ item }) => <Tick on={item.qaDesigner} label="Graphic Designer QA" />,
    sortValue: ({ item }) => (item.qaDesigner ? 1 : 0),
    align: 'center',
  },
  qa_strategist: {
    render: ({ item }) => <Tick on={item.qaStrategist} label="Creative Strategist QA" />,
    sortValue: ({ item }) => (item.qaStrategist ? 1 : 0),
    align: 'center',
  },
  spell_check_requested: {
    render: ({ item }) => (
      <Tick on={item.spellCheckRequested} label="Click for AI Spell Checker Again" />
    ),
    sortValue: ({ item }) => (item.spellCheckRequested ? 1 : 0),
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
  elements_we_are_testing: {
    render: ({ lookups }) => <TextCell value={lookups.elementsWeAreTesting} maxWidth={240} />,
    sortValue: ({ lookups }) => lookups.elementsWeAreTesting,
  },
  design_file: {
    render: ({ lookups }) => <CountCell count={lookups.designFiles.length} noun="file" />,
    sortValue: ({ lookups }) => lookups.designFiles.length,
  },
  design_link_url: {
    render: ({ lookups }) => <TextCell value={lookups.designLinkUrl} maxWidth={240} />,
    sortValue: ({ lookups }) => lookups.designLinkUrl,
  },
  collection: {
    render: ({ lookups }) => <TextCell value={lookups.collection} maxWidth={200} />,
    sortValue: ({ lookups }) => lookups.collection,
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
    render: ({ lookups }) => <TextCell value={lookups.type} maxWidth={120} />,
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
  initialView = 'grid',
  initialKanbanField = 'internalStatus',
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
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanField, setKanbanField] = useState<CreativeSheetKanbanField>(initialKanbanField);
  const [, startTransition] = useTransition();
  /**
   * Drops the server has not confirmed yet, card id → column (SMOKE-10). Applied to the cards
   * below so a drop moves the card at once; cleared when fresh rows arrive from the refresh the
   * save triggers, and on a refused save, which puts the card back where the server says it is.
   */
  const [moves, setMoves] = useState<Readonly<Record<string, string>>>({});
  /**
   * The creative "New creative" just made, shown as a pending row until the refresh brings the
   * real one (SMOKE-14): the save and the refresh of a 400-row sheet take seconds in production,
   * and the dialog closing with nothing on screen read as a hang. Cleared when the rows arrive.
   */
  const [pending, setPending] = useState<{ readonly id: string; readonly name: string } | null>(
    null,
  );
  useEffect(() => {
    setPending((current) =>
      current !== null && items.some(({ item }) => item.id === current.id) ? null : current,
    );
  }, [items]);
  const withoutMove = (current: Readonly<Record<string, string>>, id: string) =>
    Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));
  useEffect(() => {
    setMoves({});
  }, [items, boardBriefs]);

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

  const editorBoard = kanbanField === 'editorStage';

  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      kanbanField === 'editorStage'
        ? []
        : visible.map(({ item }) => {
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
    [visible, kanbanField],
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
      // The card moves NOW; the write and the refresh follow in the background (SMOKE-10).
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
  const onCreated = useCallback(
    (created: { readonly id: string; readonly name: string }) => {
      setPending(created);
      select(created.id);
    },
    [select],
  );
  const newCreative = (
    <NewCreativeDialog
      demo={demo}
      conceptOptions={conceptOptions}
      nextNumber={nextNumber}
      onCreated={onCreated}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Sheet</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Sheet</h1>
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
            <ColumnNotices
              slotPrefix="sheet"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="CREATIVE_SHEET_RENDERERS in creative-sheet-workspace.tsx"
            />
            {activeView === 'kanban' ? (
              <select
                value={kanbanField}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isKanbanField(next)) setKanbanField(next);
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
          {activeView === 'kanban' ? (
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
              {editorBoard && moveError !== null ? (
                <p className="text-sm text-bad" role="alert" data-slot="brief-move-error">
                  {moveError}
                </p>
              ) : null}
            </div>
          ) : (
            <AirtableGrid
              tableKey={CAP.tableKey}
              columns={grid.columns}
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
                    newCreative
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
        </Suspense>
      </section>

      {open !== null ? (
        <CreativeSheetPanel
          key={selection}
          item={open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
