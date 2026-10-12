import { and, eq, isNull } from 'drizzle-orm';

import { clientVisibleColumns } from './client-columns';
import { resolveColumns, upsertColumnDefinition } from './column-definitions';
import { loadCustomPageRows } from './custom-interface-pages';
import type { Db } from './db';
import { brands, columnDefinitions, type ColumnDefinition } from './schema';

/**
 * A STANDARD tab's columns, edited for one brand (Interface Config, Part A2, 2026-10-12).
 *
 * The client portal's standard tabs render the brand's resolved columns of the tab's source table
 * (`resolveColumns`, the same inheritance every team grid uses), narrowed to the client-visible
 * allow-list (non-negotiable 10) and to stored columns (a virtual one has no cell to project). An
 * admin edits them from the Pages section's Edit dialog: the writes are the same
 * `upsertColumnDefinition` child rows Column Admin writes — label, order, hidden — tracking the
 * template (`isDetached: false`), so a later template relabel still flows through to a column the
 * brand has not touched. The template's own rows are never written. "Reset to template" reattaches
 * the brand's rows for these columns, so the template's labels and order show again.
 *
 * Only TEMPLATE-DEFINED columns are listed and writable here: a column a brand added for itself
 * (`source: 'custom'`) is Column Admin's business, not a page's.
 */
export interface BrandTabColumn {
  readonly columnKey: string;
  /** The template's label — what shows when the brand keeps no label of its own. */
  readonly resolverLabel: string;
  readonly label: string;
  readonly displayOrder: number;
  readonly hidden: boolean;
}

export interface BrandTabColumnWrite {
  readonly columnKey: string;
  readonly label: string;
  readonly displayOrder: number;
  readonly hidden: boolean;
}

async function templateIdOf(db: Db, brandId: string): Promise<string | null> {
  const [brand] = await db
    .select({ templateBrandId: brands.templateBrandId })
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)))
    .limit(1);
  return brand?.templateBrandId ?? null;
}

async function rowsOf(db: Db, brandId: string, tableKey: string): Promise<ColumnDefinition[]> {
  return db
    .select()
    .from(columnDefinitions)
    .where(
      and(
        eq(columnDefinitions.brandId, brandId),
        eq(columnDefinitions.tableKey, tableKey),
        isNull(columnDefinitions.deletedAt),
      ),
    );
}

