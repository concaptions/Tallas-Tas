'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyUserView, type UserViewConfig, type UserViewSort } from '@tas/domain';
import { cn } from '@tas/ui';

import {
  cycleSort,
  readHiddenColumns,
  sortRows,
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
 * An Airtable-style read-only grid (P2A): full-width, horizontally scrollable with every column
 * visible, a frozen primary column, click-to-sort headers, and a Fields menu to show/hide columns.
 * Uncontrolled, the hidden columns are remembered per browser; given a `view`, the viewer's saved
 * view decides order, visibility, freeze and sort (Sprint 7, VIEWS-01). Inline editing is
 * intentionally out of scope.
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

      <div className="w-full overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-max border-collapse text-sm" data-slot={tableSlot}>
          <thead>
            <tr className="border-b border-line">
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.minWidth === undefined ? undefined : { minWidth: column.minWidth }}
                  className={cn(
                    'px-3 py-2 text-left font-medium whitespace-nowrap text-text2',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center',
                    column.frozen && 'sticky left-0 z-20 border-r border-line bg-surface',
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
                        title={column.cellTitle?.(row)}
                        className={cn(
                          'px-3 py-1.5 whitespace-nowrap text-text2',
                          column.align === 'right' && 'text-right',
                          column.align === 'center' && 'text-center',
                          column.frozen &&
                            'sticky left-0 z-10 border-r border-line bg-surface text-text',
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
