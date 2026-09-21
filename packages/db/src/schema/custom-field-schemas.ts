import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * Defines the shape of custom fields available on a content table. Rows belong to the TEMPLATE brand
 * and propagate to child brands as part of the schema (a structural change, not a data change).
 *
 * `table_name` is the Postgres table name the field extends (e.g. 'personas', 'angles').
 * `field_key` is the slug stored as a key in the row's `custom_fields` JSONB.
 * `field_type` is the value type: 'text', 'number', 'boolean', 'select', 'url'.
 * `field_label` is the human-readable label shown in the UI.
 * `options` stores the allowed values for 'select' fields as a JSON string array.
 */
export const customFieldSchemas = pgTable(
  'custom_field_schemas',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    tableName: text('table_name').notNull(),
    fieldKey: text('field_key').notNull(),
    fieldType: text('field_type')
      .$type<'text' | 'number' | 'boolean' | 'select' | 'url'>()
      .notNull(),
    fieldLabel: text('field_label').notNull(),
    options: text('options'),
    sortOrder: text('sort_order').notNull().default('0'),
  },
  (table) => [
    index('custom_field_schemas_brand_id_idx').on(table.brandId),
    index('custom_field_schemas_table_name_idx').on(table.brandId, table.tableName),
  ],
);

export type CustomFieldSchema = typeof customFieldSchemas.$inferSelect;
export type NewCustomFieldSchema = typeof customFieldSchemas.$inferInsert;
