/**
 * Columns that are "retired on the UI" but still carry data in the live database. A retired column
 * no longer has a renderer on any resolver-driven page, so the Column Admin's `missing` notice
 * (the grey `<page>-missing-columns` box) would otherwise light up on every brand that still
 * carries a `column_definitions` row for the key — a false alarm about a column we deliberately
 * stopped drawing.
 *
 * The list filters AT the loader (`loadResolvedColumns` in `apps/web/src/lib/resolved-columns-
 * source.ts`), so a retired key never reaches the grid adapter and never shows up as `missing`.
 * The DB column itself is kept until the drop migration runs — the data has not yet been archived,
 * and brands may still reference it in reports.
 *
 * TODO: migration 0072 drops these DB columns from `creative_briefs` (and from
 * `creative_sheet_items`, if present) once Talal signs off on the archive; remove the row from
 * `RETIRED_COLUMNS` in the same change that drops the column.
 */

export interface RetiredColumn {
  /** The `column_definitions.table_key` the retirement applies to. */
  readonly tableName: string;
  /** The `column_definitions.column_key` of the retired column. */
  readonly columnName: string;
}

/**
 * The retired-column roster. First entry: `elements_we_are_testing` on `creative_briefs`; the
 * same key is also stamped on the frozen `creative_sheet_items` configuration so a bootstrap seed
 * written against the old schema never resurrects the notice.
 */
export const RETIRED_COLUMNS: readonly RetiredColumn[] = [
  { tableName: 'creative_briefs', columnName: 'elements_we_are_testing' },
  { tableName: 'creative_sheet_items', columnName: 'elements_we_are_testing' },
] as const;

/** `true` when the (table, column) pair is in `RETIRED_COLUMNS`. */
export function isRetiredColumn(tableName: string, columnName: string): boolean {
  for (const entry of RETIRED_COLUMNS) {
    if (entry.tableName === tableName && entry.columnName === columnName) return true;
  }
  return false;
}