/** The template's client-visible, stored, shown columns of a table — the set a page may edit. */
async function editableParentRows(
  db: Db,
  brandId: string,
  tableKey: string,
): Promise<ColumnDefinition[]> {
  const templateId = await templateIdOf(db, brandId);
  if (templateId === null) return [];
  const visible = clientVisibleColumns(tableKey);
  return (await rowsOf(db, templateId, tableKey))
    .filter((row) => !row.isHidden && row.formula === null && visible.has(row.columnKey))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function brandTabColumns(
  db: Db,
  brandId: string,
  tableKey: string,
): Promise<BrandTabColumn[]> {
  const parents = await editableParentRows(db, brandId, tableKey);
  const own = new Map((await rowsOf(db, brandId, tableKey)).map((row) => [row.columnKey, row]));
  return parents
    .map((parent) => {
      const child = own.get(parent.columnKey);
      return {
        columnKey: parent.columnKey,
        resolverLabel: parent.displayLabel,
        label: child?.displayLabel ?? parent.displayLabel,
        displayOrder: child?.displayOrder ?? parent.displayOrder,
        hidden: child?.isHidden ?? false,
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Writes the brand's rows for the given columns (label, order, hidden), each tracking the template
 * row's source, field type and formula. A column outside the editable template set is refused.
 */
export async function setBrandTabColumns(
  db: Db,
  brandId: string,
  tableKey: string,
  writes: readonly BrandTabColumnWrite[],
  actorId: string,
): Promise<number> {
  const parents = new Map(
    (await editableParentRows(db, brandId, tableKey)).map((row) => [row.columnKey, row]),
  );
  const stray = writes.find((write) => !parents.has(write.columnKey));
  if (stray !== undefined) {
    throw new Error(
      `setBrandTabColumns: “${stray.columnKey}” is not a client-visible column of ${tableKey}`,
    );
  }
  for (const write of writes) {
    const parent = parents.get(write.columnKey);
    if (parent === undefined) continue;
    await upsertColumnDefinition(
      db,
      brandId,
      {
        tableKey,
        columnKey: write.columnKey,
        displayLabel: write.label.trim() === '' ? parent.displayLabel : write.label.trim(),
        displayOrder: write.displayOrder,
        isHidden: write.hidden,
        isDetached: false,
        fieldType: parent.fieldType,
        source: parent.source,
        formula: parent.formula,
      },
      actorId,
    );
  }
  return writes.length;
}

/** The editable columns the brand keeps rows of its own for (a label, order or hidden of its own). */
export async function brandOwnTabColumnKeys(
  db: Db,
  brandId: string,
  tableKey: string,
): Promise<readonly string[]> {
  const editable = new Set(
    (await editableParentRows(db, brandId, tableKey)).map((row) => row.columnKey),
  );
  return (await rowsOf(db, brandId, tableKey))
    .filter((row) => editable.has(row.columnKey))
    .map((row) => row.columnKey);
}

/**
 * A page's column picks as column definition writes for a standard tab: a picked column is shown
 * under its label, the picked ones taking the tab's existing order slots in the picked sequence
 * (so the tab's columns keep their place among Column Admin's other columns); every other
 * editable column is hidden, keeping its label and slot.
 */
export function tabColumnWrites(
  columns: readonly { columnKey: string; label: string; displayOrder: number }[],
  picks: readonly { columnKey: string; displayLabel: string; displayOrder: number }[],
): BrandTabColumnWrite[] {
  const known = new Set(columns.map((column) => column.columnKey));
  const ordered = [...picks]
    .filter((pick) => known.has(pick.columnKey))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const slots = columns.map((column) => column.displayOrder).sort((a, b) => a - b);
  const picked = new Map(
    ordered.map((pick, index) => [
      pick.columnKey,
      {
        columnKey: pick.columnKey,
        label: pick.displayLabel,
        displayOrder: slots[index] ?? index,
        hidden: false,
      },
    ]),
  );
  return columns.map(
    (column) =>
      picked.get(column.columnKey) ?? {
        columnKey: column.columnKey,
        label: column.label,
        displayOrder: column.displayOrder,
        hidden: true,
      },
  );
}

/** Reattaches the brand's rows for the editable columns of the table; returns how many. */
export async function reattachBrandTabColumns(
  db: Db,
  brandId: string,
  tableKey: string,
  actorId: string,
): Promise<number> {
  const editable = new Set(
    (await editableParentRows(db, brandId, tableKey)).map((row) => row.columnKey),
  );
  const own = (await rowsOf(db, brandId, tableKey)).filter((row) => editable.has(row.columnKey));
  const now = new Date();
  for (const row of own) {
    await db
      .update(columnDefinitions)
      .set({ deletedAt: now, updatedBy: actorId, updatedAt: now })
      .where(eq(columnDefinitions.id, row.id));
  }
  return own.length;
}

export interface StandardTabRender {
  readonly columns: readonly { readonly columnKey: string; readonly displayLabel: string }[];
  readonly rows: readonly Record<string, unknown>[];
}

/** What a standard tab renders for a brand: its resolved, client-visible, stored columns and rows. */
export async function loadStandardTabRender(
  db: Db,
  brandId: string,
  tableKey: string,
): Promise<StandardTabRender> {
  const visible = clientVisibleColumns(tableKey);
  const columns = (await resolveColumns(db, brandId, tableKey))
    .filter((column) => column.formula === null && visible.has(column.columnKey))
    .map((column) => ({ columnKey: column.columnKey, displayLabel: column.displayLabel }));
  const rows = await loadCustomPageRows(db, brandId, tableKey);
  return { columns, rows };
}
