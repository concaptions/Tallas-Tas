import { boolean, index, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * THE per-column configuration of one table on one base — the Airtable-style column inheritance
 * (`docs/audits/inheritance-plan-2026-10-02.md`).
 *
 * One row = one column of one table on one base. The PARENT base (`brands.is_template = true`)
 * holds the master set; a child brand holds a row only where it departs from the parent. A child
 * with no row for a column INHERITS the parent's row — resolved by READING the parent at query time
 * (`brands.template_brand_id`), never by copying, which is why a parent edit reaches every attached
 * child with no propagation job to go stale and no child left to repair.
 *
 * `column_key` is the stable key and never changes: the Postgres column (`demographic`) or, for a
 * two-way link, the junction table (`angle_personas`). `display_label` is what a brand reads
 * ("Description [Age Status Salary]"), so a relabel is a UI fact and never a column rename.
 *
 * Shape borrowed deliberately from `interface_fields`, which has carried label/visible/position per
 * brand in production since migration 0012 — including its INTEGER position, because
 * `custom_field_schemas.sort_order` is text and therefore orders '10' before '2'.
 */
export const columnDefinitions = pgTable(
  'column_definitions',
  {
    ...baseColumns(),
    /** The base this row applies to: the template brand for the master set, else a child. */
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    /** The content table, as `PROPAGATION_TABLES` keys it (`personas`, `creative_briefs`). */
    tableKey: text('table_key').notNull(),
    /** The Postgres column, or a junction table name for a link column. Never renamed. */
    columnKey: text('column_key').notNull(),
    /** What this base displays for the column. */
    displayLabel: text('display_label').notNull(),
    /** Integer on purpose; see the note about `sort_order` above. */
    displayOrder: integer('display_order').notNull(),
    /** Excluded from the resolved list, kept in the table. Hiding never drops data. */
    isHidden: boolean('is_hidden').notNull().default(false),
    /**
     * TRUE on a child row means it REPLACES the parent's row and stops following parent edits.
     * FALSE means the row still tracks the parent, so a parent relabel or reorder flows through.
     * Always false on a parent row, which has nothing to detach from.
     */
    isDetached: boolean('is_detached').notNull().default(false),
    /** The Airtable/Drizzle type, so the admin UI can offer a sane editor. */
    fieldType: text('field_type'),
    /**
     * `parent` = part of the master set. `custom` = a column this child added for itself.
     * A child's override of a parent column carries `parent`, because the column is the parent's.
     */
    /**
     * Where the column comes from. `parent` is an Airtable field of the template base (a child's
     * override of one carries `parent` too); `custom` is a field a child base added for itself;
     * `platform` is a column the PLATFORM owns and Airtable has no field for — the two approval
     * tracks and the generated names — which exists on every base and must never be dropped when a
     * page starts reading its columns from the resolver.
     */
    source: text('source').$type<'parent' | 'custom' | 'platform'>().notNull().default('parent'),
    /**
     * The formula that COMPUTES this column, when it is not stored at all.
     *
     * NULL means `column_key` names a stored Postgres column (or a junction). A non-null value names
     * an export of `packages/db/src/formulas/` — validated against `VIRTUAL_FORMULAS`, never free
     * text — and means the column is VIRTUAL: computed on every read, written by nothing.
     *
     * One column rather than a boolean beside a name, on purpose: a boolean would permit "virtual,
     * with nothing to compute it". The marker and the pointer are the same fact.
     *
     * Orthogonal to `source`. All seven virtual columns today are also `platform` — the platform
     * owns them and no Airtable field backs them — but the two answer different questions: `source`
     * says who the column belongs to, `formula` says whether there is anything to store.
     */
    formula: text('formula'),
  },
  (table) => [
    index('column_definitions_brand_table_idx').on(table.brandId, table.tableKey),
    index('column_definitions_table_key_idx').on(table.tableKey),
    unique('column_definitions_brand_table_column_unique').on(
      table.brandId,
      table.tableKey,
      table.columnKey,
    ),
  ],
);

export type ColumnDefinition = typeof columnDefinitions.$inferSelect;
export type NewColumnDefinition = typeof columnDefinitions.$inferInsert;
