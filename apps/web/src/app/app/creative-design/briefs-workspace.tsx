'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
} from '@tas/ui';
import { getTableCapability, type ViewType } from '@tas/domain';
import {
  canStartBrief,
  canTransitionInternal,
  EDITOR_STAGES,
  editorStageOf,
  editorStageTone,
  internalStatusFor,
  startedStatusFor,
  type EditorStageKey,
  type InternalStatusKey,
} from '@tas/domain/state';
import { creativeTrack } from '@tas/domain/creatives';

import {
  ColumnNotices,
  ViewSwitcher,
  KanbanBoard,
  GalleryView,
  type KanbanItem,
  type GalleryItem,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { BoolCell, CountCell, DateCell, LinkCell, TextCell } from '@/components/views/grid-cells';
import { linkedRecordsRenderer } from '@/components/views/linked-records-cell';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ColumnRenderer,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { startBriefAction, updateBriefAction } from './actions';
import { BriefPanel } from './brief-panel';
import { BriefPipelineSummary } from './brief-pipeline';
import { buildBriefPipeline } from './pipeline';
import {
  EM_DASH,
  NEW_BRIEF_SOON_HINT,
  NO_BRIEFS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  STANDALONE_CONCEPT_SLUG,
  briefCountLabel,
  filteredBriefCountLabel,
  matchesQuery,
  type BriefItem,
} from './fields';

interface BriefsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from the shared resolver loader. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly BriefItem[];
  readonly demo: boolean;
  readonly initialSearch: string;
  readonly initialView: ViewType;
  readonly initialKanbanField: string | null;
}

/** How many attachments a jsonb attachment column holds; the cell shows the count, never a URL. */
function attachmentCount(files: readonly string[] | null): number {
  return files?.length ?? 0;
}

/**
 * The plain stored columns, each as the function that READS it off the row: a column whose cell is
 * one line of text needs nothing more, so the twenty are declared as reads, not written out twenty
 * times below.
 */
const BRIEF_TEXT_COLUMNS: Readonly<Record<string, (item: BriefItem) => string | null>> = {
  source: (item) => item.sourceLabel,
  funnel: (item) => item.funnelLabel,
  type: (item) => item.typeLabel,
  angle_id: (item) => item.angleName,
  product_id: (item) => item.productName,
  collection_id: (item) => item.collectionName,
  campaign_offer_id: (item) => item.campaignOfferName,
  asset_id: (item) => item.assetName,
  assignee: (item) => item.assignee,
  batch: (item) => item.row.batch,
  language: (item) => item.row.language,
  elements_tested: (item) => item.row.elementsTested,
  brief_to_design: (item) => item.row.briefToDesign,
  script_content: (item) => item.row.scriptContent,
  ad_content: (item) => item.row.adContent,
  offer: (item) => item.row.offer,
  spelling_feedback: (item) => item.row.spellingFeedback,
  spelling_feedback_2: (item) => item.row.spellingFeedback2,
  platform: (item) => (item.row.platform.length === 0 ? null : item.row.platform.join(', ')),
  dimensions: (item) => (item.row.dimensions.length === 0 ? null : item.row.dimensions.join(', ')),
};

/** The three QA ticks plus the spell-check trigger: checkbox columns, drawn as a tick or the dash. */
const BRIEF_BOOL_COLUMNS: Readonly<Record<string, (item: BriefItem) => boolean>> = {
  qa_video_editor: (item) => item.row.qaVideoEditor,
  qa_designer: (item) => item.row.qaDesigner,
  qa_strategist: (item) => item.row.qaStrategist,
  click_for_ai_spell_checker: (item) => item.row.clickForAiSpellChecker,
};

/** The attachment columns, counted. A file list in a grid cell is a count, never thirty URLs. */
const BRIEF_FILE_COLUMNS: Readonly<
  Record<string, { readonly read: (item: BriefItem) => number; readonly noun: string }>
> = {
  qa_checklist_doc: { read: (item) => attachmentCount(item.row.qaChecklistDoc), noun: 'doc' },
  design_file: { read: (item) => attachmentCount(item.row.designFile), noun: 'file' },
  inspiration_image: { read: (item) => attachmentCount(item.row.inspirationImage), noun: 'image' },
  script_and_brief_breakdown: {
    read: (item) => attachmentCount(item.row.scriptAndBriefBreakdown),
    noun: 'file',
  },
};

