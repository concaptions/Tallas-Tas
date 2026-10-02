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
import { GalleryView, galleryItemsFrom, useTableView, ViewToolbar } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { ChipListCell, CountCell, TextCell } from '@/components/views/grid-cells';

import {
  EM_DASH,
  NEW_CONCEPT,
  NO_CONCEPTS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  VIEW_PARAM,
  conceptCountLabel,
  filteredConceptCountLabel,
  matchesQuery,
  type ConceptItem,
  type ConceptView,
} from './fields';

/**
 * The Concepts list: one set of rows, two ways of reading it (PRD §5.7, ticket criteria 2–5).
 *
 * TABLE is the default and the one that matters, because a concept list is a queue you work down
 * and the columns read faster than any card. GALLERY is the same rows as cards, for the pass where
 * you are looking at concepts rather than working them.
 *
 * NO BOARD (Talal, 2026-09-28, AI-18). Kanban was dropped from every data table — it stays on
 * Creative Briefs, where the editor's three columns are the actual workflow. A `?view=board` link
 * written before that still opens, on the grid, rather than 404ing or showing an empty switcher.
 *
 * Neither view filters, sorts or re-labels anything: `loadConcepts()` returns the rows newest edit
 * first and the page already resolved every status label and tone through `@tas/domain/state`.
 *
 * The chosen view lives in `?view=` and the search in `?q=`, both written with the History API
 * exactly as the Angles table writes `?angle=` and `?q=`: switching or typing is instant, a refresh
 * restores what you had, and the narrowed list someone is looking at is a link they can send. A
 * value at its default is removed from the URL rather than written, so a clean page has a clean
 * address.
 *
 * ONE SEARCH, BOTH VIEWS. Filtering to nothing says so in its own words and offers to clear the
 * search — a different sentence from the brand that has no concepts at all, because those are
 * different problems with different ways out (`NO_MATCH_NOTE` and `NO_CONCEPTS_NOTE`).
 *
 * A row and a card are the same thing: a click on either navigates to `/app/concepts/<id>`, a real
 * route segment, so the list is gone and Back restores it with the `?view=` it had. This is
 * deliberately NOT a side panel — a concept carries a brief, an inherited block and an approval
 * rail, which is a page's worth of material.
 */
