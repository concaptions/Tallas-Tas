import { COLUMN_SEED, resolveColumns, type Db, type ResolvedColumn } from '@tas/db';

import { orderColumns } from '@/components/views/resolved-columns';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';

/**
 * THE loader every resolver-driven page gets its columns from.
 *
 * Personas and Products each grew their own copy of this — the same twelve lines, the same fallback,
 * the same comment — and eleven more pages are due to follow. One copy means the rule below is
 * decided once; nine copies would mean nine chances for a page to decide it differently, and the
 * rule is the whole reason this function exists.
 *
 * THE RULE: AN EMPTY RESOLUTION IS NEVER PASSED ON, because an empty column set does not degrade —
 * it erases. `resolveColumns` legitimately returns `[]` for a brand with no `column_definitions`
 * rows of its own and no seeded parent, and the brand id is null while a workspace has no brand yet.
 * Handed `[]`, a page renders a `thead` with no `th`, rows with no cells, an empty Fields popover and
 * a gallery with no fields — the brand's own data neither shown nor editable, with no notice.
 * Dropping a column is the one outcome the owner forbids, so the parent master set is served instead
 * and `unconfigured` says so, which the page states on itself.
 */
export type ResolvedColumnsSourceKind = 'database' | 'demo';

export interface ResolvedColumnsResult {
  readonly columns: readonly ResolvedColumn[];
  readonly source: ResolvedColumnsSourceKind;
  /**
   * True when `columns` is the PARENT MASTER-SET FALLBACK rather than this brand's own resolved
   * configuration. Demo mode is never flagged: there the same set is the designed answer, because
   * demo mode's brand is Niagara, which holds no rows of its own and so inherits the template.
   */
  readonly unconfigured: boolean;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * The seams a page's own source module already has, so this helper slots into either and a test can
 * still prove the demo branch opens no connection and pin what an EMPTY resolution does.
 */
export interface ResolvedColumnsDeps extends BrandResolverDeps {
  readonly demoMode: () => boolean;
  readonly withDb: <T>(query: (db: Db) => Promise<T>) => Promise<T>;
  readonly resolveColumns?: (
    db: Db,
    brandId: string,
    tableKey: string,
  ) => Promise<readonly ResolvedColumn[]>;
}

/**
 * One table's parent master set, read from `COLUMN_SEED` itself rather than a second list.
 *
 * Deriving it from the seed is what keeps the fallback honest: it cannot drift from what the seed
 * writes, because it IS what the seed writes. Hidden rows are dropped, since a hidden row is a
 * column the brand does not show, and the set is put through the ONE comparator the grid uses so it
 * comes out exactly as `resolveColumns` would have returned the same rows.
 */
export function parentColumnsFor(tableKey: string): readonly ResolvedColumn[] {
  return orderColumns(
    COLUMN_SEED.filter((group) => group.target.kind === 'parent')
      .flatMap((group) => group.rows)
      .filter((row) => row.tableKey === tableKey && row.isHidden !== true)
      .map((row) => ({
        columnKey: row.columnKey,
        displayLabel: row.displayLabel,
        displayOrder: row.displayOrder,
        fieldType: row.fieldType ?? null,
        source: row.source ?? 'parent',
        formula: row.formula ?? null,
        isDetached: false,
        inheritedFrom: null,
      })),
  );
}

/** The ordered, labelled, visible columns of one table for the working brand. */
export async function loadResolvedColumns(
  tableKey: string,
  deps: ResolvedColumnsDeps,
): Promise<ResolvedColumnsResult> {
  const parent = parentColumnsFor(tableKey);
  if (deps.demoMode()) {
    return { columns: parent, source: 'demo', unconfigured: false };
  }
  return deps.withDb(async (db) => {
    const resolve = deps.resolveColumns ?? resolveColumns;
    const brandId = await resolveLiveBrandId(db, deps);
    const columns = brandId === null ? [] : await resolve(db, brandId, tableKey);
    return columns.length === 0
      ? { columns: parent, source: 'database' as const, unconfigured: true }
      : { columns, source: 'database' as const, unconfigured: false };
  });
}
