import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';

/**
 * A product or landing page the creative work points at (PRD §5.1: the link is required, the
 * collection link is optional). Branded: `brand_id` overrides the shared nullable column with
 * `.notNull().references(...)`, so `withBrand` accepts it and no row can exist outside a brand.
 */
export const products = pgTable(
  'products',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    link: text('link').notNull(),
    collectionLink: text('collection_link'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('products_brand_id_idx').on(table.brandId),
    index('products_template_row_id_idx').on(table.templateRowId),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
