'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyUserView, type UserViewConfig, type UserViewSort } from '@tas/domain';
import { cn } from '@tas/ui';

import {
  cycleSort,
  readHiddenColumns,
  sameOffsets,
  sortRows,
  stickyOffsets,
  toggleHidden,
  writeHiddenColumns,
  type SortState,
} from './airtable-grid-logic';
import { FieldsMenu } from './fields-menu';

/**
 * One column of the grid. `render` draws the cell inline (text, a coloured badge, a link count, a
 * checkbox icon — the caller decides); `sortValue`, when present, makes the header a sort toggle.
 * `frozen` pins the column to the left while the rest scroll horizontally.
 */
export interface GridColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly frozen?: boolean;
  readonly minWidth?: number;
  readonly align?: 'left' | 'right' | 'center';
  readonly render: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number | null;
  /** A tooltip for the whole cell — e.g. the full URL behind a truncated host. */
  readonly cellTitle?: (row: Row) => string | undefined;
}

export interface AirtableGridProps<Row> {
  /** Stable key for this table; the per-viewer hidden-column choice is remembered under it. */
  readonly tableKey: string;
  readonly columns: readonly GridColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowId: (row: Row) => string;
  readonly onRowClick?: (row: Row) => void;
  readonly selectedId?: string | null;
  readonly empty?: ReactNode;
  /** `data-slot` for the `<table>` — lets a page keep its existing test/automation hooks. */
  readonly tableSlot?: string;
  /** `data-slot` for each `<tr>` (default `grid-row`). */
  readonly rowSlot?: string;
  /** Extra attributes for each row (e.g. `data-product-id`), so a page's selectors survive the swap. */
  readonly rowAttributes?: (row: Row) => Readonly<Record<string, string | undefined>>;
  /** The accessible name of a clickable row (e.g. the record's name); falls back to the row id. */
  readonly rowLabel?: (row: Row) => string;
  /**
   * The viewer's active view (Sprint 7, VIEWS-01). When given, the grid is controlled by it: the
   * column order, visibility and freeze come from `applyUserView`, the sort is `view.sort`, and a
   * header click reports through `onSortChange` instead of changing local state. The Fields menu
   * then lives in the page's toolbar (it toggles the same view), so the grid renders none of its own.
   */
  readonly view?: UserViewConfig;
  readonly onSortChange?: (sort: UserViewSort | null) => void;
}

/**
 * An Airtable-style read-only grid (P2A): full-width, scrollable with every column visible, frozen
 * leading columns, click-to-sort headers, and a Fields menu to show/hide columns. Uncontrolled, the
 * hidden columns are remembered per browser; given a `view`, the viewer's saved view decides order,
 * visibility, freeze and sort (Sprint 7, VIEWS-01). Inline editing is intentionally out of scope.
 *
 * THE ROWS SCROLL INSIDE THE GRID, NOT THE PAGE (action item 22, "freeze rows/columns"). The grid is
 * a bounded scroll region, so the header row stays pinned at the top while you read down the table
 * and the frozen columns stay pinned at the left while you read across it — which is the whole
 * reason a column is frozen, and what the Airtable the team is leaving behind does. A sticky
 * `<thead>` needs a scrollport to stick inside, and the page cannot be it: the horizontal scroll
 * already makes this container one.
 *
 * MORE THAN ONE FROZEN COLUMN NEEDS REAL WIDTHS. A second sticky column pinned at `left: 0` would
 * sit on top of the first, so each frozen cell is offset by the measured width of the frozen cells
 * before it (`stickyOffsets`), read off the laid-out header row and re-read by a `ResizeObserver`
 * every time a cell's width changes — row data, not the column list, is what decides those widths.
 * Before the first measurement every frozen column is at `left: 0`, which is exactly where it
 * already is while the grid is unscrolled, so nothing jumps.
 */
