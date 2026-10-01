import { date, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { campaignsOffers } from './campaigns';
import { collections } from './collections';
import type { EmailCampaignStatusesKey, EmailCampaignTypesKey, EmailChannelsKey } from './enums';
import { products } from './products';

/**
 * Email Campaigns Management (Airtable `tblABjVpwRpYtY7de` in the live Gratsi base; absent from the
 * template base): one row per planned email, SMS or push send. The lifecycle lives in `status`, the
 * eleven-step `emailCampaignStatuses` vocabulary (`enums.ts`); `type` is the campaign kind
 * (`emailCampaignTypes`) and `channel` the delivery channel (`emailChannels`). `copywriting` is the
 * body copy (richText in the base), `copy_link` and `klaviyo_link` are the Airtable url fields, and
 * `design` / `assets` carry the two attachment fields as arrays of file URLs, the shape every
 * attachment column uses. `assignee_id` is the "Assignee" singleCollaborator as a Clerk user id, the
 * way `themes.assignee_id` stores one.
 *
 * Two base fields are formulas and are deliberately NOT stored; the UI derives them from `send_date`:
 * - "Design Due Date" = `DATEADD({Send Date}, -5, 'days')` → `send_date` − 5 days.
 * - "Copywriting Due Date" = `DATEADD({Design Due Date}, -5, 'days')` → `send_date` − 10 days.
 *
 * The three multipleRecordLinks fields are the junctions below: "Campaigns & Offers" (flagged
 * prefersSingleRecordLink in the base, still a multi-link) → `email_campaign_campaigns`,
 * "(Internal) Product" → `email_campaign_products`, "(Internal) Collections" →
 * `email_campaign_collections`. The base's inverse links (Campaigns & Offers "Email Campaigns",
 * Product "Table 17", Collections "Table 17") read the same junction rows the other way.
 *
 * Branded and propagation-enabled like every other per-brand content table: seeded from the parent
 * template, `withBrand` scopes every read and write. Internal only, never shown to clients.
 */
export const emailCampaigns = pgTable(
  'email_campaigns',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    campaignPurpose: text('campaign_purpose'),
    status: text('status').$type<EmailCampaignStatusesKey>(),
    sendDate: date('send_date'),
    copywriting: text('copywriting'),
    assigneeId: text('assignee_id'),
    copyLink: text('copy_link'),
    design: jsonb('design').$type<string[]>(),
    klaviyoLink: text('klaviyo_link'),
    assets: jsonb('assets').$type<string[]>(),
    type: text('type').$type<EmailCampaignTypesKey>(),
    channel: text('channel').$type<EmailChannelsKey>(),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('email_campaigns_brand_id_idx').on(table.brandId),
    index('email_campaigns_template_row_id_idx').on(table.templateRowId),
  ],
);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert;

/**
 * Many-to-many: email campaign ↔ campaign/offer (Airtable "Campaigns & Offers" multipleRecordLinks
 * on `tblABjVpwRpYtY7de`; the inverse is Campaigns & Offers "Email Campaigns").
 */
export const emailCampaignCampaigns = pgTable(
  'email_campaign_campaigns',
  {
    emailCampaignId: uuid('email_campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    campaignOfferId: uuid('campaign_offer_id')
      .notNull()
      .references(() => campaignsOffers.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.emailCampaignId, table.campaignOfferId] })],
);

/**
 * Many-to-many: email campaign ↔ product (Airtable "(Internal) Product" multipleRecordLinks on
 * `tblABjVpwRpYtY7de`; the inverse is (Internal) Product "Table 17").
 */
export const emailCampaignProducts = pgTable(
  'email_campaign_products',
  {
    emailCampaignId: uuid('email_campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.emailCampaignId, table.productId] })],
);

/**
 * Many-to-many: email campaign ↔ collection (Airtable "(Internal) Collections" multipleRecordLinks
 * on `tblABjVpwRpYtY7de`; the inverse is (Internal) Collections "Table 17").
 */
export const emailCampaignCollections = pgTable(
  'email_campaign_collections',
  {
    emailCampaignId: uuid('email_campaign_id')
      .notNull()
      .references(() => emailCampaigns.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.emailCampaignId, table.collectionId] })],
);

export type EmailCampaignCampaign = typeof emailCampaignCampaigns.$inferSelect;
export type EmailCampaignProduct = typeof emailCampaignProducts.$inferSelect;
export type EmailCampaignCollection = typeof emailCampaignCollections.$inferSelect;
