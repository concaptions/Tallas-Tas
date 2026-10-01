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

import { ViewSwitcher, KanbanBoard, type KanbanItem } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
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
  readonly personas: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly creativeModulesByAngle: LinkedIndex;
  readonly conceptsByAngle: LinkedIndex;
  readonly creativeDesignsByAngle: LinkedIndex;
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
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
 * The Airtable-style grid columns for Angles: every stored field of `angles` plus the two linked
 * names, in the order the panel groups them. Name is frozen; Persona and Product keep their chips
 * (the whole linked name in the cell title); every vocabulary value goes through `@tas/domain`.
 */
const ANGLE_COLUMNS: readonly GridColumn<AngleItem>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 220,
    sortValue: (item) => item.angle.name,
    render: (item) => <span className="font-medium">{item.angle.name}</span>,
  },
  {
    key: 'persona',
    header: 'Persona',
    sortValue: (item) => item.angle.personaName,
    cellTitle: (item) => item.angle.personaName ?? undefined,
    render: (item) => (
      <ChipCell
        chip={
          item.angle.personaName === null
            ? null
            : { label: chipLabel(item.angle.personaName), tone: PERSONA_CHIP_TONE }
        }
      />
    ),
  },
  {
    key: 'product',
    header: 'Product',
    sortValue: (item) => item.angle.productName,
    cellTitle: (item) => item.angle.productName ?? undefined,
    render: (item) => (
      <ChipCell
        chip={
          item.angle.productName === null
            ? null
            : { label: chipLabel(item.angle.productName), tone: PRODUCT_CHIP_TONE }
        }
      />
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (item) => angleStatusView(item.angle.status)?.label ?? null,
    render: (item) => {
      const view = angleStatusView(item.angle.status);
      return <ChipCell chip={view === null ? null : { label: view.label, tone: view.tone }} />;
    },
  },
  {
    key: 'potential',
    header: 'Potential',
    sortValue: (item) => item.angle.potential,
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
  },
  {
    key: 'winning',
    header: 'Winning',
    align: 'center',
    sortValue: (item) => (item.angle.winning ? 1 : 0),
    render: (item) => <BoolCell value={item.angle.winning} />,
  },
  {
    key: 'formats',
    header: 'Formats to create',
    render: (item) => (
      <ChipListCell
        chips={angleFormatEntries(item.angle.formats).map((entry) => ({
          label: entry.label,
          tone: FORMAT_CHIP_TONE,
        }))}
      />
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (item) => (
      <ChipListCell
        chips={angleTypeEntries(item.angle.type).map((entry) => ({
          label: entry.label,
          tone: 'mute',
        }))}
      />
    ),
  },
  {
    key: 'description',
    header: 'Description',
    sortValue: (item) => item.angle.description,
    render: (item) => <TextCell value={item.angle.description} />,
  },
  {
    key: 'painPoints',
    header: 'Pain Points',
    render: (item) => <TextCell value={item.angle.painPoints} />,
  },
  { key: 'usp', header: 'USP', render: (item) => <TextCell value={item.angle.usp} /> },
  {
    key: 'adInspo',
    header: 'Ad Inspo',
    sortValue: (item) => item.angle.adInspoLinks.length,
    render: (item) => <CountCell count={item.angle.adInspoLinks.length} noun="link" />,
  },
  {
    key: 'briefUrl',
    header: 'Brief URL',
    render: (item) => <LinkCell value={item.angle.briefUrl} />,
  },
  {
    key: 'exactScriptUrl',
    header: 'Exact Script URL',
    render: (item) => <LinkCell value={item.angle.exactScriptUrl} />,
  },
  {
    key: 'internalNotes',
    header: 'Internal Notes',
    render: (item) => <TextCell value={item.angle.internalNotes} />,
  },
  {
    key: 'clientNotes',
    header: 'Client Notes',
    render: (item) => <TextCell value={item.angle.clientNotes} />,
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

export function AnglesWorkspace({
  items,
  personas,
  products,
  creativeModulesByAngle,
  conceptsByAngle,
  creativeDesignsByAngle,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
}: AnglesWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('angle', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
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
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.angle.id === selection)?.angle ?? null;
  const creating = selection === NEW_ANGLE;
  const openCreativeModules = linkedTo(creativeModulesByAngle, open);
  const openConcepts = linkedTo(conceptsByAngle, open);
  const openCreativeDesigns = linkedTo(creativeDesignsByAngle, open);

  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return visible.map(({ angle }) => ({
      id: angle.id,
      name: angle.name,
      groupValue: angle.potential ?? '',
      subtitle: angle.personaName ?? undefined,
    }));
  }, [visible]);

  const kanbanColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const item of kanbanItems) {
      if (item.groupValue !== '') seen.add(item.groupValue);
    }
    return [...seen];
  }, [kanbanItems]);

  const kanbanLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const col of kanbanColumns) {
      labels[col] = col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return labels;
  }, [kanbanColumns]);

  const handleKanbanMove = useCallback(() => {
    // Kanban drag for angles will be wired to updateAngleAction in a follow-up
  }, []);

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
            {visible.length === items.length
              ? `${String(items.length)} ${items.length === 1 ? 'angle' : 'angles'}`
              : `${String(visible.length)} of ${String(items.length)} angles`}
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
            <ViewSwitcher
              tableKey="angles"
              supportedViews={[...ANGLES_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="potential"
            />
          </div>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search angle, persona or product"
            aria-label="Search angles by name, persona or product"
            data-slot="angle-search"
            className="h-8 w-full sm:w-72"
          />
        </div>

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            demo={demo}
          />
        ) : (
          <AirtableGrid
            tableKey="angles"
            columns={ANGLE_COLUMNS}
            rows={visible}
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
