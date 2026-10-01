import type { ReactNode } from 'react';
import { StatusChip } from '@tas/ui';
import type { ChipTone } from '@tas/domain/state';

import { hostLabel } from '@/app/app/products/fields';

/**
 * The cell primitives every Airtable-style grid shares (P2A). A column's `render` composes these so
 * an empty value, a clamped paragraph, a yes/no, a chip list and a shortened URL read the same on
 * every one of the six tables. Nothing here knows a vocabulary: the caller resolves labels and tones
 * through `@tas/domain` and hands them in.
 */

/** The dash an empty cell shows, the same one every workspace table uses. */
export const GRID_EMPTY = '—';

/** A literal `"null"` / `"undefined"` stored as text is an import artefact, never a value to show. */
export function cellText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? '';
  if (text === '' || text === 'null' || text === 'undefined') return null;
  return text;
}

export function EmptyCell() {
  return <span className="text-text4">{GRID_EMPTY}</span>;
}

interface TextCellProps {
  readonly value: string | null | undefined;
  /** Caps the cell's width; the full text stays in the cell title. */
  readonly maxWidth?: number;
  readonly mono?: boolean;
}

/** A prose column: one line, clipped at `maxWidth`, whole text on hover. */
export function TextCell({ value, maxWidth = 280, mono = false }: TextCellProps) {
  const text = cellText(value);
  if (text === null) return <EmptyCell />;
  return (
    <span
      className={mono ? 'block truncate font-mono text-xs' : 'block truncate'}
      style={{ maxWidth }}
      title={text}
    >
      {text}
    </span>
  );
}

/** A checkbox column: a tick for true, the dash otherwise, named for a screen reader. */
export function BoolCell({ value }: { readonly value: boolean | null | undefined }) {
  if (value !== true) return <EmptyCell />;
  return (
    <span className="text-ok" role="img" aria-label="Yes">
      ✓
    </span>
  );
}

export interface GridChip {
  readonly label: string;
  readonly tone: ChipTone;
}

/** A single-select column as its chip, or the dash when unset. */
export function ChipCell({ chip }: { readonly chip: GridChip | null }) {
  if (chip === null) return <EmptyCell />;
  return <StatusChip tone={chip.tone} label={chip.label} />;
}

/** A multi-select column: every chip inline, the dash when there are none. */
export function ChipListCell({ chips }: { readonly chips: readonly GridChip[] }) {
  if (chips.length === 0) return <EmptyCell />;
  return (
    <span className="flex items-center gap-1">
      {chips.map((chip) => (
        <StatusChip key={chip.label} tone={chip.tone} label={chip.label} />
      ))}
    </span>
  );
}

/** A URL column: the host in mono, the whole URL in the cell title; the dash when unset. */
export function LinkCell({ value }: { readonly value: string | null | undefined }) {
  const url = cellText(value);
  if (url === null) return <EmptyCell />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={url}
      className="font-mono text-xs text-text2 underline decoration-line hover:text-text"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {hostLabel(url) ?? url}
    </a>
  );
}

/** A count column (`3 links`): the number in mono, the dash at zero. */
export function CountCell({
  count,
  noun,
}: {
  readonly count: number;
  readonly noun: string;
}): ReactNode {
  if (count === 0) return <EmptyCell />;
  return (
    <span className="font-mono text-xs">
      {String(count)} {count === 1 ? noun : `${noun}s`}
    </span>
  );
}

/** A date column: `YYYY-MM-DD` in UTC, identical on server and client; the dash when unset. */
export function DateCell({ value }: { readonly value: Date | string | null | undefined }) {
  if (value === null || value === undefined) return <EmptyCell />;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return <EmptyCell />;
  return <span className="font-mono text-xs">{date.toISOString().slice(0, 10)}</span>;
}

/** A money column, whole dollars; the dash when unset. */
export function MoneyCell({ value }: { readonly value: number | null | undefined }) {
  if (value === null || value === undefined) return <EmptyCell />;
  return <span className="font-mono text-xs">${String(value)}</span>;
}
