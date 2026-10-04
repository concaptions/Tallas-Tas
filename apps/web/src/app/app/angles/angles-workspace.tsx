'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AngleListRow } from '@tas/db';
import {
  anglePotentialLabel,
  anglePotentialTone,
  getTableCapability,
  type ViewType,
} from '@tas/domain';
import { Button, DEMO_WRITE_HINT, disabledWriteClassName, DisabledWrite, Input } from '@tas/ui';

import {
  ColumnNotices,
  useTableView,
  ViewToolbar,
  GalleryView,
  ListView,
  galleryItemsFrom,
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
import {
  BoolCell,
  ChipCell,
  ChipListCell,
  CountCell,
  LinkCell,
  TextCell,
} from '@/components/views/grid-cells';

import { AnglePanel, NEW_ANGLE, type LinkOption } from './angle-panel';
import {
  FORMAT_CHIP_TONE,
  PERSONA_CHIP_TONE,
  PRODUCT_CHIP_TONE,
  angleFormatEntries,
  angleStatusView,
  angleTypeEntries,
  chipLabel,
  type LinkedRecord,
} from './fields';

/**
 * The Angles table, its header actions and its side panel (PRD §5.6).
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open angle lives in the `?angle=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it.
 *
 * The filter is URL-backed the same way, in `?q=`, exactly as the Products page does it: the two
 * pieces of table state behave alike, a refresh keeps the rows you had narrowed to, and "here are
 * Denise's angles" is a link you can send. The search box is also how the empty state is reached —
 * filtering to nothing says so in words and offers to clear the filter, so the table area is never
 * a blank rectangle.
 *
 * The grid is the Airtable-style `AirtableGrid` (P2A): every stored column of an angle is visible
 * without opening a row, the name column is frozen while the rest scroll, and the headers sort.
 * `loadAngles()` returns the rows newest edit first, which is the order before any sort.
 *
 * `creativeModulesByAngle`, `conceptsByAngle` and `creativeDesignsByAngle` are the page's
 * inversions of `creative_module_angles`, `concept_angles` and `creative_briefs.angle_id`, each
 * keyed by angle id; the workspace only picks the open angle's list out of each for the panel. An
 * angle with no entry has nothing linked there, and the panel says so.
 */
export interface AngleItem {
  readonly angle: AngleListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

/** One of the page's inversions: `angleId -> [record, …]`, as it crosses the prop boundary. */
type LinkedIndex = Readonly<Record<string, readonly LinkedRecord[]>>;

/** No linked records: one frozen empty list, so an absent key never allocates per render. */
const NO_RECORDS: readonly LinkedRecord[] = [];

/** The open angle's rows in one inversion, or the frozen empty list when nothing links it. */
function linkedTo(index: LinkedIndex, angle: AngleListRow | null): readonly LinkedRecord[] {
  return angle === null ? NO_RECORDS : (index[angle.id] ?? NO_RECORDS);
}

interface AnglesWorkspaceProps {
  readonly items: readonly AngleItem[];
  /** The brand's ordered, labelled, visible Angles columns, from `loadAngleColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly personas: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  /** The brand's concepts, for the panel's two-way Concepts field (LINK-01). */
  readonly conceptOptions?: readonly LinkOption[];
  readonly creativeModulesByAngle: LinkedIndex;
  readonly conceptsByAngle: LinkedIndex;
  readonly creativeDesignsByAngle: LinkedIndex;
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
}

// Safe: 'angles' is always in TABLE_VIEW_CAPABILITIES
const ANGLES_CAP = getTableCapability('angles') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'angle' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The filter reads what is on the row: its name, who it is written from and what it sells. */
function matches(item: AngleItem, query: string): boolean {
  const { name, personaName, productName, description } = item.angle;
  return [name, personaName ?? '', productName ?? '', description ?? ''].some((value) =>
    value.toLowerCase().includes(query),
  );
}

/**
 * THE Angles renderer registry, keyed by the resolver's `column_key` — a Postgres column, or the
 * junction table for a link column.
 *
 * This replaces the hand-written `ANGLE_COLUMNS` array. No header string and no ordering live here:
 * labels, order and visibility arrive as data from `column_definitions`, and this says only how a
 * cell is DRAWN — a chip whose tone comes from a `@tas/domain` vocabulary, a linked name with the
 * whole value in the cell title, a link, a count, a checkbox.
 *
 * It covers every angle column, not the set any one brand shows: the parent template carries seven
 * Airtable fields and nine platform columns, and Gratsi hides five of the seven because it keeps
 * them on Concepts instead. A resolved column with no entry here comes back in `missing` and is
 * stated on the page rather than dropped.
 */
const ANGLE_RENDERERS: ColumnRegistry<AngleItem> = {
  name: {
    render: (item) => <span className="font-medium">{item.angle.name}</span>,
    sortValue: (item) => item.angle.name,
  },
  // A junction, not a column: the first linked persona's name, whole value in the cell title.
  angle_personas: {
    render: (item) => (
      <ChipCell
        chip={
          item.angle.personaName === null
            ? null
            : { label: chipLabel(item.angle.personaName), tone: PERSONA_CHIP_TONE }
        }
      />
    ),
    sortValue: (item) => item.angle.personaName,
    cellTitle: (item) => item.angle.personaName ?? undefined,
  },
  angle_products: {
    render: (item) => (
      <ChipCell
        chip={
          item.angle.productName === null
            ? null
            : { label: chipLabel(item.angle.productName), tone: PRODUCT_CHIP_TONE }
        }
      />
    ),
    sortValue: (item) => item.angle.productName,
    cellTitle: (item) => item.angle.productName ?? undefined,
  },
  // The approval track from migration 0039. Its chip is a UI-governance fixture on /design-system,
  // so it keeps rendering through `StatusChip` and never as bare text.
  status: {
    render: (item) => {
      const view = angleStatusView(item.angle.status);
      return <ChipCell chip={view === null ? null : { label: view.label, tone: view.tone }} />;
    },
    sortValue: (item) => angleStatusView(item.angle.status)?.label ?? null,
  },
  potential: {
    render: (item) => (
      <ChipCell
        chip={
          item.angle.potential === null || item.angle.potential === ''
            ? null
            : {
                label: anglePotentialLabel(item.angle.potential),
                tone: anglePotentialTone(item.angle.potential),
              }
        }
      />
    ),
    sortValue: (item) => item.angle.potential,
  },
  winning: {
    render: (item) => <BoolCell value={item.angle.winning} />,
    sortValue: (item) => (item.angle.winning ? 1 : 0),
    align: 'center',
  },
  formats: {
    render: (item) => (
      <ChipListCell
        chips={angleFormatEntries(item.angle.formats).map((entry) => ({
          label: entry.label,
          tone: FORMAT_CHIP_TONE,
        }))}
      />
    ),
  },
  type: {
    render: (item) => (
      <ChipListCell
        chips={angleTypeEntries(item.angle.type).map((entry) => ({
          label: entry.label,
          tone: 'mute',
        }))}
      />
    ),
  },
  description: {
    render: (item) => <TextCell value={item.angle.description} />,
    sortValue: (item) => item.angle.description,
  },
  pain_points: { render: (item) => <TextCell value={item.angle.painPoints} /> },
  usp: { render: (item) => <TextCell value={item.angle.usp} /> },
  // A count over the stored jsonb, computed in the cell: the links themselves are in the panel.
  ad_inspo_links: {
    render: (item) => <CountCell count={item.angle.adInspoLinks.length} noun="link" />,
    sortValue: (item) => item.angle.adInspoLinks.length,
  },
  brief_url: { render: (item) => <LinkCell value={item.angle.briefUrl} /> },
  exact_script_url: { render: (item) => <LinkCell value={item.angle.exactScriptUrl} /> },
  internal_notes: { render: (item) => <TextCell value={item.angle.internalNotes} /> },
  client_notes: { render: (item) => <TextCell value={item.angle.clientNotes} /> },
};

export function AnglesWorkspace({
  items,
  personas,
  products,
  conceptOptions = [],
  creativeModulesByAngle,
  conceptsByAngle,
  creativeDesignsByAngle,
  demo,
  initialSelection,
  initialSearch,
  initialView,
  userViews,
  columns,
  unconfiguredColumns = false,
}: AnglesWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, ANGLE_RENDERERS, { freezeFirst: true, frozenMinWidth: 220 }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, and its label, in resolved order (VIEWS-01). */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('angle', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'angles',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    // A HARDCODED 'grid' here used to override the saved view's own type on every load, which
    // the hook's contract reserves for an explicit `?view=` (and which would have pinned the new
    // List view shut). No URL value means no override.
    initialViewType: initialView ?? null,
    fieldKeys,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const setActiveView = tableView.setViewType;
  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      tableView.setFilter(next);
    },
    [filter, tableView],
  );

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

  const open = items.find((item) => item.angle.id === selection)?.angle ?? null;
  const creating = selection === NEW_ANGLE;
  const openCreativeModules = linkedTo(creativeModulesByAngle, open);
  const openConcepts = linkedTo(conceptsByAngle, open);
  const openCreativeDesigns = linkedTo(creativeDesignsByAngle, open);

  /**
   * The view's field conditions applied once, here, so the grid, the gallery and the list all
   * read the SAME narrowed row set (AI-32): `visible` already passed the search, the grid sorts
   * afterwards. With no conditions this is `visible` itself, same array.
   */
  const filtered = useMemo(
    () => applyFilters(visible, tableView.config.filters, grid.columns),
    [visible, grid, tableView.config.filters],
  );

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(
        filtered,
        grid.columns,
        (item) => ({
          id: item.angle.id,
          name: item.angle.name,
          subtitle: item.angle.personaName ?? undefined,
        }),
        { fieldOrder: tableView.config.fieldOrder },
      ),
    [filtered, grid, tableView.config.fieldOrder],
  );

  const newAngle = (
    <Button
      size="sm"
      disabled={demo}
      className={demo ? disabledWriteClassName : undefined}
      onClick={() => {
        select(NEW_ANGLE);
      }}
      data-slot="new-angle"
    >
      New angle
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Angles</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Angles</h1>
          <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
            {newAngle}
          </DisabledWrite>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="angle-count">
            {filtered.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'angle' : 'angles'}`
              : `${String(filtered.length)} of ${String(items.length)} angles`}
          </span>{' '}
          — the hypothesis each concept is built from.
        </p>
      </header>

      <section aria-labelledby="angles-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="angles-heading" className="text-sm font-medium text-text2">
              Library
            </h2>
            <ViewToolbar
              tableKey="angles"
              supportedViews={[...ANGLES_CAP.supportedViews]}
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
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
            }}
            placeholder="Search angle, persona or product"
            aria-label="Search angles by name, persona or product"
            data-slot="angle-search"
            className="h-8 w-full sm:w-72"
          />
        </div>

        <ColumnNotices
          slotPrefix="angle"

          unconfigured={unconfiguredColumns}

          missing={grid.missing}

          registryName="ANGLE_RENDERERS in angles-workspace.tsx"
        />

        {activeView === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            cardSlot="angle-card"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : activeView === 'list' ? (
          <ListView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            rowSlot="angle-list-row"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="angles"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={grid.columns}
            rows={filtered}
            rowId={(item) => item.angle.id}
            rowLabel={(item) => item.angle.name}
            rowAttributes={(item) => ({ 'data-angle-id': item.angle.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.angle.id);
            }}
            tableSlot="angles-table"
            rowSlot="angle-row"
            empty={
              <div
                data-slot="angles-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No angles yet. Start with the hypothesis you most want to test on a persona.'
                    : `Nothing matches “${term}”. Try an angle name, a persona or a product.`}
                </p>
                {items.length === 0 ? (
                  <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                    <Button
                      size="sm"
                      disabled={demo}
                      className={demo ? disabledWriteClassName : undefined}
                      onClick={() => {
                        select(NEW_ANGLE);
                      }}
                      data-slot="empty-new-angle"
                    >
                      New angle
                    </Button>
                  </DisabledWrite>
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
        <AnglePanel
          key={selection}
          angle={creating ? null : open}
          personas={personas}
          products={products}
          conceptOptions={conceptOptions}
          conceptIds={openConcepts.map((record) => record.id)}
          creativeModules={openCreativeModules}
          concepts={openConcepts}
          creativeDesigns={openCreativeDesigns}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
