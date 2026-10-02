'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonaListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, StatusChip } from '@tas/ui';

import { useTableView, ViewToolbar, GalleryView, galleryItemsFrom } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import { TextCell } from '@/components/views/grid-cells';

import { awarenessLabel, awarenessTone, EM_DASH, PERSONA_FIELDS } from './fields';
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

/** The search reads the name, the linked angles and the awareness stage — the grid's own columns. */
function matches(item: PersonaItem, query: string): boolean {
  const { persona } = item;
  return [
    persona.name,
    persona.angleNames.join(' '),
    persona.stageOfAwareness === null ? '' : awarenessLabel(persona.stageOfAwareness),
  ].some((value) => value.toLowerCase().includes(query));
}

/**
 * The Airtable-style grid columns for the Personas grid view (P2A-3). The Stage-of-Awareness column
 * keeps rendering a `<StatusChip>` (never bare text) so the automation that counts the chips inside
 * the table stays green; the frozen name column leads, then the linked angles and every prose field
 * of the panel under the panel's own label (`PERSONA_FIELDS`), so a persona is readable end to end
 * without opening a row.
 *
 * NO PRODUCT COLUMN (Talal, 2026-09-28, AI-45: "Persona needs no links"). A persona reaches a
 * product through the angle that links both — `Product → Persona → Angle → Concept` — so a Product
 * column here invited a second, contradictory answer to the same question. `personas.product_id`
 * stays in the database: it holds imported Airtable data and this repo soft-deletes rather than
 * drops. It is simply no longer a column anyone reads.
 */
const PERSONA_COLUMNS: readonly GridColumn<PersonaItem>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 200,
    sortValue: (item) => item.persona.name,
    render: (item) => <span className="font-medium">{item.persona.name}</span>,
  },
  {
    key: 'stageOfAwareness',
    header: 'Stage of Awareness',
    sortValue: (item) => item.persona.stageOfAwareness,
    render: (item) =>
      item.persona.stageOfAwareness === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <StatusChip
          tone={awarenessTone(item.persona.stageOfAwareness)}
          label={awarenessLabel(item.persona.stageOfAwareness)}
        />
      ),
  },
  {
    key: 'angles',
    header: 'Linked angles',
    sortValue: (item) => item.persona.angleNames.length,
    render: (item) => <TextCell value={item.persona.angleNames.join(', ')} maxWidth={320} />,
  },
  // Every prose field of the panel, under the panel's own label, so nothing needs a row opened.
  ...PERSONA_FIELDS.filter(
    (field) => field.name !== 'name' && field.name !== 'stageOfAwareness',
  ).map((field): GridColumn<PersonaItem> => ({
    key: field.name,
    header: field.label,
    render: (item) => <TextCell value={item.persona[field.name]} />,
  })),
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

/** Every column key the Fields popover can toggle, and its label, in grid order (VIEWS-01). */
const FIELD_KEYS: readonly string[] = PERSONA_COLUMNS.map((column) => column.key);
const FIELD_OPTIONS = PERSONA_COLUMNS.map((column) => ({ key: column.key, label: column.header }));

export function PersonasWorkspace({
  items,
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
    fieldKeys: FIELD_KEYS,
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
      galleryItemsFrom(visible, PERSONA_COLUMNS, (item) => ({
        id: item.persona.id,
        name: item.persona.name,
        subtitle: item.persona.productName ?? undefined,
      })),
    [visible],
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
              fields={FIELD_OPTIONS}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              error={tableView.error}
            />
          </div>
        </div>
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
            columns={PERSONA_COLUMNS}
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
