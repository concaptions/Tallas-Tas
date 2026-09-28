'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tas/ui';

import {
  cycleSort,
  readHiddenColumns,
  sortRows,
  toggleHidden,
  writeHiddenColumns,
  type SortState,
} from './airtable-grid-logic';

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
}

/**
 * An Airtable-style read-only grid (P2A): full-width, horizontally scrollable with every column
 * visible, a frozen primary column, click-to-sort headers, and a Fields menu to show/hide columns
 * (remembered per viewer). Inline editing is intentionally out of scope for this pass.
 */
export function AirtableGrid<Row>({
  tableKey,
  columns,
  rows,
  rowId,
  onRowClick,
  selectedId,
  empty,
}: AirtableGridProps<Row>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  // Read the remembered hidden columns after mount only — localStorage is a client store, and reading
  // it during render would desync server and client HTML.
  useEffect(() => {
    setHidden(readHiddenColumns(tableKey));
  }, [tableKey]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => !hidden.has(column.key)),
    [columns, hidden],
  );

  const sortedRows = useMemo(() => {
    if (sort === null) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (column?.sortValue === undefined) return rows;
    return sortRows(rows, column.sortValue, sort.direction);
  }, [rows, sort, columns]);

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
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" data-slot="grid-fields">
              Fields
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Show fields</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.key}
                checked={!hidden.has(column.key)}
                onCheckedChange={() => {
                  onToggleColumn(column.key);
                }}
                onSelect={(event) => {
                  event.preventDefault();
                }}
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="w-full overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-max border-collapse text-sm" data-slot="airtable-grid">
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
                        setSort((current) => cycleSort(current, column.key));
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
                return (
                  <tr
                    key={id}
                    data-slot="grid-row"
                    data-state={id === selectedId ? 'selected' : undefined}
                    onClick={
                      onRowClick === undefined
                        ? undefined
                        : () => {
                            onRowClick(row);
                          }
                    }
                    className={cn(
                      'border-b border-line/60 last:border-b-0 data-[state=selected]:bg-accent-soft',
                      onRowClick !== undefined && 'cursor-pointer hover:bg-surface3',
                    )}
                  >
                    {visibleColumns.map((column) => (
                      <td
                        key={column.key}
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
