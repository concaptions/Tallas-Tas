'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  ListView,
  useTableView,
  ViewToolbar,
  type ListChip,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { applyFilters } from '@/components/views/airtable-grid-logic';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { EmptyCell, ChipListCell, CountCell, TextCell } from '@/components/views/grid-cells';
import { linkedRecordsRenderer } from '@/components/views/linked-records-cell';

import { ConceptPanel } from './concept-panel';
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
 * TABLE is the default, because a concept list is a queue you work down and the columns read faster
 * than any card. GALLERY is the same rows as cards, for the pass where you are looking at concepts
 * rather than working them. Neither view filters, sorts or re-labels anything: `loadConcepts()`
 * returns the rows newest edit first and the page already resolved every status label and tone
 * through `@tas/domain/state`.
 *
 * NO BOARD (action item 18: Kanban leaves the data tables). The lanes were internal status, which is
 * still a grid column, still a chip on the row and still on the concept's own page — the board was a
 * second reading of data that is all still here, and the two boards that ARE the workflow (Creative
 * Briefs, UGC Management) keep theirs. `ConceptBoard` itself survives on `/design-system`, so the
 * component is documented rather than deleted; nothing on this page mounts it. A `?view=board` link
 * written before the change still opens — on the grid — rather than 404ing on a view that is gone.
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
 * A row, a card and a list row are the same thing: a click on any of them opens the side panel
 * (AI-17, the operator's ruling — the shipped brief-panel pattern), so the list, the search and
 * the view stay exactly where they were. The generated NAME — in the grid row and in the panel —
 * is the real `<Link>` to `/app/concepts/<id>` (AI-52): editing a concept is still a page's worth
 * of material (the pairing, the inherited block, the approval rail), it is just one deliberate
 * navigation away instead of the price of a glance.
 */
interface ConceptsWorkspaceProps {
  readonly items: readonly ConceptItem[];
  /** The brand's ordered, labelled, visible Concepts columns, from `loadConceptColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
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
 * `?view=` ↔ the view switcher: the URL keeps its `table` / `gallery` words, and `board` is STILL a
 * value the server narrows (`conceptViewFromParam`), so a link written while the board existed opens
 * instead of 404ing. It now lands on the grid, and the first thing that syncs the URL — a search, a
 * view switch — drops the stale parameter (action item 18).
 */
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
 * THE Concepts renderer registry, keyed by the resolver's `column_key` — a Postgres column, or the
 * junction table for a link column.
 *
 * This replaces the hand-written `CONCEPT_GRID_COLUMNS` array. No header string and no ordering
 * live here: labels, order and visibility arrive as data from `column_definitions`, and this says
 * only how a cell is DRAWN. The generated name keeps its `concept-row-name` hook and `font-mono`
 * (CLAUDE.md non-negotiable 6 — generated output always renders in `font-mono`), and the two
 * approval tracks keep their `StatusChip`s.
 *
 * `production_status` has no entry on purpose, and now needs none: the column is seeded
 * `is_hidden` on the parent (packages/db/src/column-seed.ts — Talal, 2026-09-28, "take it out"), so
 * the resolver never returns it and nothing reaches this registry to look for. It used to resolve
 * visible, come back in `missing` and be printed on the page by `ColumnNotices`, which put the name
 * of the removed field on screen for every brand. Hiding a column is a DATA edit in the seed, never
 * a special case here.
 */
export const CONCEPT_RENDERERS: ColumnRegistry<ConceptItem> = {
  name: {
    render: (item) => (
      /*
       * A REAL LINK (AI-52): the generated name is the way to the concept's own page, so it can be
       * cmd-clicked, middle-clicked and copied. A plain click follows it too — the stopPropagation
       * only keeps the ROW's click (which opens the panel) from firing underneath the navigation.
       */
      <Link
        href={item.href}
        data-slot="concept-row-name"
        className="font-mono text-xs hover:underline"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {item.name}
      </Link>
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
  // The client's own approval of the concept (migration 0055; CLIENT_STATUS since AUDIT-13). Seeded
  // as "Client Approval" and never drawn until SMOKE-12 — the grid reported it as a missing renderer.
  // PRD §5.7 Formats (the multi-select on the row). Seeded, and the second column the SMOKE-12 gate
  // found undrawn beside Client Approval.
  formats: {
    render: (item) => (
      <ChipListCell chips={item.formats.map((format) => ({ label: format, tone: 'mute' }))} />
    ),
    sortValue: (item) => item.formats.join(', '),
  },
  client_approval_status: {
    render: (item) =>
      item.clientApproval === null ? (
        <EmptyCell />
      ) : (
        <StatusChip tone={item.clientApproval.tone} label={item.clientApproval.label} />
      ),
    sortValue: (item) => item.clientApproval?.label ?? '',
  },
  approval_status: {
    render: (item) => <TextCell value={item.approvalStatusLabel} />,
    sortValue: (item) => item.approvalStatusLabel,
  },
  // Fidelity flip 2026-10-04: the live base HAS Production Status, so Gratsi resolves it again
  // (visible child row over the AI-34-hidden parent; other brands keep the hide).
  production_status: {
    render: (item) => <TextCell value={item.productionStatusLabel} />,
    sortValue: (item) => item.productionStatusLabel ?? '',
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
  // GRATSI-MATCH 2026-10-04: the base's `UGC Management` link is this junction, so the cell reads
  // as Airtable does — the linked creators' NAMES, through the one shared linked-records cell.
  creator_concepts: linkedRecordsRenderer((item: ConceptItem) => item.creators),
  // The two reverse links the base shows (diff annotation 6), read-only: the campaigns that link
  // this concept and the briefs whose `concept_id` is this concept. Generated names in mono.
  campaign_concepts: linkedRecordsRenderer((item: ConceptItem) => item.campaigns, { mono: true }),
  creative_briefs: linkedRecordsRenderer((item: ConceptItem) => item.creativeDesigns, {
    mono: true,
  }),
  // Airtable's `Performance` lookup, VIRTUAL — the server computed the finished string with
  // `conceptPerformance` over the briefs' performances; nothing stores it.
  performance: {
    render: (item) => <TextCell value={item.performance} />,
    sortValue: (item) => item.performance,
  },
  ad_inspo_links: {
    render: (item) => <CountCell count={item.adInspoCount} noun="link" />,
    sortValue: (item) => item.adInspoCount,
  },
};

export function ConceptsWorkspace({
  items,
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
  const [selection, setSelection] = useState<string | null>(null);
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
    // Only an EXPLICIT `?view=gallery` overrides the saved view's own type. `table` is both the
    // default and the word the server narrows every absent or stale value to, so passing it
    // through as an override would pin a saved Gallery or List view back to the grid on every
    // plain load of the page — the hook reserves the override for a view someone actually asked
    // for in the URL.
    initialViewType: initialView === 'gallery' ? 'gallery' : null,
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

  /** A click on a row, card or list row opens the panel; only the NAME link navigates. */
  const open = useCallback((item: ConceptItem) => {
    setSelection(item.id);
  }, []);

  const closePanel = useCallback(() => {
    setSelection(null);
  }, []);

  const create = useCallback(() => {
    router.push(conceptPath(NEW_CONCEPT));
  }, [router]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  /**
   * The view's field conditions applied once, here, so the grid, the gallery and the list all
   * read the SAME narrowed row set (AI-32): `visible` already passed the search (and the tab's
   * own narrowing where the page has one), the grid sorts afterwards. With no conditions this is
   * the same array back.
   */
  const filtered = useMemo(
    () => applyFilters(visible, tableView.config.filters, grid.columns),
    [visible, grid, tableView.config.filters],
  );

  const narrowed = filtered.length !== items.length;

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(
        filtered,
        grid.columns,
        (item) => ({
          id: item.id,
          name: item.name,
          subtitle: item.themeName ?? undefined,
        }),
        { fieldOrder: tableView.config.fieldOrder },
      ),
    [filtered, grid, tableView.config.fieldOrder],
  );

  /** The list rows wear the concept's INTERNAL status, the same chip the grid column shows. */
  const listChips = useMemo(() => {
    const chips: Record<string, ListChip> = {};
    for (const item of filtered)
      chips[item.id] = { label: item.status.label, tone: item.status.tone };
    return chips;
  }, [filtered]);

  const openConcept = filtered.find((item) => item.id === selection) ?? null;

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
              ? filteredConceptCountLabel(filtered.length, items.length)
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
              fields={fieldOptions}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              onMoveField={tableView.moveField}
              onFiltersChange={tableView.setFilters}
              onGroupChange={tableView.setGroupBy}
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

        {filtered.length === 0 ? (
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
        ) : activeView === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            cardSlot="concept-card"
            onItemClick={(item) => {
              const target = filtered.find((candidate) => candidate.id === item.id);
              if (target !== undefined) open(target);
            }}
          />
        ) : activeView === 'list' ? (
          <ListView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            rowSlot="concept-list-row"
            chips={listChips}
            monoNames
            onItemClick={(item) => {
              const target = filtered.find((candidate) => candidate.id === item.id);
              if (target !== undefined) open(target);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="concepts"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={grid.columns}
            rows={filtered}
            rowId={(item) => item.id}
            rowLabel={(item) => item.name}
            rowAttributes={(item) => ({ 'data-concept-id': item.id })}
            selectedId={selection}
            onRowClick={(item) => {
              open(item);
            }}
            tableSlot="concepts-table"
            rowSlot="concept-row"
          />
        )}
      </section>

      {openConcept === null ? null : <ConceptPanel item={openConcept} onClose={closePanel} />}
    </div>
  );
}
