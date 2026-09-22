import { boolean, date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { products } from './products';

/**
 * Campaigns & Offers (PRD §5.3): ecomm offers, holidays and discount codes. Internal only — never
 * shown in the client interface (CLAUDE.md non-negotiable 10). The `name` column is auto-generated
 * from the Airtable formula `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})`, e.g.
 * `BFCM-20%OFF-BFCM26`.
 *
 * Branded: every campaign belongs to exactly one brand.
 */
export const campaignsOffers = pgTable(
  'campaigns_offers',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    holiday: text('holiday'),
    discountOffer: text('discount_offer'),
    code: text('code'),
    officialDate: date('official_date'),
    country: text('country'),
    description: text('description'),
    confirmedByClient: boolean('confirmed_by_client').notNull().default(false),
    launched: boolean('launched').notNull().default(false),
    adsLaunchDate: date('ads_launch_date'),
    adsEndDate: date('ads_end_date'),
    productId: uuid('product_id').references(() => products.id),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('campaigns_offers_brand_id_idx').on(table.brandId),
    index('campaigns_offers_template_row_id_idx').on(table.templateRowId),
  ],
);

export type CampaignOffer = typeof campaignsOffers.$inferSelect;
export type NewCampaignOffer = typeof campaignsOffers.$inferInsert;
