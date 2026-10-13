'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { applyUserView, type UserViewConfig, type UserViewSort } from '@tas/domain';
import { Checkbox, cn } from '@tas/ui';

import {
  cycleSort,
  groupRows,
  headerSelectionState,
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
  /**
   * Multi-select (Oct 12 scope 3). When given, a checkbox column leads every row and the header
   * carries the none / some / all state over the rows on screen. The grid owns no selection: it
   * reports a row's toggle and the header's, and the page keeps the set.
   */
  readonly selection?: {
    readonly selected: ReadonlySet<string>;
    readonly onToggle: (id: string) => void;
    readonly onToggleAll: (visibleIds: readonly string[]) => void;
  };
  /** A right-click on a row, with the pointer position the page opens its menu at. */
  readonly onRowContextMenu?: (
    row: Row,
    position: { readonly x: number; readonly y: number },
  ) => void;
  /**
   * The row whose context menu is up (B3.V5). The page holds the menu; the grid only learns which
   * row it belongs to, so that row keeps a `surface3` wash while the pointer is on the menu.
   */
  readonly contextRowId?: string | null;
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
  selection,
  onRowContextMenu,
  contextRowId = null,
}: AirtableGridProps<Row>) {
  const [localSort, setLocalSort] = useState<SortState | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [frozenLefts, setFrozenLefts] = useState<Readonly<Record<string, number>>>({});
  const headRowRef = useRef<HTMLTableRowElement | null>(null);
  const controlled = view !== undefined;
  const selectionColumn = selection === undefined ? 0 : 1;

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

  /**
   * The grid's row groups (AI-32), or null for the flat reading. Grouping runs over the FULL
   * column list, not the visible one, so a viewer can group under a column they have hidden —
   * the heading carries the value, which is exactly why hiding the column is reasonable. A
   * `group_by` naming a column this grid does not carry or cannot read comes back null from
   * `groupRows`: the stale lens degrades to the flat grid, never to one giant bucket. The rows
   * arrive sorted, so a sort on the grouping column also orders the groups.
   */
  const groups = useMemo(() => {
    const groupBy = view?.groupBy ?? null;
    if (groupBy === null) return null;
    return groupRows(sortedRows, groupBy, columns);
  }, [columns, sortedRows, view]);

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
      // The selection column, when present, is the first cell and is pinned at 0 itself; the
      // frozen data columns start after it and are offset by its width like any frozen cell.
      const cells = [...row.children];
      const frozen = visibleColumns.flatMap((column, index) =>
        column.frozen === true ? [{ key: column.key, index: index + selectionColumn }] : [],
      );
      const selectWidth =
        selectionColumn === 1 && cells[0] instanceof HTMLElement ? cells[0].offsetWidth : 0;
      const widths = frozen.map((entry) => {
        const cell = cells[entry.index];
        return cell instanceof HTMLElement ? cell.offsetWidth : 0;
      });
      const offsets = stickyOffsets(widths);
      const next = Object.fromEntries(
        frozen.map((entry, order) => [entry.key, (offsets[order] ?? 0) + selectWidth]),
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
  }, [visibleColumns, selectionColumn]);

  const visibleIds = useMemo(() => sortedRows.map(rowId), [sortedRows, rowId]);
  const headerState =
    selection === undefined ? 'none' : headerSelectionState(selection.selected, visibleIds);

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

  /** One data row, used by the flat reading and by every group alike. */
  const renderRow = (row: Row): ReactNode => {
    const id = rowId(row);
    const clickable = onRowClick !== undefined;
    const activate = clickable
      ? () => {
          onRowClick(row);
        }
      : undefined;
    const checked = selection?.selected.has(id) === true;
    return (
      <tr
        key={id}
        data-slot={rowSlot}
        data-state={id === selectedId ? 'selected' : undefined}
        data-checked={selection === undefined ? undefined : checked ? 'true' : 'false'}
        data-context={id === contextRowId ? 'open' : undefined}
        {...rowAttributes?.(row)}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={rowLabel ? rowLabel(row) : clickable ? id : undefined}
        onClick={activate}
        onContextMenu={
          onRowContextMenu === undefined
            ? undefined
            : (event) => {
                event.preventDefault();
                onRowContextMenu(row, { x: event.clientX, y: event.clientY });
              }
        }
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
        // Three row states, each legible against the others (B3.V5, ruling 14): the OPEN row is
        // `surface3` with the inset accent bar, a CHECKED row is the accent wash with the same bar,
        // and the row whose context menu is up is `surface3` alone.
        className={cn(
          'group border-b border-line/60 last:border-b-0',
          'data-[state=selected]:bg-surface3 data-[state=selected]:shadow-[inset_3px_0_0_var(--accent)]',
          'data-[context=open]:bg-surface3',
          clickable && 'cursor-pointer hover:bg-surface3',
          checked && 'bg-accent-soft/60 shadow-[inset_3px_0_0_var(--accent)]',
        )}
      >
        {selection === undefined ? null : (
          <td
            data-column="__select"
            // A sticky cell paints its own opaque surface over the row, so the row state and the
            // 3px bar are drawn here too (a `before` bar; a solid mix for the wash, so nothing
            // scrolling underneath shows through).
            className={cn(
              'sticky left-0 z-10 w-9 border-r border-line bg-surface px-2 py-1.5 text-center',
              'relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent',
              'group-data-[state=selected]:bg-surface3 group-data-[state=selected]:before:bg-accent',
              'group-data-[context=open]:bg-surface3',
              checked && 'bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))] before:bg-accent',
            )}
            onClick={(event) => {
              // The checkbox is not a row click: ticking a row never opens it.
              event.stopPropagation();
            }}
          >
            <Checkbox
              checked={checked}
              aria-label={`Select ${rowLabel ? rowLabel(row) : id}`}
              data-slot="row-select"
              onChange={() => {
                selection.onToggle(id);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
              className="align-middle"
            />
          </td>
        )}
        {visibleColumns.map((column) => (
          <td
            key={column.key}
            data-column={column.key}
            title={column.cellTitle?.(row)}
            style={{
              left: column.frozen === true ? (frozenLefts[column.key] ?? 0) : undefined,
            }}
            // `py-2.5` is the boards' 42px data row (B3.V12, product-wide); a checked row's text
            // steps up to `--text` (B3.A11) — on the cell, because the cell sets its own colour.
            className={cn(
              'px-3 py-2.5 whitespace-nowrap text-text2',
              column.align === 'right' && 'text-right',
              column.align === 'center' && 'text-center',
              column.frozen && 'sticky z-10 border-r border-line bg-surface text-text',
              column.frozen &&
                'group-data-[state=selected]:bg-surface3 group-data-[context=open]:bg-surface3',
              column.frozen && checked && 'bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))]',
              checked && 'text-text',
            )}
          >
            {column.render(row)}
          </td>
        ))}
      </tr>
    );
  };

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
          <thead className="sticky top-0 z-20 bg-surface2">
            <tr className="border-b border-line" ref={headRowRef}>
              {selection === undefined ? null : (
                <th
                  scope="col"
                  data-column="__select"
                  className="sticky left-0 z-20 w-9 border-r border-line bg-surface2 px-2 py-2 text-center"
                >
                  <Checkbox
                    checked={headerState === 'all'}
                    indeterminate={headerState === 'some'}
                    aria-label={
                      headerState === 'all'
                        ? 'Clear the rows on screen'
                        : 'Select every row on screen'
                    }
                    data-slot="select-all"
                    data-state={headerState}
                    onChange={() => {
                      selection.onToggleAll(visibleIds);
                    }}
                    className="align-middle"
                  />
                </th>
              )}
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
                  // The boards' column header on every grid (B3.V11, product-wide): 10px / 600 /
                  // uppercase / wide tracking in `--text4` on `--surface2`.
                  className={cn(
                    'px-3 py-2 text-left text-[10px] font-semibold tracking-widest whitespace-nowrap text-text4 uppercase',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.frozen && 'sticky z-20 border-r border-line bg-surface2',
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
                  colSpan={visibleColumns.length + selectionColumn}
                  className="px-3 py-12 text-center text-sm text-text3"
                  data-slot="grid-empty"
                >
                  {empty ?? '✨ Nothing here yet.'}
                </td>
              </tr>
            ) : groups !== null ? (
              groups.map((group) => (
                <Fragment key={`group-${group.value}`}>
                  {/* One header row per group (AI-32): the value and its count. The inner div is
                      sticky-left so the heading stays readable while the grid scrolls sideways. */}
                  <tr
                    data-slot="grid-group-header"
                    data-group={group.value}
                    className="border-b border-line bg-surface2"
                  >
                    <td colSpan={visibleColumns.length + selectionColumn} className="p-0">
                      <div className="sticky left-0 flex w-fit max-w-full items-baseline gap-2 px-3 py-1.5">
                        <span className="text-xs font-semibold text-text2">{group.label}</span>
                        <span className="font-mono text-[10px] text-text3" data-slot="group-count">
                          {group.rows.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {group.rows.map((row) => renderRow(row))}
                </Fragment>
              ))
            ) : (
              sortedRows.map((row) => renderRow(row))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
