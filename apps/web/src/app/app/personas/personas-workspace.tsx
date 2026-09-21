'use client';

import { useCallback, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { PersonaListRow } from '@tas/db';
import {
  Button,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

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
}

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

export function PersonasWorkspace({ items, demo, initialSelection }: PersonasWorkspaceProps) {
  const router = useRouter();
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

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    }
  };

  const open = items.find((item) => item.persona.id === selection)?.persona ?? null;
  const creating = selection === NEW_PERSONA;

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
            {items.length} {items.length === 1 ? 'persona' : 'personas'}
          </span>{' '}
          — the research every angle is written from.
        </p>
      </header>

      <section aria-labelledby="personas-heading" className="flex flex-col gap-3">
        <h2 id="personas-heading" className="text-sm font-medium text-text2">
          Library
        </h2>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="personas-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Stage of Awareness</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="px-3 py-6 text-center text-sm text-text3">
                    No personas yet. Start with the one your best customer looks like.
                  </TableCell>
                </TableRow>
              ) : (
                items.map(({ persona, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={persona.id}
                    data-slot="persona-row"
                    data-persona-id={persona.id}
                    data-state={persona.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={persona.name}
                    onClick={() => {
                      select(persona.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, persona.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      {persona.name}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      {persona.stageOfAwareness === null ? (
                        <span className="text-text4">{EM_DASH}</span>
                      ) : (
                        <StatusChip
                          tone={awarenessTone(persona.stageOfAwareness)}
                          label={awarenessLabel(persona.stageOfAwareness)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-text3" title={updatedTitle}>
                      {updatedLabel}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
