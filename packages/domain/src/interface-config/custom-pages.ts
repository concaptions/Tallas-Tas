/**
 * Vocabularies and read-only helpers for the Oct 6/7 custom-interface-pages / tab-visibility sprint.
 *
 * No I/O, no React, no @tas/db imports — same contract every other module in `packages/domain`
 * carries. `apps/web` asserts these literals equal the ones the schema's own types narrow to.
 */

/**
 * The FOUR shipped client tabs the Oct 5 Agent 5 sprint wired `client_status` onto. These are the
 * default visibility set for every new brand — the seed inserts one `interface_tab_visibility` row
 * per key against the template brand, is_visible = true, sort_order 1..4, and a child brand reads
 * its own row when present and the template row otherwise.
 *
 * Order matches the shipped left-nav of the client portal: concepts first, then creatives, then
 * UGC, then copy.
 */
export const CLIENT_TAB_KEYS = [
  'concepts',
  'creative_sheet',
  'ugc_management',
  'copywriting',
] as const;

export type ClientTabKey = (typeof CLIENT_TAB_KEYS)[number];

export function isClientTabKey(value: string): value is ClientTabKey {
  return (CLIENT_TAB_KEYS as readonly string[]).includes(value);
}

/** Human-readable label for the four standard tabs, keyed by the storage vocabulary. */
export const CLIENT_TAB_LABELS: Readonly<Record<ClientTabKey, string>> = {
  concepts: 'Concepts',
  creative_sheet: 'Creative Sheet',
  ugc_management: 'UGC Management',
  copywriting: 'Copywriting',
};

export function clientTabLabel(key: ClientTabKey): string {
  return CLIENT_TAB_LABELS[key];
}

/**
 * The source tables a custom page may draw rows from. V0 holds six: four content tables plus two
 * strategy tables that already carry resolver-driven column configs. Themes is intentionally
 * excluded — Themes is the GLOBAL library (CLAUDE.md non-negotiable 3), not a per-brand content
 * table, so filtering it per client has no meaning.
 */
export const CUSTOM_PAGE_SOURCE_TABLE_KEYS = [
  'creative_briefs',
  'creators',
  'copywriting',
  'concepts',
  'collections',
  'products',
] as const;

export type CustomPageSourceTableKey = (typeof CUSTOM_PAGE_SOURCE_TABLE_KEYS)[number];

export function isCustomPageSourceTableKey(value: string): value is CustomPageSourceTableKey {
  return (CUSTOM_PAGE_SOURCE_TABLE_KEYS as readonly string[]).includes(value);
}

/** The source table labels the admin UI prints in its "Source" dropdown. */
export const CUSTOM_PAGE_SOURCE_TABLE_LABELS: Readonly<Record<CustomPageSourceTableKey, string>> = {
  creative_briefs: 'Creative Sheet',
  creators: 'UGC Management',
  copywriting: 'Copywriting',
  concepts: 'Concepts',
  collections: 'Collections',
  products: 'Products',
};

/**
 * The five V0 filter operators. `is_empty` / `is_not_empty` carry no value; the other three
 * require it. Enforced in `narrowFilterConfig` below, not in the DB — the column is `jsonb` and a
 * malformed row would come back as `{}` from the admin UI's own validation, same as it was never
 * written.
 */
export const CUSTOM_PAGE_FILTER_OPS = [
  'is',
  'is_not',
  'contains',
  'is_empty',
  'is_not_empty',
] as const;

export type CustomPageFilterOp = (typeof CUSTOM_PAGE_FILTER_OPS)[number];

/** The three ops that need a value; the other two carry none. */
export const CUSTOM_PAGE_FILTER_OPS_WITH_VALUE: readonly CustomPageFilterOp[] = [
  'is',
  'is_not',
  'contains',
];

export function filterOpNeedsValue(op: CustomPageFilterOp): boolean {
  return CUSTOM_PAGE_FILTER_OPS_WITH_VALUE.includes(op);
}

/** Label the admin UI prints next to each op in the filter builder. */
export const CUSTOM_PAGE_FILTER_OP_LABELS: Readonly<Record<CustomPageFilterOp, string>> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

/**
 * The configured filter after validation. `{}` is the no-filter case; the other two variants
 * mirror the schema's jsonb shape. This is a DISCRIMINATED UNION on `op`, so a caller that writes
 * `if (filter.op === 'is')` is narrowed to the branch that owns `value`.
 */
export type CustomPageFilterConfig =
  | Record<string, never>
  | {
      readonly column: string;
      readonly op: 'is' | 'is_not' | 'contains';
      readonly value: string;
    }
  | {
      readonly column: string;
      readonly op: 'is_empty' | 'is_not_empty';
    };

/**
 * One column of a custom page's `column_config`, matching the resolver's shape. The admin UI
 * writes an array of these when the CSM picks the subset of columns a page renders.
 */
export interface CustomPageColumnConfig {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
}

/**
 * One `custom_interface_pages` row as the admin UI and the client portal read it. Structural so
 * `apps/web` and the schema's `$inferSelect` type agree without a direct import.
 */
export interface CustomInterfacePageView {
  readonly id: string;
  /** NULL on template rows; a child reads this to decide "inherited" vs "override". */
  readonly brandId: string | null;
  readonly slug: string;
  readonly title: string;
  readonly sourceTableKey: CustomPageSourceTableKey;
  readonly filterConfig: CustomPageFilterConfig;
  readonly columnConfig: readonly CustomPageColumnConfig[];
  readonly sortOrder: number;
  readonly isVisible: boolean;
  readonly isInherited: boolean;
}

