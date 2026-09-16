'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AngleListRow } from '@tas/db';
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

import { AnglePanel, NEW_ANGLE, type LinkOption } from './angle-panel';
import {
  EM_DASH,
  FORMAT_CHIP_TONE,
  PERSONA_CHIP_TONE,
  PRODUCT_CHIP_TONE,
  chipLabel,
  formatChipRow,
  overflowLabel,
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
 * Five columns and no sort: `loadAngles()` already returns the rows newest edit first.
 */
export interface AngleItem {
  readonly angle: AngleListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface AnglesWorkspaceProps {
  readonly items: readonly AngleItem[];
  /** The brand's personas and products, loaded by the page for the panel's two dropdowns. */
  readonly personas: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

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

export function AnglesWorkspace({
  items,
  personas,
  products,
  demo,
  initialSelection,
  initialSearch,
}: AnglesWorkspaceProps) {
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
    () => (query === '' ? items : items.filter((item) => matches(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.angle.id === selection)?.angle ?? null;
  const creating = selection === NEW_ANGLE;

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
          <h2 id="angles-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
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

        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <Table data-slot="angles-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Persona</TableHead>
                <TableHead className="px-3">Product</TableHead>
                <TableHead className="px-3">Formats</TableHead>
                <TableHead className="px-3">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="px-3 py-10">
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
                  </TableCell>
                </TableRow>
              ) : (
                visible.map(({ angle, updatedLabel, updatedTitle }) => {
                  const chips = formatChipRow(angle.formats);
                  return (
                    <TableRow
                      key={angle.id}
                      data-slot="angle-row"
                      data-angle-id={angle.id}
                      data-state={angle.id === selection ? 'selected' : undefined}
                      role="button"
                      tabIndex={0}
                      aria-label={angle.name}
                      onClick={() => {
                        select(angle.id);
                      }}
                      onKeyDown={(event) => {
                        onRowKey(event, angle.id);
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell className="px-3 py-1.5 font-medium whitespace-normal text-text">
                        {angle.name}
                      </TableCell>
                      <TableCell className="px-3 py-1.5" title={angle.personaName ?? undefined}>
                        {angle.personaName === null ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <StatusChip
                            tone={PERSONA_CHIP_TONE}
                            label={chipLabel(angle.personaName)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1.5" title={angle.productName ?? undefined}>
                        {angle.productName === null ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <StatusChip
                            tone={PRODUCT_CHIP_TONE}
                            label={chipLabel(angle.productName)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        {chips.shown.length === 0 ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <span className="flex flex-nowrap items-center gap-1">
                            {chips.shown.map((entry) => (
                              <StatusChip
                                key={entry.key}
                                tone={FORMAT_CHIP_TONE}
                                label={entry.label}
                              />
                            ))}
                            {chips.overflow === 0 ? null : (
                              <StatusChip
                                tone="mute"
                                label={overflowLabel(chips.overflow)}
                                className="shrink-0"
                              />
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-text3" title={updatedTitle}>
                        {updatedLabel}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {creating || open !== null ? (
        <AnglePanel
          key={selection}
          angle={creating ? null : open}
          personas={personas}
          products={products}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
