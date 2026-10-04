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

/**
 * What one column offers a filter or a grouping: its key, and the readable value a cell carries.
 * Structurally a `GridColumn`, so the grid's own column list is passed straight in; declared
 * narrow here so the functions below stay pure and node-testable with three-line fixtures.
 */
export interface FilterableColumn<Row> {
  readonly key: string;
  readonly sortValue?: (row: Row) => string | number | null;
  readonly cellTitle?: (row: Row) => string | undefined;
}

/** One condition, shaped exactly as `UserViewConfig.filters` stores it (AI-32). */
export interface RowFilter {
  readonly field: string;
  readonly op: 'is' | 'is_not' | 'contains' | 'empty' | 'not_empty';
  readonly value: string;
}

/**
 * The text a filter or a grouping reads from one cell: the column's `sortValue` where it has one,
 * its `cellTitle` otherwise, and `null` — "this column cannot be read" — when it has neither.
 * Rendering is a ReactNode and deliberately NOT consulted: a filter is data logic, not a DOM scrape.
 */
function readCell<Row>(column: FilterableColumn<Row> | undefined, row: Row): string | null {
  if (column === undefined) return null;
  if (column.sortValue !== undefined) {
    const value = column.sortValue(row);
    return value === null ? '' : String(value);
  }
  if (column.cellTitle !== undefined) return column.cellTitle(row) ?? '';
  return null;
}

/** Whether a read cell is empty: nothing stored, or nothing but whitespace. */
function isEmptyCell(text: string): boolean {
  return text.trim() === '';
}

/**
 * The rows that pass a view's field conditions (AI-32), ANDed — every condition must hold, which
 * is what reading a filter list aloud means. Comparison is case-insensitive text over the value
 * `readCell` extracts, so 'is' matches what the viewer sees sorted, not an internal spelling.
 *
 * TWO DELIBERATE DEGRADES, both "to the default, never to nothing" (the house rule
 * `reconcileViewFields` set): a condition naming a column the table does not carry — a stored
 * filter from before an admin hid the column, or from before the resolver respelled it — is
 * IGNORED rather than failing every row, because a stale lens must not blank a grid; and a
 * condition on a column whose cells this grid cannot read (no `sortValue`, no `cellTitle`) is
 * ignored for the same reason. An empty condition list returns the rows untouched, same array.
 */
export function applyFilters<Row>(
  rows: readonly Row[],
  filters: readonly RowFilter[],
  columns: readonly FilterableColumn<Row>[],
): readonly Row[] {
  if (filters.length === 0) return rows;
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const live = filters.filter((filter) => {
    const column = byKey.get(filter.field);
    return (
      column !== undefined && (column.sortValue !== undefined || column.cellTitle !== undefined)
    );
  });
  if (live.length === 0) return rows;
  return rows.filter((row) =>
    live.every((filter) => {
      const text = readCell(byKey.get(filter.field), row) ?? '';
      const cell = text.toLowerCase();
      const wanted = filter.value.toLowerCase();
      switch (filter.op) {
        case 'is':
          return cell === wanted;
        case 'is_not':
          return cell !== wanted;
        case 'contains':
          return cell.includes(wanted);
        case 'empty':
          return isEmptyCell(text);
        case 'not_empty':
          return !isEmptyCell(text);
      }
    }),
  );
}

/** One group of rows under one value of the grouping column, already counted by `rows.length`. */
export interface RowGroup<Row> {
  /** The raw cell text shared by the group's rows; `''` is the empty-celled group. */
  readonly value: string;
  /** What the header row prints for the group; the empty group says so in words. */
  readonly label: string;
  readonly rows: readonly Row[];
}

/** What the header of the rows with nothing in the grouping column says. */
export const EMPTY_GROUP_LABEL = 'Empty';

/**
 * The rows bucketed under the grouping column's values (AI-32), in first-appearance order — the
 * rows arrive already sorted, so a sort on the grouping column is also the order of the groups,
 * and without one the groups sit where their first row sat. Values that differ only by case fold
 * into one group under the first spelling seen, matching how `applyFilters` compares.
 *
 * Returns `null` — "render flat" — when the column is unknown or unreadable, for the same reason
 * `applyFilters` ignores such a condition: a stale `group_by` must degrade to the flat grid, not
 * to one giant "Empty" bucket that looks like data.
 */
export function groupRows<Row>(
  rows: readonly Row[],
  groupBy: string,
  columns: readonly FilterableColumn<Row>[],
): readonly RowGroup<Row>[] | null {
  const column = columns.find((candidate) => candidate.key === groupBy);
  if (column === undefined || (column.sortValue === undefined && column.cellTitle === undefined)) {
    return null;
  }
  const groups = new Map<string, { value: string; rows: Row[] }>();
  for (const row of rows) {
    const text = readCell(column, row) ?? '';
    const normalised = isEmptyCell(text) ? '' : text;
    const key = normalised.toLowerCase();
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { value: normalised, rows: [row] });
    } else {
      existing.rows.push(row);
    }
  }
  return [...groups.values()].map((group) => ({
    value: group.value,
    label: group.value === '' ? EMPTY_GROUP_LABEL : group.value,
    rows: group.rows,
  }));
}

/**
 * Where each frozen column sits once the grid is scrolled sideways (action item 22).
 *
 * `position: sticky` pins a cell at the `left` it is given, so a second frozen column has to be
 * offset by the width of the first or the two sit on top of each other — which is exactly what the
 * grid did while every frozen cell was hardcoded to `left-0` and only ever one column was frozen.
 * Given the frozen columns' measured widths, in the viewer's own column order, this returns each
 * one's `left`: the first at 0 and every later one at the running total of the widths before it.
 * The widths are read off the laid-out header row; the arithmetic lives here so it is unit-tested
 * without a DOM.
 */
export function stickyOffsets(widths: readonly number[]): number[] {
  const offsets: number[] = [];
  let running = 0;
  for (const width of widths) {
    offsets.push(running);
    running += width;
  }
  return offsets;
}

/**
 * Whether two measured frozen-column offset maps say the same thing, so a re-measure that found
 * nothing new can hand the previous object straight back instead of re-rendering the grid.
 *
 * This matters because the grid re-measures from a `ResizeObserver`, which fires once the moment it
 * starts observing and again on every width change: without this guard each of those callbacks
 * would build a fresh object, and a fresh object is always a new state value to React.
 */
export function sameOffsets(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
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