/**
 * The read-time merge: given the template's and this brand's own custom pages, return the pages
 * the client actually sees — a child page by slug overrides the template's; otherwise the
 * template's row applies. Both arrays may be in any order; the result is sorted by `sortOrder`
 * ascending, then by `title` as a stable tiebreaker.
 *
 * `isVisible = false` is kept in the result (the admin UI still has to see hidden rows to toggle
 * them). Soft-deleted rows must be filtered BEFORE calling this — the function has no notion of
 * `deleted_at`.
 */
export function mergeCustomPages(
  templatePages: readonly CustomInterfacePageView[],
  brandPages: readonly CustomInterfacePageView[],
): readonly CustomInterfacePageView[] {
  const bySlug = new Map<string, CustomInterfacePageView>();
  for (const page of templatePages) {
    bySlug.set(page.slug, page);
  }
  for (const page of brandPages) {
    bySlug.set(page.slug, page);
  }
  return [...bySlug.values()].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
}

/**
 * One `interface_tab_visibility` row as the admin UI and the client portal read it. The row is
 * ABSENT when a brand has not overridden the template default; both the merge below and the admin
 * UI handle that by falling through to the template row.
 */
export interface InterfaceTabVisibilityView {
  readonly brandId: string;
  readonly tabKey: ClientTabKey;
  readonly isVisible: boolean;
  readonly sortOrder: number;
}

/**
 * The read-time merge for the four standard tabs. Returns one entry per `CLIENT_TAB_KEYS` key in
 * sort order; if neither the brand nor the template has configured a tab, the fallback is
 * `is_visible = true` and `sort_order = <position in CLIENT_TAB_KEYS>` so a brand that was created
 * before the seed ran still sees a sensible nav.
 *
 * Hidden tabs are KEPT in the output (the admin UI needs them). The client portal filters by
 * `isVisible = true` at render time.
 */
export function mergeTabVisibility(
  templateRows: readonly InterfaceTabVisibilityView[],
  brandRows: readonly InterfaceTabVisibilityView[],
): readonly InterfaceTabVisibilityView[] {
  const brandById = new Map(brandRows.map((row) => [row.tabKey, row] as const));
  const templateById = new Map(templateRows.map((row) => [row.tabKey, row] as const));
  const brandId = brandRows[0]?.brandId ?? templateRows[0]?.brandId ?? '';
  return CLIENT_TAB_KEYS.map((key, index) => {
    const brandRow = brandById.get(key);
    if (brandRow !== undefined) return brandRow;
    const templateRow = templateById.get(key);
    if (templateRow !== undefined) {
      return { ...templateRow, brandId };
    }
    return {
      brandId,
      tabKey: key,
      isVisible: true,
      sortOrder: index + 1,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Apply a custom page's filter to one row of its source table. Called in-memory on the already
 * resolved rows a page loads — V0 does not push the filter to SQL, which keeps the loader shipped
 * for the shipped grids and avoids a per-source-table query builder.
 *
 * The function is deliberately total: an unknown op or a malformed `filterConfig` returns `true`
 * (keep the row), because the admin UI never writes those shapes and a stored row that somehow
 * has one should not blank the page.
 */
export function rowMatchesFilter(
  row: Readonly<Record<string, unknown>>,
  filter: CustomPageFilterConfig,
): boolean {
  if (!('op' in filter)) return true;
  const cell = row[filter.column];
  // Narrow `cell` down to primitive branches `String(...)` can stringify without reaching
  // Object's default `[object Object]`. A column that holds an array (jsonb multi-select) is
  // serialised through JSON so the filter's `contains` can match a token; anything else is
  // treated as empty, which is what the admin UI's one-value-condition contract already asserts.
  const text =
    cell === null || cell === undefined
      ? ''
      : typeof cell === 'string'
        ? cell
        : typeof cell === 'number' || typeof cell === 'boolean' || typeof cell === 'bigint'
          ? String(cell)
          : Array.isArray(cell)
            ? JSON.stringify(cell)
            : '';
  const trimmed = text.trim();
  switch (filter.op) {
    case 'is':
      return text === filter.value;
    case 'is_not':
      return text !== filter.value;
    case 'contains':
      return text.toLowerCase().includes(filter.value.toLowerCase());
    case 'is_empty':
      return trimmed === '';
    case 'is_not_empty':
      return trimmed !== '';
    default:
      return true;
  }
}

/**
 * Narrow a resolver's columns down to the subset `column_config` picks, preserving the
 * `columnConfig` order. Columns the resolver no longer carries are DROPPED silently — a column
 * admin removed last week should not blank the client page — and columns the resolver carries but
 * `columnConfig` omits are LEFT OUT (that is the whole point of the pick). The returned entries
 * carry the resolver's label and the stored displayOrder, so a column that was renamed in Column
 * Admin after the custom page was configured shows its new label.
 */
export interface ResolvedColumnInput {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
}

export function intersectCustomPageColumns(
  resolverColumns: readonly ResolvedColumnInput[],
  columnConfig: readonly CustomPageColumnConfig[],
): readonly ResolvedColumnInput[] {
  if (columnConfig.length === 0) return resolverColumns;
  const resolverByKey = new Map(resolverColumns.map((col) => [col.columnKey, col] as const));
  return columnConfig
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((pick) => resolverByKey.get(pick.columnKey))
    .filter((col): col is ResolvedColumnInput => col !== undefined);
}
