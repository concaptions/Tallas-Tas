'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AiCharacterListRow } from '@tas/db';
import {
  Button,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import {
  aiCharacterStatusLabel,
  aiCharacterStatusTone,
  basicInfoPreview,
  countLabel,
  EM_DASH,
  EMPTY_LIBRARY_HINT,
  EMPTY_SEARCH_HINT_PREFIX,
  matchesAiCharacterSearch,
} from './fields';
import { AiCharacterPanel, NEW_AI_CHARACTER } from './ai-characters-panel';

/**
 * The AI Characters table and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the table stays visible and clickable
 * beside it, and there is no backdrop. The open character lives in the `?character=` query
 * parameter, written with the History API so opening a row is instant and a refresh still reopens
 * it. The filter is URL-backed the same way, in `?q=`. Shaped exactly like
 * `personas/personas-workspace.tsx` and `products/products-workspace.tsx`.
 */
export interface AiCharacterItem {
  readonly character: AiCharacterListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface AiCharactersWorkspaceProps {
  readonly items: readonly AiCharacterItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'character' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function AiCharactersWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
}: AiCharactersWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('character', id);
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

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    }
  };

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => items.filter((item) => matchesAiCharacterSearch(item.character, query)),
    [items, query],
  );

  const open = items.find((item) => item.character.id === selection)?.character ?? null;
  const creating = selection === NEW_AI_CHARACTER;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">AI Characters</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">AI Characters</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_AI_CHARACTER);
            }}
            data-slot="new-ai-character"
          >
            New character
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="ai-character-count">{countLabel(visible.length, items.length)}</span> —
          the personas AI-generated content speaks through.
        </p>
      </header>

      <section aria-labelledby="ai-characters-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="ai-characters-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name or basic info"
            aria-label="Search AI characters by name or basic info"
            data-slot="ai-character-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="ai-characters-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Status</TableHead>
                <TableHead className="px-3">Basic Info</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="px-3 py-10">
                    <div
                      data-slot="ai-characters-empty"
                      className="flex flex-col items-center gap-3 text-center"
                    >
                      <p className="text-sm text-text2">
                        {items.length === 0
                          ? EMPTY_LIBRARY_HINT
                          : `${EMPTY_SEARCH_HINT_PREFIX} “${term}”. Try a character name or a basic info snippet.`}
                      </p>
                      {items.length === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            select(NEW_AI_CHARACTER);
                          }}
                          data-slot="empty-new-ai-character"
                        >
                          New character
                        </Button>
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
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(({ character, updatedLabel, updatedTitle }) => (
                  <TableRow
                    key={character.id}
                    data-slot="ai-character-row"
                    data-ai-character-id={character.id}
                    data-state={character.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={character.name}
                    onClick={() => {
                      select(character.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, character.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                      {character.name}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      {character.status === null || character.status === '' ? (
                        <span className="text-text4">{EM_DASH}</span>
                      ) : (
                        <StatusChip
                          tone={aiCharacterStatusTone(character.status)}
                          label={aiCharacterStatusLabel(character.status)}
                        />
                      )}
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5 text-text2"
                      title={character.basicInfo ?? undefined}
                    >
                      {basicInfoPreview(character.basicInfo)}
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
        <AiCharacterPanel
          key={selection}
          character={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
