import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { angles } from './angles';
import { brands } from './brands';
import { campaignsOffers } from './campaigns';
import { products } from './products';

/**
 * Collections: groupings of creatives and campaigns. Branded, propagation-enabled.
 *
 * Link fields: Campaigns & Offers, Angles, Product, and two Creative Design links
 * (one text for legacy Airtable loose-text, one FK for the second link). Copywriting
 * link stored as a separate FK. The "Creative Design" text field mirrors Airtable's
 * loose-text field; the second Creative Design link is a proper FK to briefs.
 */
export const collections = pgTable(
  'collections',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    url: text('url'),
    campaignId: uuid('campaign_id').references(() => campaignsOffers.id),
    angleId: uuid('angle_id').references(() => angles.id),
    productId: uuid('product_id').references(() => products.id),
    creativeDesignNote: text('creative_design_note'),
    copywritingId: uuid('copywriting_id'),
    creativeDesign2Id: uuid('creative_design_2_id'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('collections_brand_id_idx').on(table.brandId),
    index('collections_template_row_id_idx').on(table.templateRowId),
  ],
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
