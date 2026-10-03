'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeTrack } from '@tas/domain/state';
import { getTableCapability, type ViewType } from '@tas/domain';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
} from '@tas/ui';

import { conceptPath } from '@/lib/routes';
import {
  ColumnNotices,
  GalleryView,
  galleryItemsFrom,
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
import { ChipListCell, CountCell, TextCell } from '@/components/views/grid-cells';

import { ConceptBoard } from './concept-board';
import {
  EM_DASH,
  NEW_CONCEPT,
  NO_CONCEPTS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  VIEW_PARAM,
  conceptColumns,
  conceptCountLabel,
  filteredConceptCountLabel,
  matchesQuery,
  type ConceptItem,
  type ConceptView,
} from './fields';

/**
 * The Concepts list: one set of rows, two ways of reading it (PRD §5.7, ticket criteria 2–5).
 *
 * TABLE is the default, because a concept list is a queue you work down and five columns read
 * faster than any card. BOARD is the same rows grouped by internal status, which is the question a
 * strategist actually asks on a Monday — what is stuck where. Neither view filters, sorts or
 * re-labels anything: `loadConcepts()` returns the rows newest edit first and the page already
 * resolved every status label and tone through `@tas/domain/state`.
 *
 * The chosen view lives in `?view=` and the search in `?q=`, both written with the History API
 * exactly as the Angles table writes `?angle=` and `?q=`: switching or typing is instant, a refresh
 * restores what you had, and the board — or the narrowed list — someone is looking at is a link
 * they can send. A value at its default is removed from the URL rather than written, so a clean
 * page has a clean address.
 *
 * ONE SEARCH, BOTH VIEWS. The filter runs on the rows before `conceptColumns` groups them, so the
 * board narrows with the table and a column's count is always the count of what is in it. Filtering
 * to nothing says so in its own words and offers to clear the search — a different sentence from
 * the brand that has no concepts at all, because those are different problems with different ways
 * out (`NO_MATCH_NOTE` and `NO_CONCEPTS_NOTE`).
 *
 * A row and a card are the same thing: a click on either navigates to `/app/concepts/<id>`, a real
 * route segment, so the list is gone and Back restores it with the `?view=` it had. This is
 * deliberately NOT a side panel — a concept carries a brief, an inherited block and an approval
 * rail, which is a page's worth of material.
 */
interface ConceptsWorkspaceProps {
  readonly items: readonly ConceptItem[];
  /** The brand's ordered, labelled, visible Concepts columns, from `loadConceptColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  /** Which internal track a concept runs on, resolved on the server beside the data source. */
  readonly track: CreativeTrack;
  readonly demo: boolean;
  readonly initialView: ConceptView;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
}

// Safe: 'concepts' is always in TABLE_VIEW_CAPABILITIES
const CONCEPTS_CAP = getTableCapability('concepts') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/** `?view=` ↔ the view switcher: the URL keeps its `table` / `board` words (shared links still work). */
const VIEW_TYPE_OF: Record<ConceptView, ViewType> = {
  table: 'grid',
  board: 'kanban',
  gallery: 'gallery',
};
function conceptViewOf(viewType: ViewType): ConceptView {
  if (viewType === 'kanban') return 'board';
  if (viewType === 'gallery') return 'gallery';
  return 'table';
}

/**
 * Writes both pieces of list state without a server round trip; Next.js reads the History API back.
 * A default is deleted rather than written as `?view=table` or `?q=`, so a cleared list leaves a
 * clean URL.
 */
function syncUrl(view: ConceptView, search: string): void {
  const url = new URL(window.location.href);
  if (view === 'table') {
    url.searchParams.delete(VIEW_PARAM);
  } else {
    url.searchParams.set(VIEW_PARAM, view);
  }
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * THE Concepts renderer registry, keyed by the resolver's `column_key` — a Postgres column, or the
 * junction table for a link column.
 *
 * This replaces the hand-written `CONCEPT_GRID_COLUMNS` array. No header string and no ordering
 * live here: labels, order and visibility arrive as data from `column_definitions`, and this says
 * only how a cell is DRAWN. The generated name keeps its `concept-row-name` hook and `font-mono`
 * (CLAUDE.md non-negotiable 6 — generated output always renders in `font-mono`), and the two
 * approval tracks keep their `StatusChip`s.
 *
 * `production_status` has no entry on purpose: the column is configured on the template but this
 * grid has never drawn it (docs/decisions.md), so it comes back in `missing` and is stated on the
 * page rather than silently omitted.
 */
const CONCEPT_RENDERERS: ColumnRegistry<ConceptItem> = {
  name: {
    render: (item) => (
      <span data-slot="concept-row-name" className="font-mono text-xs">
        {item.name}
      </span>
    ),
    sortValue: (item) => item.name,
  },
  batch: {
    render: (item) =>
      item.batch === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="font-mono text-xs">{item.batch}</span>
      ),
    sortValue: (item) => item.batch,
  },
  concept_angles: {
    render: (item) => item.angleName ?? <span className="text-text4">{EM_DASH}</span>,
    sortValue: (item) => item.angleName,
  },
  angle_personas: {
    render: (item) => item.personaName ?? <span className="text-text4">{EM_DASH}</span>,
    sortValue: (item) => item.personaName,
  },
  angle_products: {
    render: (item) => item.productName ?? <span className="text-text4">{EM_DASH}</span>,
    sortValue: (item) => item.productName,
  },
  concept_themes: {
    render: (item) => item.themeName ?? <span className="text-text4">{EM_DASH}</span>,
    sortValue: (item) => item.themeName,
  },
  // The two tracks of CLAUDE.md non-negotiable 4. Internal is team-only, Client is client-facing.
  internal_status: {
    render: (item) => <StatusChip tone={item.status.tone} label={item.status.label} />,
    sortValue: (item) => item.status.label,
  },
  client_status: {
    render: (item) => <StatusChip tone={item.clientStatus.tone} label={item.clientStatus.label} />,
    sortValue: (item) => item.clientStatus.label,
  },
  approval_status: {
    render: (item) => <TextCell value={item.approvalStatusLabel} />,
    sortValue: (item) => item.approvalStatusLabel,
  },
  category: {
    render: (item) => <TextCell value={item.categoryLabel} />,
    sortValue: (item) => item.categoryLabel,
  },
  concept_style: {
    render: (item) => <TextCell value={item.styleLabel} />,
    sortValue: (item) => item.styleLabel,
  },
  formats_to_create: {
    render: (item) => (
      <ChipListCell
        chips={item.formatsToCreate.map((format) => ({ label: format, tone: 'accent' }))}
      />
    ),
  },
  hook_examples: { render: (item) => <TextCell value={item.hookExamples} /> },
  script_idea: { render: (item) => <TextCell value={item.scriptIdea} /> },
  description: { render: (item) => <TextCell value={item.description} /> },
  pain_points: { render: (item) => <TextCell value={item.painPoints} /> },
  usp: { render: (item) => <TextCell value={item.usp} /> },
  client_comments: { render: (item) => <TextCell value={item.clientComments} /> },
  concept_collections: {
    render: (item) => <TextCell value={item.collectionName} />,
    sortValue: (item) => item.collectionName,
  },
  creator_concepts: {
    render: (item) => <CountCell count={item.creatorCount} noun="creator" />,
    sortValue: (item) => item.creatorCount,
  },
  ad_inspo_links: {
    render: (item) => <CountCell count={item.adInspoCount} noun="link" />,
    sortValue: (item) => item.adInspoCount,
  },
};

export function ConceptsWorkspace({
  items,
  track,
  demo,
  initialView,
  initialSearch,
  userViews,
  columns,
  unconfiguredColumns = false,
}: ConceptsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, CONCEPT_RENDERERS, { freezeFirst: true, frozenMinWidth: 220 }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, and its label, in resolved order (VIEWS-01). */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const viewRef = useRef<ConceptView>(initialView);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(viewRef.current, next);
  }, []);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      viewRef.current = conceptViewOf(config.viewType);
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'concepts',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    initialViewType: VIEW_TYPE_OF[initialView],
    fieldKeys,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const view = conceptViewOf(activeView);
  viewRef.current = view;

  const setActiveView = useCallback(
    (next: ViewType) => {
      tableView.setViewType(next);
      viewRef.current = conceptViewOf(next);
      syncUrl(conceptViewOf(next), search);
    },
    [search, tableView],
  );

  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      tableView.setFilter(next);
    },
    [filter, tableView],
  );

  const clearSearch = useCallback(() => {
    onSearch('');
  }, [onSearch]);

  const open = useCallback(
    (item: ConceptItem) => {
      router.push(item.href);
    },
    [router],
  );

  const create = useCallback(() => {
    router.push(conceptPath(NEW_CONCEPT));
  }, [router]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;

  // The Kanban board's lanes. Named apart from `columns`, which is the resolved COLUMN SET.
  const boardColumns = useMemo(() => conceptColumns(track, visible), [track, visible]);

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(visible, grid.columns, (item) => ({
        id: item.id,
        name: item.name,
        subtitle: item.themeName ?? undefined,
      })),
    [visible],
  );

  const newConcept = (
    <Button
      size="sm"
      disabled={demo}
      className={demo ? disabledWriteClassName : undefined}
      onClick={create}
      data-slot="new-concept"
    >
      New concept
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Concepts</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Concepts</h1>
          <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
            {newConcept}
          </DisabledWrite>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="concept-count">
            {narrowed
              ? filteredConceptCountLabel(visible.length, items.length)
              : conceptCountLabel(items.length)}
          </span>{' '}
          — one angle paired with one theme, named for you.
        </p>
      </header>

      <section aria-labelledby="concepts-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="concepts-heading" className="text-sm font-medium text-text2">
            Pipeline
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                onSearch(event.target.value);
              }}
              placeholder="Search concepts"
              aria-label="Search concepts by name, batch, angle, theme or status"
              data-slot="concept-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewToolbar
              tableKey="concepts"
              supportedViews={[...CONCEPTS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="internalStatus"
              views={tableView.views}
              activeViewId={tableView.activeView?.id ?? null}
              onActivateView={tableView.activateView}
              onCreateView={tableView.createView}
              onRenameView={tableView.renameView}
              onDeleteView={tableView.deleteView}
              fields={fieldOptions}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              error={tableView.error}
            />
          </div>
        </div>

        <ColumnNotices
          slotPrefix="concept"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="CONCEPT_RENDERERS in concepts-workspace.tsx"
        />

        {visible.length === 0 ? (
          <div
            data-slot="concepts-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_CONCEPTS_NOTE}</p>
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
              <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                <Button
                  size="sm"
                  disabled={demo}
                  className={demo ? disabledWriteClassName : undefined}
                  onClick={create}
                  data-slot="empty-new-concept"
                >
                  New concept
                </Button>
              </DisabledWrite>
            )}
          </div>
        ) : view === 'board' ? (
          <ConceptBoard columns={boardColumns} onOpen={open} />
        ) : view === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            cardSlot="concept-card"
            onItemClick={(item) => {
              const target = visible.find((candidate) => candidate.id === item.id);
              if (target !== undefined) open(target);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="concepts"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.id}
            rowLabel={(item) => item.name}
            rowAttributes={(item) => ({ 'data-concept-id': item.id })}
            onRowClick={(item) => {
              open(item);
            }}
            tableSlot="concepts-table"
            rowSlot="concept-row"
          />
        )}
      </section>
    </div>
  );
}
