'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonaListRow } from '@tas/db';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, StatusChip } from '@tas/ui';

import { ViewSwitcher, KanbanBoard, type KanbanItem } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import type { AwarenessStage } from '@tas/db/schema';

import { awarenessLabel, awarenessTone, EM_DASH } from './fields';
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
}

interface PersonasWorkspaceProps {
  readonly items: readonly PersonaItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
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

/**
 * The Airtable-style grid columns for the Personas grid view (P2A-3). The Stage-of-Awareness column
 * keeps rendering a `<StatusChip>` (never bare text) so the automation that counts the chips inside
 * the table stays green; the frozen name column and the headers are unchanged from the plain table.
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
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

export function PersonasWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
}: PersonasWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

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

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.persona.id === selection)?.persona ?? null;
  const creating = selection === NEW_PERSONA;

  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return visible.map(({ persona }) => ({
      id: persona.id,
      name: persona.name,
      groupValue: persona.stageOfAwareness ?? '',
      chipLabel: persona.stageOfAwareness ? awarenessLabel(persona.stageOfAwareness) : undefined,
      chipTone: persona.stageOfAwareness ? awarenessTone(persona.stageOfAwareness) : undefined,
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
      labels[col] = awarenessLabel(col as AwarenessStage);
    }
    return labels;
  }, [kanbanColumns]);

  const handleKanbanMove = useCallback(() => {
    // Kanban drag for personas will be wired to updatePersonaAction in a follow-up
  }, []);

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
                filter(event.target.value);
              }}
              placeholder="Search name, product, angle or stage"
              aria-label="Search personas"
              data-slot="persona-search"
              className="h-8 w-full sm:w-64"
            />
            <ViewSwitcher
              tableKey="personas"
              supportedViews={[...PERSONAS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="stageOfAwareness"
            />
          </div>
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
            tableKey="personas"
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
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
