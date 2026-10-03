import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { brands, columnDefinitions, type ColumnDefinition } from './schema';

/**
 * One resolved column, ready for a grid: the stable key, what this base calls it, and where it came
 * from. `inheritedFrom` is the parent's brand id when the row came from the parent, so the admin UI
 * can show "following the template" versus "detached" without a second query.
 */
export interface ResolvedColumn {
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
  readonly fieldType: string | null;
  readonly source: 'parent' | 'custom' | 'platform';
  /**
   * The formula that computes this column, or null when it is stored. A non-null value means the
   * column is VIRTUAL: there is no Postgres column behind it and nothing may write to it.
   */
  readonly formula: string | null;
  /** true when this base overrides the parent for this column and ignores parent edits. */
  readonly isDetached: boolean;
  /** The parent brand id this definition was read from, or null when the base owns the row. */
  readonly inheritedFrom: string | null;
}

async function templateBrandIdOf(db: Db, brandId: string): Promise<string | null> {
  const [brand] = await db
    .select({ templateBrandId: brands.templateBrandId })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)))
    .limit(1);
  return brand?.templateBrandId ?? null;
}

async function rowsFor(db: Db, brandId: string, tableKey: string): Promise<ColumnDefinition[]> {
  return db
    .select()
    .from(columnDefinitions)
    .where(
      and(
        eq(columnDefinitions.brandId, brandId),
        eq(columnDefinitions.tableKey, tableKey),
        isNull(columnDefinitions.deletedAt),
      ),
    )
    .orderBy(asc(columnDefinitions.displayOrder));
}

/**
 * THE column resolver: the ordered, labelled, visible columns of one table on one base.
 *
 * Inheritance happens HERE, at read time, by reading the parent's rows — nothing is copied, so a
 * parent edit reaches every attached child immediately and there is no propagation job to go stale.
 * The merge, in order of precedence:
 *
 *   1. a child row with `isDetached` REPLACES the parent's row and ignores later parent edits;
 *   2. a child row without it still overrides the label/order it carries, but it is tracking the
 *      parent, so a parent change to the column flows through on the next read;
 *   3. a child row with no parent counterpart is a column this child added for itself;
 *   4. a column with no child row at all is inherited from the parent verbatim;
 *   5. `isHidden` on whichever row wins removes the column from the result — never from the table.
 *
 * A base with no parent (the template itself) resolves to its own rows. Ordering is by
 * `displayOrder` with `columnKey` as the tie-break, so the result is stable rather than
 * insertion-ordered.
 */
export async function resolveColumns(
  db: Db,
  brandId: string,
  tableKey: string,
): Promise<ResolvedColumn[]> {
  const parentBrandId = await templateBrandIdOf(db, brandId);
  const ownRows = await rowsFor(db, brandId, tableKey);
  const parentRows = parentBrandId === null ? [] : await rowsFor(db, parentBrandId, tableKey);

  const own = new Map(ownRows.map((row) => [row.columnKey, row]));
  const resolved: ResolvedColumn[] = [];

  /**
   * `formula` falls back to the PARENT's, because whether a column is computed is a property of the
   * COLUMN and not of a brand's opinion about it. A child row exists to relabel, reorder or hide;
   * letting it also decide that a virtual column is suddenly stored would point the page at a
   * Postgres column that does not exist — and the Creative Sheet name is exactly that case, since
   * Gratsi words the parent's `Name + Angle + Offer` as `Name` and must still compute it.
   *
   * This is the structural version of what `formulaForWrite` enforces on the admin's write path, and
   * it is stronger: no seed row, no hand-made POST and no future writer can detach a column from its
   * formula, because the resolver reads it from the parent regardless. A child-added column keeps its
   * own, since there is no parent row to inherit from.
   */
  const take = (
    row: ColumnDefinition,
    inheritedFrom: string | null,
    parentRow?: ColumnDefinition,
  ): void => {
    if (row.isHidden) return;
    resolved.push({
      columnKey: row.columnKey,
      displayLabel: row.displayLabel,
      displayOrder: row.displayOrder,
      fieldType: row.fieldType,
      source: row.source,
      formula: row.formula ?? parentRow?.formula ?? null,
      isDetached: row.isDetached,
      inheritedFrom,
    });
  };

  // The parent defines the set and its order; a child row for the same column wins.
  for (const parentRow of parentRows) {
    const childRow = own.get(parentRow.columnKey);
    if (childRow === undefined) take(parentRow, parentBrandId);
    else take(childRow, null, parentRow);
  }
  // Then the child's own additions, which the parent knows nothing about.
  const parentKeys = new Set(parentRows.map((row) => row.columnKey));
  for (const row of ownRows) {
    if (!parentKeys.has(row.columnKey)) take(row, null);
  }

  return resolved.sort(
    (left, right) =>
      left.displayOrder - right.displayOrder || left.columnKey.localeCompare(right.columnKey),
  );
}

