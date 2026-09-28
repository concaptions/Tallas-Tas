/**
 * Pure helpers for the Airtable-style grid (P2A). Kept out of the component so the sort and
 * column-visibility logic is unit-tested without rendering. The `localStorage` helpers are the only
 * impure part; they are wrapped so the grid works in SSR, private windows, and node tests where the
 * store is absent or throws.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  readonly key: string;
  readonly direction: SortDirection;
}

/**
 * A header click cycles a column through none → asc → desc → none. Clicking a different column
 * starts it fresh at ascending.
 */
export function cycleSort(current: SortState | null, key: string): SortState | null {
  if (current === null || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

/**
 * Sorts a copy of `rows` by a per-column accessor. Numbers compare numerically, everything else by
 * locale string order; nulls always sort last regardless of direction (an empty cell is not "before
 * A" nor "after Z" — it is simply not ranked).
 */
export function sortRows<Row>(
  rows: readonly Row[],
  sortValue: (row: Row) => string | number | null,
  direction: SortDirection,
): Row[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a);
    const bv = sortValue(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

/** Adds or removes a column key from the hidden set, returning a new set (never mutates the input). */
export function toggleHidden(hidden: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(hidden);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

const storageKey = (tableKey: string): string => `tas.grid.hidden.${tableKey}`;

/** `localStorage` typed as optional: it is genuinely absent in SSR, node tests and private windows,
 *  where the DOM lib's non-nullable type would otherwise lie. */
function store(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

/** The per-viewer hidden-column set for a table, or an empty set when none is stored or storage fails. */
export function readHiddenColumns(tableKey: string): ReadonlySet<string> {
  try {
    const raw = store()?.getItem(storageKey(tableKey));
    if (raw == null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

/** Persists the hidden-column set for a table; a no-op when storage is unavailable. */
export function writeHiddenColumns(tableKey: string, hidden: ReadonlySet<string>): void {
  try {
    store()?.setItem(storageKey(tableKey), JSON.stringify([...hidden]));
  } catch {
    /* private windows / disabled storage — the grid still works, it just won't remember. */
  }
}
