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
 *
 * Oct-15 walkthrough follow-up (DEV_NOTICE_PART2): the Column Admin notice lit up again on four
 * Creative Sheet keys and one UGC key that still had `column_definitions` rows on live brands but
 * no renderer. Each was dropped from the seed by Oct 14 follow-up #5 (`docs/sprint-oct12.md`),
 * but the stored rows are soft-deleted only when `seed-columns --apply` next runs; until then the
 * roster silences the notice. The four Creative Sheet keys scope to `creative_sheet_items`, which
 * is the frozen table that still carries them in `column_definitions`; the `creative_briefs` view
 * does not have `used`, `winning` or `denied_revisions_needed` (those live on the frozen table's
 * schema), and `client_comments` is scoped there for the same reason the parent-side drop was.
 *
 * `creators.profile_pic_url` is retired because the UGC grid draws the profile picture inside
 * the Name cell (`ugc-workspace.tsx` lines 221-223 and `CreatorAvatar`), never as its own cell.
 * `missing: ['deadline', 'for_partnership_ads', 'profile_pic_url']` in `ugc-workspace.test.tsx`
 * records the state before this fix; adding it here filters it out at the loader.
 *
 * `creators.shipping_location` is retired alongside the Oct-15 PII_UGC fix: the resolver cell
 * returns a `TextCell value={null}` to hide the address, so the Column Admin should not report
 * the key as "configured but not drawn" either. The DB column stays until migration 0073.
 */
export const RETIRED_COLUMNS: readonly RetiredColumn[] = [
  { tableName: 'creative_briefs', columnName: 'elements_we_are_testing' },
  { tableName: 'creative_sheet_items', columnName: 'elements_we_are_testing' },
  { tableName: 'creative_sheet_items', columnName: 'client_comments' },
  { tableName: 'creative_sheet_items', columnName: 'used' },
  { tableName: 'creative_sheet_items', columnName: 'denied_revisions_needed' },
  { tableName: 'creative_sheet_items', columnName: 'winning' },
  { tableName: 'creators', columnName: 'profile_pic_url' },
  { tableName: 'creators', columnName: 'shipping_location' },
] as const;

/** `true` when the (table, column) pair is in `RETIRED_COLUMNS`. */
export function isRetiredColumn(tableName: string, columnName: string): boolean {
  for (const entry of RETIRED_COLUMNS) {
    if (entry.tableName === tableName && entry.columnName === columnName) return true;
  }
  return false;
}