export function AirtableGrid<Row>({
  tableKey,
  columns,
  rows,
  rowId,
  onRowClick,
  selectedId,
  empty,
  tableSlot = 'airtable-grid',
  rowSlot = 'grid-row',
  rowAttributes,
  rowLabel,
  view,
  onSortChange,
}: AirtableGridProps<Row>) {
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [frozenLefts, setFrozenLefts] = useState<Readonly<Record<string, number>>>({});
  const headRowRef = useRef<HTMLTableRowElement | null>(null);
  const controlled = view !== undefined;

  // Read the remembered hidden columns after mount only — localStorage is a client store, and reading
  // it during render would desync server and client HTML. A controlled grid reads its view instead.
  useEffect(() => {
    if (!controlled) setHidden(readHiddenColumns(tableKey));
  }, [controlled, tableKey]);

  const sort: SortState | null = controlled ? view.sort : localSort;

  const visibleColumns = useMemo(
    () =>
      controlled
        ? applyUserView(columns, view)
        : columns.filter((column) => !hidden.has(column.key)),
    [columns, controlled, hidden, view],
  );

  const sortedRows = useMemo(() => {
    if (sort === null) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (column?.sortValue === undefined) return rows;
    return sortRows(rows, column.sortValue, sort.direction);
  }, [rows, sort, columns]);

  const onHeaderClick = useCallback(
    (key: string) => {
      const next = cycleSort(sort, key);
      if (controlled) {
        onSortChange?.(next);
      } else {
        setLocalSort(next);
      }
    },
    [controlled, onSortChange, sort],
  );

  // Each frozen column's `left`, measured off the header row once it is laid out. A layout effect
  // rather than a plain one so the offsets land before the browser paints a scrolled grid.
  //
  // THE CELLS ARE OBSERVED, NOT THE COLUMN LIST. The table is auto-layout, so a column is exactly as
  // wide as its widest cell: row data decides the frozen widths, and row data changes without
  // `visibleColumns` ever changing — a `router.refresh()` after a side-panel save replaces every
  // row, and a search sits in its debounce for ~500ms before the view object takes a new identity.
  // Keying the measurement off `visibleColumns` alone would therefore leave `frozenLefts` holding
  // the widths of rows that are gone, which puts one frozen column on top of another: exactly the
  // overlap `stickyOffsets` exists to prevent. A `ResizeObserver` on the header row and on each of
  // its cells fires on every width change whatever caused it, so the offsets cannot go stale.
  useLayoutEffect(() => {
    const row = headRowRef.current;
    if (row === null) return;
    const measure = (): void => {
      const cells = [...row.children];
      const frozen = visibleColumns.flatMap((column, index) =>
        column.frozen === true ? [{ key: column.key, index }] : [],
      );
      const widths = frozen.map((entry) => {
        const cell = cells[entry.index];
        return cell instanceof HTMLElement ? cell.offsetWidth : 0;
      });
      const offsets = stickyOffsets(widths);
      const next = Object.fromEntries(
        frozen.map((entry, order) => [entry.key, offsets[order] ?? 0]),
      );
      // A new object every callback would re-render the grid on every observer tick, including the
      // one the observer fires just for starting; `sameOffsets` keeps the old value when nothing moved.
      setFrozenLefts((previous) => (sameOffsets(previous, next) ? previous : next));
    };
    measure();
    // Typed as optional the same way `store()` types `localStorage` in the logic module: the global
    // is genuinely absent in a non-browser environment, where the DOM lib's type would lie.
    const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (Observer === undefined) return;
    const observer = new Observer(measure);
    observer.observe(row);
    for (const cell of row.children) observer.observe(cell);
    return () => {
      observer.disconnect();
    };
  }, [visibleColumns]);

  const onToggleColumn = useCallback(
    (key: string) => {
      setHidden((previous) => {
        const next = toggleHidden(previous, key);
        writeHiddenColumns(tableKey, next);
        return next;
      });
    },
    [tableKey],
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {controlled ? null : (
        <div className="flex justify-end">
          <FieldsMenu
            fields={columns.map((column) => ({ key: column.key, label: column.header }))}
            isVisible={(key) => !hidden.has(key)}
            onToggle={onToggleColumn}
          />
        </div>
      )}

      {/* `scroll-pt-10` keeps the pinned header out of the way when a row is scrolled to: without
          it a row scrolled into view lands flush against the top edge, underneath the header. */}
      <div
        data-slot="grid-scroll"
        className="max-h-[70vh] w-full scroll-pt-10 overflow-auto rounded-card border border-line bg-surface"
      >
        <table className="w-full min-w-max border-collapse text-sm" data-slot={tableSlot}>
          {/* `z-20`, deliberately BELOW the app's own sticky top bar (`z-30` in
            `components/shell/top-bar.tsx`). Nothing between the two opens a stacking context, so a
            tie would be broken by DOM order and this header — later in the document — would paint
            over the brand switcher as soon as the page scrolls far enough. `z-20` still outranks the
            frozen body cells (`z-10` below), which is the only thing the header has to beat. */}
          <thead className="sticky top-0 z-20 bg-surface">
            <tr className="border-b border-line" ref={headRowRef}>
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  // The column's own key, so a header or cell can be addressed by WHICH column it
                  // is rather than by position. That matters now that order is configuration: a
                  // reorder in Column Admin is a data edit, and a test that counted `td` positions
                  // would start asserting the wrong column without anything in the page changing.
                  data-column={column.key}
                  style={{
                    minWidth: column.minWidth,
                    left: column.frozen === true ? (frozenLefts[column.key] ?? 0) : undefined,
                  }}
                  className={cn(
                    'px-3 py-2 text-left font-medium whitespace-nowrap text-text2',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.frozen && 'sticky z-20 border-r border-line bg-surface',
                  )}
                >
                  {column.sortValue === undefined ? (
                    column.header
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onHeaderClick(column.key);
                      }}
                      className="inline-flex items-center gap-1 hover:text-text"
                    >
                      {column.header}
                      <span aria-hidden className="text-text4">
                        {sort?.key === column.key ? (sort.direction === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-3 py-12 text-center text-sm text-text3"
                  data-slot="grid-empty"
                >
                  {empty ?? '✨ Nothing here yet.'}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const id = rowId(row);
                const clickable = onRowClick !== undefined;
                const activate = clickable
                  ? () => {
                      onRowClick(row);
                    }
                  : undefined;
                return (
                  <tr
                    key={id}
                    data-slot={rowSlot}
                    data-state={id === selectedId ? 'selected' : undefined}
                    {...rowAttributes?.(row)}
                    role={clickable ? 'button' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={rowLabel ? rowLabel(row) : clickable ? id : undefined}
                    onClick={activate}
                    onKeyDown={
                      clickable
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              activate?.();
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'border-b border-line/60 last:border-b-0 data-[state=selected]:bg-accent-soft',
                      clickable && 'cursor-pointer hover:bg-surface3',
                    )}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
                        data-column={column.key}
                        title={column.cellTitle?.(row)}
                        style={{
                          left: column.frozen === true ? (frozenLefts[column.key] ?? 0) : undefined,
                        }}
                        className={cn(
                          'px-3 py-1.5 whitespace-nowrap text-text2',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          column.frozen && 'sticky z-10 border-r border-line bg-surface text-text',
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
