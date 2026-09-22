import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';

/**
 * Creative Dimensions: size/format specs for creatives. Branded, propagation-enabled.
 *
 * Fields: Name, Dimensions (e.g. "1080x1920"), Link Description (single-select stored
 * as text), and a Creative Design link (FK to briefs stored as uuid, deferred to avoid
 * circular imports).
 */
export const creativeDimensions = pgTable(
  'creative_dimensions',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    dimensions: text('dimensions'),
    linkDescription: text('link_description'),
    creativeDesignId: uuid('creative_design_id'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creative_dimensions_brand_id_idx').on(table.brandId),
    index('creative_dimensions_template_row_id_idx').on(table.templateRowId),
  ],
);

export type CreativeDimension = typeof creativeDimensions.$inferSelect;
export type NewCreativeDimension = typeof creativeDimensions.$inferInsert;
