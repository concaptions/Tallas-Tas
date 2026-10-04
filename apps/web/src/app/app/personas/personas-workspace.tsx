'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonaListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input } from '@tas/ui';

import {
  ColumnNotices,
  useTableView,
  ViewToolbar,
  GalleryView,
  galleryItemsFrom,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ColumnRenderer,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { ChipCell, TextCell, type GridChip } from '@/components/views/grid-cells';

import { awarenessLabel, awarenessTone, type PersonaFieldName } from './fields';
import { PersonaPanel, NEW_PERSONA } from './persona-panel';

/**
 * The Personas table and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open persona lives in the `?persona=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it.
 */
export interface PersonaItem {
  readonly persona: PersonaListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
  /** The angles linked through `angle_personas`, by id, for the panel's two-way field (LINK-01). */
  readonly angleIds?: readonly string[];
}

interface PersonasWorkspaceProps {
  readonly items: readonly PersonaItem[];
  /**
   * The brand's Personas columns, as `resolveColumns` returned them: label, order and visibility,
   * resolved from `column_definitions` on the server. This component chooses nothing about them —
   * it supplies the RENDERING and nothing else.
   */
  readonly columns: readonly ResolvedColumnView[];
  /**
   * True when `columns` is the parent template's master set served as a FALLBACK, because this
   * brand resolved none of its own. The page says so rather than passing a fallback off as the
   * brand's configuration — the counterpart of the `missing` notice, for the other direction.
   */
  readonly unconfiguredColumns?: boolean;
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
  /** The brand's angles, for the panel's two-way Linked angles field. */
  readonly angleOptions?: readonly { readonly id: string; readonly name: string }[];
}

const PERSONAS_CAP = getTableCapability('personas') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/** Writes `?persona=` without a server round trip; Next.js reads the History API back. */
function syncUrl(id: string | null): void {
  const url = new URL(window.location.href);
  if (id === null) {
    url.searchParams.delete('persona');
  } else {
    url.searchParams.set('persona', id);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** Writes `?q=` the same way, so the filter survives a refresh and is a shareable link. */
function syncSearch(query: string): void {
  const url = new URL(window.location.href);
  if (query === '') {
    url.searchParams.delete('q');
  } else {
    url.searchParams.set('q', query);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The search reads what the grid shows: name, product, linked angles and the awareness stage. */
function matches(item: PersonaItem, query: string): boolean {
  const { persona } = item;
  return [
    persona.name,
    persona.productName ?? '',
    persona.angleNames.join(' '),
    persona.stageOfAwareness === null ? '' : awarenessLabel(persona.stageOfAwareness),
  ].some((value) => value.toLowerCase().includes(query));
}

/** Every persona field that holds plain text — `stage_of_awareness` is the enum, drawn as a chip. */
type PersonaProseField = Exclude<PersonaFieldName, 'stageOfAwareness'>;

/** A prose column: one clipped line, the whole value in the cell title. */
function prose(field: PersonaProseField): ColumnRenderer<PersonaItem> {
  return { render: (item) => <TextCell value={item.persona[field]} /> };
}

function awarenessChip(persona: PersonaListRow): GridChip | null {
  const stage = persona.stageOfAwareness;
  return stage === null ? null : { label: awarenessLabel(stage), tone: awarenessTone(stage) };
}

/**
 * THE Personas renderer registry, keyed by the resolver's `column_key` (the Postgres column, or the
 * junction table for a link column).
 *
 * This replaces the hand-written `PERSONA_COLUMNS` array, and the difference is the whole point:
 * there is no header string and no ordering here. Labels, order and visibility arrive as data from
 * `column_definitions`; this says only how a cell is DRAWN, which is the part that cannot be
 * expressed as data — a chip whose tone comes from the awareness vocabulary, a joined link list, a
 * clipped paragraph. `gridColumnsFrom` joins the two.
 *
 * It deliberately covers EVERY persona column, not the set any one brand shows: the parent template
 * carries fifteen, Gratsi detaches six of them and adds `passion`, and a brand that unhides
 * `trigger_words` tomorrow must get a drawn column without a deployment. A resolved column with no
 * entry here comes back in `missing` and is reported on the page rather than dropped.
 */
export const PERSONA_RENDERERS: ColumnRegistry<PersonaItem> = {
  name: {
    render: (item) => <span className="font-medium">{item.persona.name}</span>,
    sortValue: (item) => item.persona.name,
  },
  day_in_the_life: prose('dayInTheLife'),
  demographic: prose('demographic'),
  psychographic: prose('psychographic'),
  core_desires: prose('coreDesires'),
  passion: prose('passion'),
  emotional_triggers: prose('emotionalTriggers'),
  pain_points: prose('painPoints'),
  success_factors: prose('successFactors'),
  perceived_barriers: prose('perceivedBarriers'),
  buying_triggers: prose('buyingTriggers'),
  problem_challenge: prose('problemChallenge'),
  success_transformation: prose('successTransformation'),
  trigger_words: prose('triggerWords'),
  // The awareness stage keeps rendering through `StatusChip` (never bare text), so the automation
  // that counts the chips inside the table stays green.
  stage_of_awareness: {
    render: (item) => <ChipCell chip={awarenessChip(item.persona)} />,
    sortValue: (item) => item.persona.stageOfAwareness,
  },
  // A junction, not a column: the names of the angles written from this persona.
  angle_personas: {
    render: (item) => <TextCell value={item.persona.angleNames.join(', ')} maxWidth={320} />,
    sortValue: (item) => item.persona.angleNames.length,
  },
};

export function PersonasWorkspace({
  items,
  columns,
  unconfiguredColumns = false,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  userViews,
  angleOptions = [],
}: PersonasWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [selection, setSelection] = useState<string | null>(initialSelection);

  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, PERSONA_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 200,
      }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, and its label, in resolved order (VIEWS-01). */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl(id);
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

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncSearch(next);
  }, []);

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'personas',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    initialViewType: initialView,
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

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const openItem = items.find((item) => item.persona.id === selection) ?? null;
  const open = openItem?.persona ?? null;
  const creating = selection === NEW_PERSONA;

  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(visible, grid.columns, (item) => ({
        id: item.persona.id,
        name: item.persona.name,
        subtitle: item.persona.productName ?? undefined,
      })),
    [visible, grid],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Personas</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Personas</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_PERSONA);
            }}
            data-slot="new-persona"
          >
            New persona
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="persona-count">
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'persona' : 'personas'}`
              : `${String(visible.length)} of ${String(items.length)} personas`}
          </span>{' '}
          — the research every angle is written from.
        </p>
      </header>

      <section aria-labelledby="personas-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="personas-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                onSearch(event.target.value);
              }}
              placeholder="Search name, product, angle or stage"
              aria-label="Search personas"
              data-slot="persona-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewToolbar
              tableKey="personas"
              supportedViews={[...PERSONAS_CAP.supportedViews]}
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
              error={tableView.error}
            />
          </div>
        </div>
        {/* The brand resolved no columns at all, so what is on screen is the parent template's
            master set, not this brand's configuration. Stated for the same reason as the notice
            below: a fallback shown silently would read as a configuration that does not exist. */}
        <ColumnNotices
          slotPrefix="persona"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="PERSONA_RENDERERS in personas-workspace.tsx"
        />
        {activeView === 'gallery' ? (
          <GalleryView
            items={galleryItems}
            visibleFields={tableView.config.visibleFields}
            selectedId={selection}
            cardSlot="persona-card"
            onItemClick={(item) => {
              select(item.id);
            }}
          />
        ) : (
          <AirtableGrid
            tableKey="personas"
            view={tableView.config}
            onSortChange={tableView.setSort}
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.persona.id}
            rowLabel={(item) => item.persona.name}
            rowAttributes={(item) => ({ 'data-persona-id': item.persona.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.persona.id);
            }}
            tableSlot="personas-table"
            rowSlot="persona-row"
            empty="No personas yet. Start with the one your best customer looks like."
          />
        )}
      </section>

      {creating || open !== null ? (
        <PersonaPanel
          key={selection}
          persona={creating ? null : open}
          columns={columns}
          angles={angleOptions}
          angleIds={openItem?.angleIds ?? []}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