interface ConceptsWorkspaceProps {
  readonly items: readonly ConceptItem[];
  /**
   * RETAINED, UNUSED. The board was the only thing in here that needed the track, and dropping
   * Kanban from Concepts (AI-18) took its last reader with it — nothing in this component reads
   * this prop any more. It stays declared because `page.tsx` still passes `track={CONCEPT_TRACK}`
   * and removing the two has to happen in one commit; that file is owned by another change in
   * flight, so the prop outlives the board by exactly one ticket. Delete both together.
   */
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

/**
 * `?view=` ↔ the view switcher: the URL keeps its `table` / `gallery` words. `board` is still a
 * value the server narrows (`conceptViewFromParam`), so an old link keeps working — it now lands on
 * the grid, and the first thing that syncs the URL drops the stale parameter (AI-18).
 */
const VIEW_TYPE_OF: Record<ConceptView, ViewType> = {
  table: 'grid',
  board: 'grid',
  gallery: 'gallery',
};
function conceptViewOf(viewType: ViewType): ConceptView {
  return viewType === 'gallery' ? 'gallery' : 'table';
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
 * The Airtable-style grid columns for the Concepts table view (P2A-3). The first seven headers are
 * `CONCEPT_COLUMNS`; the generated name keeps its `concept-row-name` hook and `font-mono`, and the
 * two status tracks render a `<StatusChip>` each. Every other stored column follows, so a concept is
 * readable end to end without opening it. Production Status is hidden on purpose (docs/decisions.md).
 */
const CONCEPT_GRID_COLUMNS: readonly GridColumn<ConceptItem>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 220,
    sortValue: (item) => item.name,
    render: (item) => (
      <span data-slot="concept-row-name" className="font-mono text-xs">
        {item.name}
      </span>
    ),
  },
  {
    key: 'batch',
    header: 'Batch',
    sortValue: (item) => item.batch,
    render: (item) =>
      item.batch === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="font-mono text-xs">{item.batch}</span>
      ),
  },
  {
    key: 'angle',
    header: 'Angle',
    sortValue: (item) => item.angleName,
    render: (item) => item.angleName ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'persona',
    header: 'Persona',
    sortValue: (item) => item.personaName,
    render: (item) => item.personaName ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'product',
    header: 'Product',
    sortValue: (item) => item.productName,
    render: (item) => item.productName ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'theme',
    header: 'Theme',
    sortValue: (item) => item.themeName,
    render: (item) => item.themeName ?? <span className="text-text4">{EM_DASH}</span>,
  },
  {
    key: 'status',
    header: 'Internal Status',
    sortValue: (item) => item.status.label,
    render: (item) => <StatusChip tone={item.status.tone} label={item.status.label} />,
  },
  {
    key: 'clientStatus',
    header: 'Client Status',
    sortValue: (item) => item.clientStatus.label,
    render: (item) => <StatusChip tone={item.clientStatus.tone} label={item.clientStatus.label} />,
  },
  {
    key: 'approvalStatus',
    header: 'Approval Status',
    sortValue: (item) => item.approvalStatusLabel,
    render: (item) => <TextCell value={item.approvalStatusLabel} />,
  },
  {
    key: 'category',
    header: 'Category',
    sortValue: (item) => item.categoryLabel,
    render: (item) => <TextCell value={item.categoryLabel} />,
  },
  {
    key: 'conceptStyle',
    header: 'Concept Style',
    sortValue: (item) => item.styleLabel,
    render: (item) => <TextCell value={item.styleLabel} />,
  },
  {
    key: 'formatsToCreate',
    header: 'Formats to create',
    render: (item) => (
      <ChipListCell
        chips={item.formatsToCreate.map((format) => ({ label: format, tone: 'accent' }))}
      />
    ),
  },
  {
    key: 'hookExamples',
    header: 'Hook Examples',
    render: (item) => <TextCell value={item.hookExamples} />,
  },
  {
    key: 'scriptIdea',
    header: 'Script Idea',
    render: (item) => <TextCell value={item.scriptIdea} />,
  },
  {
    key: 'description',
    header: 'Description',
    render: (item) => <TextCell value={item.description} />,
  },
  {
    key: 'painPoints',
    header: 'Pain Points',
    render: (item) => <TextCell value={item.painPoints} />,
  },
  { key: 'usp', header: 'USP', render: (item) => <TextCell value={item.usp} /> },
  {
    key: 'clientComments',
    header: 'Client Comments',
    render: (item) => <TextCell value={item.clientComments} />,
  },
  {
    key: 'collection',
    header: 'Collection',
    sortValue: (item) => item.collectionName,
    render: (item) => <TextCell value={item.collectionName} />,
  },
  {
    key: 'creators',
    header: 'Creators',
    sortValue: (item) => item.creatorCount,
    render: (item) => <CountCell count={item.creatorCount} noun="creator" />,
  },
  {
    key: 'adInspo',
    header: 'Ad Inspo',
    sortValue: (item) => item.adInspoCount,
    render: (item) => <CountCell count={item.adInspoCount} noun="link" />,
  },
];

/** Every column key the Fields popover can toggle, and its label, in grid order (VIEWS-01). */
const FIELD_KEYS: readonly string[] = CONCEPT_GRID_COLUMNS.map((column) => column.key);
const FIELD_OPTIONS = CONCEPT_GRID_COLUMNS.map((column) => ({
  key: column.key,
  label: column.header,
}));

export function ConceptsWorkspace({
  items,
  demo,
  initialView,
  initialSearch,
  userViews,
}: ConceptsWorkspaceProps) {
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
    fieldKeys: FIELD_KEYS,
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

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(visible, CONCEPT_GRID_COLUMNS, (item) => ({
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
              kanbanGroupByField={null}
              views={tableView.views}
              activeViewId={tableView.activeView?.id ?? null}
              onActivateView={tableView.activateView}
              onCreateView={tableView.createView}
              onRenameView={tableView.renameView}
              onDeleteView={tableView.deleteView}
              fields={FIELD_OPTIONS}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              error={tableView.error}
            />
          </div>
        </div>

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
            columns={CONCEPT_GRID_COLUMNS}
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
