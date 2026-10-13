import type { ReactNode } from 'react';

import type { GridColumn } from './airtable-grid';

/**
 * The sidebar's read-only "every stored field" view (Ticket 9, part 1): takes the same
 * `GridColumn` list the grid draws and renders each cell under its header, so a page carries one
 * column definition and uses it in both places. `except` is the per-page skip list — the columns
 * the sidebar already prints in a dedicated row above (title, chips, etc.) and does not want to
 * see twice.
 */
export interface ReadOnlyFieldsProps<Row> {
  readonly columns: readonly GridColumn<Row>[];
  readonly row: Row;
  readonly except?: readonly string[];
  /** `data-slot` for the group — each field is `{slot}-field`. */
  readonly slot: string;
}

export function ReadOnlyFields<Row>({
  columns,
  row,
  except,
  slot,
}: ReadOnlyFieldsProps<Row>): ReactNode {
  const skip = new Set(except ?? []);
  return (
    <dl data-slot={slot} className="flex flex-col gap-3">
      {columns
        .filter((column) => !skip.has(column.key))
        .map((column) => (
          <div
            key={column.key}
            data-slot={`${slot}-field`}
            data-column={column.key}
            className="flex flex-col gap-1"
          >
            <dt className="font-mono text-[10px] tracking-widest text-text4 uppercase">
              {column.header}
            </dt>
            <dd className="text-sm text-text2">{column.render(row)}</dd>
          </div>
        ))}
    </dl>
  );
}
