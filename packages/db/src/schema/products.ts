import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
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
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    link: text('link').notNull(),
    collectionLink: text('collection_link'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  // Index for the `brand_id` foreign key; also the leading column of every scoped read.
  (table) => [index('products_brand_id_idx').on(table.brandId)],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