/** Every table that has a column definition on a base, for an admin picker. */
export async function listConfiguredTables(db: Db, brandId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ tableKey: columnDefinitions.tableKey })
    .from(columnDefinitions)
    .where(and(eq(columnDefinitions.brandId, brandId), isNull(columnDefinitions.deletedAt)));
  return rows.map((row) => row.tableKey).sort((left, right) => left.localeCompare(right));
}

export interface UpsertColumnDefinition {
  readonly tableKey: string;
  readonly columnKey: string;
  readonly displayLabel: string;
  readonly displayOrder: number;
  readonly isHidden?: boolean;
  readonly isDetached?: boolean;
  readonly fieldType?: string | null;
  readonly source?: 'parent' | 'custom' | 'platform';
  /** Names the formula that computes the column; omit or null for a stored column. */
  readonly formula?: string | null;
}

/**
 * Write one base's definition of one column. Structure changes are admin-only; the Server Action
 * enforces the role, and this function is the single write path so there is one place to audit.
 */
/**
 * Whether a resolved column is VIRTUAL — computed on read, with no Postgres column behind it.
 *
 * The one question every write path has to ask. A virtual column has nothing to store, so offering
 * an editor for it or including its key in a write is not a degraded experience, it is a crash or a
 * silently discarded edit.
 */
export function isVirtualColumn(column: Pick<ResolvedColumn, 'formula'>): boolean {
  return column.formula !== null;
}

/**
 * The subset of a resolved set a write may touch: the stored columns, virtual ones removed.
 *
 * THE guard for "virtual is never stored". Because the displayed column set is per-brand data, a
 * page that builds a form or a patch from `resolveColumns` would otherwise reach a virtual column
 * the moment an admin configures one — and the failure would be silent, because the key simply is
 * not a column, so an INSERT either throws at the driver or drops the value. Every caller that turns
 * resolved columns into something writable goes through this, so the rule is enforced once rather
 * than remembered in each page.
 */
export function storedColumns(columns: readonly ResolvedColumn[]): readonly ResolvedColumn[] {
  return columns.filter((column) => !isVirtualColumn(column));
}

/** The virtual columns of a resolved set, for a renderer that needs to compute rather than read. */
export function virtualColumns(columns: readonly ResolvedColumn[]): readonly ResolvedColumn[] {
  return columns.filter((column) => isVirtualColumn(column));
}

export async function upsertColumnDefinition(
  db: Db,
  brandId: string,
  input: UpsertColumnDefinition,
  actorId: string,
): Promise<ColumnDefinition> {
  const [row] = await db
    .insert(columnDefinitions)
    .values({ ...input, brandId, createdBy: actorId, updatedBy: actorId })
    .onConflictDoUpdate({
      target: [columnDefinitions.brandId, columnDefinitions.tableKey, columnDefinitions.columnKey],
      set: {
        displayLabel: input.displayLabel,
        displayOrder: input.displayOrder,
        isHidden: input.isHidden ?? false,
        isDetached: input.isDetached ?? false,
        fieldType: input.fieldType ?? null,
        source: input.source ?? 'parent',
        formula: input.formula ?? null,
        deletedAt: null,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (row === undefined) throw new Error('column definition upsert returned no row');
  return row;
}

/**
 * Reattach a child's column to the parent: the child's row is removed, so the next read inherits the
 * parent verbatim. The child's custom label and order are lost, which the UI warns about before
 * calling this — a soft delete rather than a hard one, so the choice is recoverable in the data.
 */
export async function reattachColumn(
  db: Db,
  brandId: string,
  tableKey: string,
  columnKey: string,
  actorId: string,
): Promise<void> {
  await db
    .update(columnDefinitions)
    .set({ deletedAt: new Date(), updatedBy: actorId, updatedAt: new Date() })
    .where(
      and(
        eq(columnDefinitions.brandId, brandId),
        eq(columnDefinitions.tableKey, tableKey),
        eq(columnDefinitions.columnKey, columnKey),
        isNull(columnDefinitions.deletedAt),
      ),
    );
}