/** One entry of the registry, as a TUPLE, so `Object.fromEntries` keeps the renderer's type. */
type BriefRendererEntry = readonly [string, ColumnRenderer<BriefItem>];

function textRenderer(read: (item: BriefItem) => string | null): ColumnRenderer<BriefItem> {
  return {
    render: (item) => <TextCell value={read(item)} />,
    sortValue: read,
    cellTitle: (item) => read(item) ?? undefined,
  };
}

/**
 * THE Creative Design renderer registry, keyed by the resolver's `column_key` — a Postgres column of
 * `creative_briefs`, or the foreign key that carries a link. It replaces the six-string
 * `BRIEF_COLUMNS` tuple (AI-64a): no header text and no ordering here, only how a cell is drawn, and
 * every tone comes from `@tas/domain/state` through `internalStatusView`, `clientStatusView` and
 * `briefStageView`, so not one colour is chosen in this file.
 */
export const BRIEF_RENDERERS: ColumnRegistry<BriefItem> = {
  ...Object.fromEntries(
    Object.entries(BRIEF_TEXT_COLUMNS).map(([key, read]): BriefRendererEntry => [
      key,
      textRenderer(read),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(BRIEF_BOOL_COLUMNS).map(([key, read]): BriefRendererEntry => [
      key,
      {
        render: (item) => <BoolCell value={read(item)} />,
        sortValue: (item) => (read(item) ? 1 : 0),
        align: 'center',
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(BRIEF_FILE_COLUMNS).map(([key, { read, noun }]): BriefRendererEntry => [
      key,
      {
        render: (item) => <CountCell count={read(item)} noun={noun} />,
        sortValue: read,
      },
    ]),
  ),
  // The generated §7 name, in `font-mono` because it is system output, beside the EDITOR STAGE the
  // brief sits at (AI-49). The stage rides the primary cell rather than the `<tr>`, which the shared
  // grid owns, and a tone belongs in a `StatusChip`; the row also carries `data-stage`.
  name: {
    render: (item) => (
      <span className="flex items-center gap-2">
        {/*
          A REAL ANCHOR (AI-52), so a row can be cmd-clicked, middle-clicked or copied; the row's own
          click still navigates in the same tab. Both propagations stop here, so one activation is
          one navigation rather than the anchor and the row's handler both firing.
        */}
        <Link
          href={item.href}
          data-slot="brief-row-name"
          className="font-mono text-xs text-text hover:underline"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.stopPropagation();
          }}
        >
          {item.name}
        </Link>
        {item.stage === null ? null : (
          <StatusChip tone={item.stage.tone} label={item.stage.label} />
        )}
      </span>
    ),
    sortValue: (item) => item.name,
    cellTitle: (item) => item.name,
  },
  concept_id: {
    render: (item) =>
      item.conceptName ?? (
        <span data-slot="brief-standalone">
          <StatusChip tone="mute" label={STANDALONE_CONCEPT_SLUG} />
        </span>
      ),
    sortValue: (item) => item.conceptName,
    cellTitle: (item) => item.conceptName ?? STANDALONE_CONCEPT_SLUG,
    minWidth: 220,
  },
  priority: {
    render: (item) =>
      item.priority === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="flex items-center gap-1.5">
          <StatusChip tone={item.priority.tone} label={item.priority.label} />
          {item.priority.sla === null ? null : (
            <span className="font-mono text-[11px] text-text3">{item.priority.sla}</span>
          )}
        </span>
      ),
    sortValue: (item) => item.priority?.label ?? null,
  },
  performance: {
    render: (item) =>
      item.performance === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <StatusChip tone={item.performance.tone} label={item.performance.label} />
      ),
    sortValue: (item) => item.performance?.label ?? null,
  },
  internal_status: {
    render: (item) => <StatusChip tone={item.status.tone} label={item.status.label} />,
    sortValue: (item) => item.status.label,
  },
  client_status: {
    render: (item) => <StatusChip tone={item.clientStatus.tone} label={item.clientStatus.label} />,
    sortValue: (item) => item.clientStatus.label,
  },
  design_file_url: {
    render: (item) => <LinkCell value={item.row.designFileUrl} />,
    sortValue: (item) => item.row.designFileUrl,
  },
  // AI-49. `creative_briefs.due_date` (migration 0043) has rendered on the detail page since; this
  // is the grid's reading of it, through the one shared date cell.
  due_date: {
    render: (item) => <DateCell value={item.row.dueDate} />,
    sortValue: (item) => item.row.dueDate?.toISOString() ?? null,
  },
  // ── GRATSI-MATCH 2026-10-04: the live base's remaining fields, all read-only ──────────────────
  // Reverse links. The two counts read the same `linkCounts` the panel's one-line read uses; the
  // copy column carries the linked rows' generated titles through the shared linked-records cell.
  creative_module_designs: {
    render: (item) => <CountCell count={item.linkCounts.modules} noun="module" />,
    sortValue: (item) => item.linkCounts.modules,
  },
  creative_sheet_items: {
    render: (item) => <CountCell count={item.linkCounts.sheetItems} noun="sheet row" />,
    sortValue: (item) => item.linkCounts.sheetItems,
  },
  copywriting: linkedRecordsRenderer((item: BriefItem) => item.metaCopy, { mono: true }),
  // Airtable's `Last Modified` / `Created` system fields are the shared columns, displayed.
  updated_at: {
    render: (item) => <DateCell value={item.row.updatedAt} />,
    sortValue: (item) => item.row.updatedAt.toISOString(),
  },
  created_at: {
    render: (item) => <DateCell value={item.row.createdAt} />,
    sortValue: (item) => item.row.createdAt.toISOString(),
  },
  // The `Concepts (from Angles)` lookup, VIRTUAL — the server computed the finished string with
  // `briefConceptsFromAngles`; generated concept names render in the mono face.
  concepts_from_angles: {
    render: (item) => <TextCell value={item.conceptsFromAngles} mono />,
    sortValue: (item) => item.conceptsFromAngles,
    cellTitle: (item) => item.conceptsFromAngles ?? undefined,
  },
};

function syncUrl(search: string): void {
  const url = new URL(window.location.href);
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * The ROUTE's view key — `briefs`, not the `creative_briefs` that `column_definitions` uses. The
 * saved view, the switcher and the grid's remembered hidden columns are keyed by the route, the
 * column configuration by the table; `loadBriefColumns` owns that other string.
 */
const TABLE_KEY = 'briefs';

const BRIEFS_CAP = getTableCapability(TABLE_KEY) as NonNullable<
  ReturnType<typeof getTableCapability>
>;

export function BriefsWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  demo,
  initialSearch,
  initialView,
  initialKanbanField,
}: BriefsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, BRIEF_RENDERERS, { freezeFirst: true, frozenMinWidth: 260 }),
    [columns],
  );
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanField, setKanbanField] = useState<string>(
    initialKanbanField ?? BRIEFS_CAP.kanbanFields[0]?.field ?? 'clientStatus',
  );
  const [, startTransition] = useTransition();

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(next);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    syncUrl('');
  }, []);

  const open = useCallback(
    (item: BriefItem) => {
      router.push(item.href);
    },
    [router],
  );

  // The board's quick-look panel (P2B-3): a card click opens it beside the columns instead of
  // navigating away. The full page is one button further, so triaging a column costs no navigation.
  const [panelId, setPanelId] = useState<string | null>(null);

  const openPanel = useCallback((card: KanbanItem) => {
    setPanelId(card.id);
  }, []);

  const closePanel = useCallback(() => {
    setPanelId(null);
  }, []);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;

  // AI-48. Counted from the briefs already on the page, so the summary costs no query and tracks
  // the search: narrow the list and the four buckets narrow with it.
  const pipeline = useMemo(() => buildBriefPipeline(visible.map((item) => item.row)), [visible]);

  const panelItem = items.find((item) => item.id === panelId) ?? null;

  const handleKanbanMove = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      startTransition(() => {
        const fd = new FormData();
        fd.set('id', item.id);
        const snap = item.formSnapshot;
        fd.set('conceptId', snap.conceptId);
        fd.set('funnel', snap.funnel);
        fd.set('type', snap.type);
        fd.set('version', snap.version);
        fd.set('batch', snap.batch);
        fd.set('product', snap.product);
        fd.set('priority', snap.priority);
        fd.set('assignee', snap.assignee);
        fd.set('dueDate', snap.dueDate);
        fd.set('briefToDesign', snap.briefToDesign);
        fd.set('scriptContent', snap.scriptContent);
        fd.set('elementsTested', snap.elementsTested);
        fd.set('adContent', snap.adContent);
        fd.set('inspiration', snap.inspiration);
        fd.set('offer', snap.offer);
        fd.set('language', snap.language);
        fd.set('spellingFeedback2', snap.spellingFeedback2);
        fd.set('angleId', snap.angleId);
        fd.set('productId', snap.productId);
        for (const link of snap.inspoLinks) {
          fd.append('inspoLinks', link);
        }
        for (const dim of snap.dimensions) {
          fd.append('dimensions', dim);
        }
        fd.set('internalStatus', snap.internalStatus);
        fd.set('clientStatus', snap.clientStatus);

        if (kanbanField === 'editorStage') {
          // A drop between the editor's columns is a status move on the internal track: Incoming →
          // Under Editing is Start; Under Editing → Under Review is a submission (the revision
          // resubmission when the brief was under revisions). Anything else is not a move the
          // machine allows, so it is ignored rather than written.
          const track = creativeTrack(snap.type);
          const from = snap.internalStatus;
          const to: string | null =
            newValue === 'under_editing' && editorStageOf(from) === 'incoming'
              ? startedStatusFor(track)
              : newValue === 'under_review' && editorStageOf(from) === 'under_editing'
                ? from.endsWith('_revisions')
                  ? 'revisions_submitted'
                  : 'ad_submitted'
                : null;
          const onTrack = (value: string): value is InternalStatusKey =>
            internalStatusFor(track).some((entry) => entry.key === value);
          if (to === null || !onTrack(from) || !onTrack(to)) return;
          if (!canTransitionInternal(track, from, to)) return;
          fd.set('internalStatus', to);
        } else {
          fd.set(kanbanField, newValue);
        }

        void updateBriefAction(null, fd);
      });
    },
    [demo, items, kanbanField],
  );

  // The board card carries what a media buyer scans for (P2B-2): the generated name, the concept it
  // belongs to, priority and type as chips, the assignee, and a left stripe coloured by the stage the
  // card sits in. Every tone comes from the domain's `chipTone`, never a locally chosen colour.
  const [startError, setStartError] = useState<string | null>(null);

  // Start (EDIT-02): the one button on an Incoming card. Disabled in demo mode with the reason.
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

  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return visible.map((item) => ({
      id: item.id,
      name: item.name,
      groupValue: item.kanbanFields[kanbanField] ?? '',
      subtitle: item.conceptName ?? STANDALONE_CONCEPT_SLUG,
      chipLabel: item.status.label,
      chipTone: item.status.tone,
      accentTone: item.status.tone,
      assignee: item.assignee,
      badges: [
        ...(item.priority === null
          ? []
          : [{ label: item.priority.label, tone: item.priority.tone }]),
        { label: item.typeLabel, tone: 'mute' as const },
      ],
      href: item.href,
      ...(kanbanField === 'editorStage'
        ? {
            accentTone: editorStageTone(editorStageOf(item.kanbanFields.internalStatus ?? '')),
            ...(canStartBrief(item.kanbanFields.internalStatus ?? '')
              ? {
                  action: {
                    label: 'Start',
                    slot: 'brief-start',
                    disabled: demo,
                    hint: DEMO_WRITE_HINT,
                    onAction: () => {
                      startBrief(item.id);
                    },
                  },
                }
              : {}),
          }
        : {}),
    }));
  }, [visible, kanbanField, demo, startBrief]);

  const editorStageColumns: readonly EditorStageKey[] = EDITOR_STAGES.map((stage) => stage.key);
  const offBoard = useMemo(
    () =>
      kanbanField === 'editorStage'
        ? visible.filter((item) => editorStageOf(item.kanbanFields.internalStatus ?? '') === null)
            .length
        : 0,
    [kanbanField, visible],
  );

  const kanbanColumns = useMemo(() => {
    if (kanbanField === 'editorStage') return [...editorStageColumns];
    const seen = new Set<string>();
    for (const item of kanbanItems) {
      if (item.groupValue !== '') seen.add(item.groupValue);
    }
    return [...seen];
  }, [kanbanItems, kanbanField, editorStageColumns]);

  // Column headers are the domain's own status labels ("Sent to Video Editor",
  // "Pending for Approval"), never a re-capitalised key: both groupable fields are
  // status tracks and every item already carries their views, so the header can
  // never drift from `@tas/domain/state`.
  const kanbanLabels = useMemo(() => {
    if (kanbanField === 'editorStage') {
      return Object.fromEntries(EDITOR_STAGES.map((stage) => [stage.key, stage.label]));
    }
    const labels: Record<string, string> = {};
    for (const item of visible) {
      labels[item.status.key] = item.status.label;
      labels[item.clientStatus.key] = item.clientStatus.label;
    }
    return labels;
  }, [kanbanField, visible]);

  const galleryItems: readonly GalleryItem[] = useMemo(() => {
    return visible
      .filter((item) => item.galleryImageUrl !== null)
      .map((item) => ({
        id: item.id,
        name: item.name,
        imageUrl: item.galleryImageUrl,
        mediaType: 'image' as const,
        subtitle: item.conceptName ?? STANDALONE_CONCEPT_SLUG,
        href: item.href,
      }));
  }, [visible]);

  const newBrief = (slot: string) => (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_BRIEF_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot={slot}>
        New brief
      </Button>
    </DisabledWrite>
  );

  const kanbanFieldOptions = BRIEFS_CAP.kanbanFields;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Creative Design</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Design</h1>
          {newBrief('new-brief')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="brief-count">
            {narrowed
              ? filteredBriefCountLabel(visible.length, items.length)
              : briefCountLabel(items.length)}
          </span>{' '}
          — one record per creative asset, named for you.
        </p>
      </header>

      <BriefPipelineSummary pipeline={pipeline} />

      <section aria-labelledby="briefs-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="briefs-heading" className="text-sm font-medium text-text2">
              Pipeline
            </h2>
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...BRIEFS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanField}
            />
          </div>
          <div className="flex items-center gap-2">
            {activeView === 'kanban' && kanbanFieldOptions.length > 1 ? (
              <select
                value={kanbanField}
                onChange={(e) => {
                  setKanbanField(e.target.value);
                }}
                className="h-8 rounded-input border border-line bg-surface px-2 text-xs text-text"
                aria-label="Group by"
              >
                {kanbanFieldOptions.map((opt) => (
                  <option key={opt.field} value={opt.field}>
                    {opt.label}
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
              placeholder="Search briefs"
              aria-label="Search briefs by name, concept, type, priority, assignee or status"
              data-slot="brief-search"
              className="h-8 w-full sm:w-64"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="briefs-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_BRIEFS_NOTE}</p>
            {narrowed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSearch}
                data-slot="clear-search"
              >
                Clear search
              </Button>
            ) : (
              newBrief('empty-new-brief')
            )}
          </div>
        ) : activeView === 'kanban' ? (
          <>
            {startError === null ? null : (
              <p className="text-xs text-bad" data-slot="brief-start-error">
                {startError}
              </p>
            )}
            {offBoard === 0 ? null : (
              <p className="text-xs text-text3" data-slot="brief-off-board">
                {String(offBoard)} {offBoard === 1 ? 'brief is' : 'briefs are'} approved or launched
                and off the editor board.
              </p>
            )}
            <KanbanBoard
              items={kanbanItems}
              columns={kanbanColumns}
              columnLabels={kanbanLabels}
              onMove={handleKanbanMove}
              demo={demo}
              onCardClick={openPanel}
            />
          </>
        ) : activeView === 'gallery' ? (
          <GalleryView items={galleryItems} />
        ) : (
          <>
            <ColumnNotices
              slotPrefix="brief"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="BRIEF_RENDERERS in briefs-workspace.tsx"
            />
            <AirtableGrid
              tableKey={TABLE_KEY}
              columns={grid.columns}
              rows={visible}
              rowId={(item) => item.id}
              rowLabel={(item) => item.name}
              rowAttributes={(item) => ({
                'data-brief-id': item.id,
                // The editor-board stage, so the row is addressable by the stage it sits at and the
                // Kanban stripe, the detail chip and this row cannot disagree about which that is.
                'data-stage': item.stage?.key,
              })}
              onRowClick={open}
              tableSlot="briefs-table"
              rowSlot="brief-row"
            />
          </>
        )}
      </section>

      {panelItem === null ? null : <BriefPanel item={panelItem} onClose={closePanel} />}
    </div>
  );
}
