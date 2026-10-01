import { boolean, date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { products } from './products';

/**
 * Campaigns & Offers (PRD §5.3; Airtable `tblRNaWCVa1cCIwLL`): ecomm offers, holidays and discount
 * codes. Internal only — never shown in the client interface (CLAUDE.md non-negotiable 10). The
 * `name` column is auto-generated from the Airtable formula
 * `CONCATENATE({Holiday},'-',{Discount Offer},'-',{Code})`, e.g. `BFCM-20%OFF-BFCM26`: the formula
 * field is stored rather than computed, per CLAUDE.md non-negotiable 6.
 *
 * Airtable field map. "Interested" (the template base's "Confirmed by Client") is
 * `confirmed_by_client`; "Promotional Ideas" (richText) is `promotional_ideas`. The record links
 * live in their owners' files: "Collections" is the reverse of `collections.campaign_id`; "COPY"
 * (→ Youtube Copywriting) is `youtube_copy_campaigns` in `schema/youtube-copy.ts`; "Ads Copywriting
 * copy" (→ Meta Copywriting) is `copywriting_campaigns` and "Angles" (→ Concepts, despite the name)
 * is `campaign_concepts`, both in `schema/campaign-links.ts`; "Email Campaigns" and "Email Campaigns
 * Management copy" live in `schema/email-campaigns.ts` and `schema/email-flows.ts`.
 *
 * Not stored: "Product" is a lookup through Collections — the direct `product_id` below is the
 * template base's own "(Internal) Product" link; "Design attached" is loose reference text with no
 * typed home.
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
    promotionalIdeas: text('promotional_ideas'),
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
