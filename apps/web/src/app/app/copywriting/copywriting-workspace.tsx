'use client';

import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { copyFunnelLabel } from '@tas/domain/copy';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import { CopyPanel } from './copy-panel';
import {
  COPY_COLUMNS,
  EM_DASH,
  NEW_COPY_SOON_HINT,
  NO_COPY_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  SELECTION_PARAM,
  copyCountLabel,
  filteredCopyCountLabel,
  matchesQuery,
  type CopyItem,
  type CreativeChoice,
} from './fields';

/**
 * The Copywriting table and its side panel (PRD §5.11, ticket criteria 1–4).
 *
 * The house pattern, mirrored from Personas: four columns, a click or Enter opens the row in a
 * panel fixed to the right edge, and the open row lives in `?copy=` written through the History API
 * so opening is instant and a refresh reopens it. The search lives in `?q=`, the same key every
 * other list page uses, so a narrowed list is a link someone can send.
 *
 * NOTHING IS RE-LABELLED HERE. `page.tsx` resolved the generated title, every status label and chip
 * tone, the linked creative's name and both timestamp strings through the domain before this
 * component saw a row; this file renders what it is handed and never compares a status to a literal.
 *
 * The first cell carries both values its header names: the generated Copy # in `font-mono`, and the
 * row's Headline under it — the words anyone actually scans for — with the muted em dash standing in
 * when a row has none, exactly as the Linked Creative cell does.
 *
 * The Linked Creative cell is the one cell with a second interaction in it: it links to the brief's
 * own page, so the click is stopped from also opening the panel. An unattached row renders the
 * muted em dash instead — the ordinary case, not a broken one.
 */
interface CopywritingWorkspaceProps {
  readonly items: readonly CopyItem[];
  readonly creatives: readonly CreativeChoice[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
}

/** Writes `?copy=` and `?q=` without a server round trip; Next.js reads the History API back. */
function syncUrl(selection: string | null, search: string): void {
  const url = new URL(window.location.href);
  if (selection === null) {
    url.searchParams.delete(SELECTION_PARAM);
  } else {
    url.searchParams.set(SELECTION_PARAM, selection);
  }
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function CopywritingWorkspace({
  items,
  creatives,
  demo,
  initialSelection,
  initialSearch,
}: CopywritingWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);

  const select = useCallback(
    (id: string | null) => {
      setSelection(id);
      syncUrl(id, search);
    },
    [search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(selection, next);
    },
    [selection],
  );

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const clearSearch = useCallback(() => {
    filter('');
  }, [filter]);

  const saved = useCallback(() => {
    router.refresh();
  }, [router]);

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    }
  };

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesQuery(item, query))),
    [items, query],
  );

  const narrowed = visible.length !== items.length;
  const open = items.find((item) => item.id === selection) ?? null;

  /**
   * "New copy" is a write, so demo mode disables it with the standard reason. It is disabled in
   * live mode too, with its own reason: creating a copy row is explicitly out of this ticket's
   * scope, so the button would have nothing to submit.
   */
  const newCopy = (slot: string) => (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_COPY_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot={slot}>
        New copy
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Copywriting</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Copywriting</h1>
          {newCopy('new-copy')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="copy-count">
            {narrowed
              ? filteredCopyCountLabel(visible.length, items.length)
              : copyCountLabel(items.length)}
          </span>{' '}
          — ad copy written separately, tied to the creative it runs against.
        </p>
      </header>

      <section aria-labelledby="copywriting-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="copywriting-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search copy"
            aria-label="Search copy by title, headline, body, creative or status"
            data-slot="copy-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        {visible.length === 0 ? (
          <div
            data-slot="copy-empty"
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
          >
            <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : NO_COPY_NOTE}</p>
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
              newCopy('empty-new-copy')
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <Table data-slot="copy-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COPY_COLUMNS.map((column) => (
                    <TableHead key={column} className="px-3">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item) => (
                  <TableRow
                    key={item.id}
                    data-slot="copy-row"
                    data-copy-id={item.id}
                    data-state={item.id === selection ? 'selected' : undefined}
                    role="button"
                    tabIndex={0}
                    aria-label={item.title}
                    onClick={() => {
                      select(item.id);
                    }}
                    onKeyDown={(event) => {
                      onRowKey(event, item.id);
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-1.5 align-top">
                      <span
                        data-slot="copy-row-title"
                        className="font-mono text-xs whitespace-nowrap text-text"
                      >
                        {item.title}
                      </span>
                      <span
                        data-slot="copy-row-headline"
                        className="mt-0.5 block text-xs whitespace-normal text-text3"
                      >
                        {item.headline ?? EM_DASH}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top whitespace-normal">
                      {item.creativeName === null || item.creativeHref === null ? (
                        <span data-slot="copy-row-unlinked" className="text-text3">
                          {EM_DASH}
                        </span>
                      ) : (
                        <Link
                          href={item.creativeHref}
                          data-slot="copy-row-creative"
                          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                            event.stopPropagation();
                          }}
                          className="inline-flex rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2 hover:border-accent-line hover:text-accent"
                        >
                          {item.creativeName}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top whitespace-nowrap text-text3">
                      {copyFunnelLabel(item.funnel)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 align-top">
                      <StatusChip tone={item.statusTone} label={item.statusLabel} />
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5 align-top whitespace-nowrap text-text3"
                      title={item.updatedTitle}
                    >
                      {item.updatedLabel}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {open === null ? null : (
        <CopyPanel
          key={open.id}
          item={open}
          creatives={creatives}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      )}
    </div>
  );
}
