import type { BrandTabColumnWrite } from '@tas/db';
import {
  CUSTOM_PAGE_SOURCE_TABLE_KEYS,
  filterOpNeedsValue,
  type CustomPageColumnConfig,
  type CustomPageFilterConfig,
} from '@tas/domain';
import { z } from 'zod';

/**
 * ONE validation schema for a page's fields, shared by "Add custom page" (`createCustomPageAction`)
 * and the Edit dialog (`editPageAction`), so both forms are checked by the same rules. A plain
 * module — a `'use server'` file may export only async functions.
 */

// kebab-case: lowercase + digits + dashes, no leading / trailing / double dash.
export const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const columnConfigSchema = z
  .array(
    z.object({
      columnKey: z.string().min(1).max(128),
      // The page's own label for the column: trimmed, 1 to 128 characters.
      displayLabel: z.string().trim().min(1).max(128),
      displayOrder: z.number().int().min(0).max(999),
    }),
  )
  .max(64);

/**
 * At least one column pick: `column_config = []` is "every resolver column" to the client route,
 * internal fields included (non-negotiable 10). `@tas/db` refuses it too; this is the message.
 */
export const EMPTY_COLUMNS_MESSAGE =
  'Pick at least one column: an empty set would show the client every column of the table.';
export const columnPicksSchema = columnConfigSchema.min(1, EMPTY_COLUMNS_MESSAGE);

export const filterConfigSchema = z.union([
  z.object({}).strict(),
  z.object({
    column: z.string().min(1).max(128),
    op: z.enum(['is', 'is_not', 'contains']),
    value: z.string().min(1).max(512),
  }),
  z.object({
    column: z.string().min(1).max(128),
    op: z.enum(['is_empty', 'is_not_empty']),
  }),
]);

export const pageSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(slugRegex, 'Slug must be kebab-case.');
export const pageTitleSchema = z.string().min(1).max(120);

export const createPageSchema = z.object({
  slug: pageSlugSchema,
  title: pageTitleSchema,
  sourceTableKey: z.enum(CUSTOM_PAGE_SOURCE_TABLE_KEYS),
  filterConfig: filterConfigSchema,
  columnConfig: columnPicksSchema,
  isVisible: z.boolean(),
});

/** The Edit dialog: title and visibility always; filter and columns when the page is custom/module. */
export const editPageSchema = z.object({
  slug: pageSlugSchema,
  title: pageTitleSchema,
  isVisible: z.boolean(),
  filterConfig: filterConfigSchema.optional(),
  columnConfig: columnPicksSchema.optional(),
});

/** Reject a filter with an op that needs a value but has none, before Postgres sees it. */
export function filterValid(filter: CustomPageFilterConfig): boolean {
  if (!('op' in filter)) return true;
  if (!filterOpNeedsValue(filter.op)) return true;
  return 'value' in filter && filter.value.length > 0;
}

/** A JSON field of the form, or undefined when absent, empty or malformed. */
export function readJsonEntry(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * The column keys a client page may carry are the client-visible ones of its source table
 * (non-negotiable 10). Returns the first key that is not, or null when every pick is allowed.
 */
export function firstInternalColumn(
  picks: readonly { readonly columnKey: string }[] | undefined,
  isVisible: (columnKey: string) => boolean,
): string | null {
  if (picks === undefined) return null;
  return picks.find((pick) => !isVisible(pick.columnKey))?.columnKey ?? null;
}

/**
 * The dialog's picks as column definition writes for a standard tab: a picked column is shown
 * under its label, the picked ones taking the tab's existing order slots in the picked sequence
 * (so the tab's columns keep their place among Column Admin's other columns); every other
 * editable column is hidden, keeping its label and slot.
 */
export function tabColumnWrites(
  columns: readonly { columnKey: string; label: string; displayOrder: number }[],
  picks: readonly CustomPageColumnConfig[],
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
