import { boolean, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { campaignsOffers } from './campaigns';
import { collections } from './collections';
import { COPY_STATUS_DEFAULT } from './copy';
import { copyTypes } from './copy-types';
import type { YoutubeCopyCtasKey, YoutubeCopyFunnelsKey } from './enums';
import { products } from './products';

/**
 * Youtube Copywriting (Airtable `tblVR1UmkbDoDzJ7z`): YouTube ad copy, a SEPARATE table from
 * `copywriting` (Meta Copywriting, `tblZpBYPTcZcmQ1Kf`). The importer used to read this table only
 * as a fallback when Meta Copywriting was empty and wrote both into `copywriting`, which has no
 * channel column, so rows from the two could not be told apart afterwards (gap audit 2026-10-01
 * §2.12). Its own table keeps the channels apart and lets the wider YouTube "Funnel" vocabulary
 * (`youtubeCopyFunnels`: MOF & BOF, POST PURCHASE, ALL FUNNELS) exist without widening `copyFunnels`.
 *
 * Stored fields, Airtable name → column:
 *   - "Copy #" (primary, singleLineText such as "Copy 3") → `copy_number`: the importer parses the
 *     integer; the title is generated from it (CLAUDE.md non-negotiable 6), never typed. The default
 *     of 1 covers a row created in the platform before it is numbered.
 *   - "Status" → `status`: a KEY of `COPY_STATUS` in `@tas/domain/state`; the five Gratsi choices
 *     match it exactly, and the default is `COPY_STATUS_DEFAULT` from `schema/copy.ts` for the
 *     reason that file gives (`@tas/db` does not import `@tas/domain`).
 *   - "Angle" (singleLineText) → `angle`: loose text in Gratsi, not a link to `angles`.
 *   - "Descriptions (90 caractères max)" (richText) → `descriptions`: the 90-character limit is
 *     helper text and validation in the panel, never a database constraint, as `schema/copy.ts`
 *     argues for its own character guidance.
 *   - "Headline" → `headline`; "News Feed" → `news_feed`; "Client's Comment" → `client_comment`.
 *   - "CTA" → `cta` (`youtubeCopyCtas` key); "Funnel" → `funnel` (`youtubeCopyFunnels` key).
 *   - "USED" → `used`; "Winning" → `winning`; "Meta Rating" (rating, max 5) → `meta_rating`.
 *
 * Record links, each a junction below: "Collections" → `youtube_copy_collections`; "Product" →
 * `youtube_copy_products`; "Campaign Code" → `youtube_copy_campaigns` (Airtable prefers a single
 * link on this field, so the importer writes at most one row per copy; a junction keeps the shape
 * symmetric with `copywriting_campaigns`); "Copy Type" → `youtube_copy_copy_types`.
 *
 * Computed fields deliberately NOT stored: "Offer", "Campaign (from Campaign)" and "Code (from
 * Campaign)" are lookups through Campaign Code, read by joining `campaigns_offers`; "Collection
 * URL" is a lookup through Collections and "Link (from Product)" through Product; "Creative" and
 * "Products (from Collections)" are lookups whose source link no longer exists (isValid = false);
 * "Created By" is `created_by`. Not stored either: "Creative Reporting", "Creative Sheet",
 * "(Internal) Product" and "(Internal) Creative Design" are singleLineText remnants of former links
 * whose datum lives on the typed links above, and "⚠️ Please Change the Status of the copy" is a UI
 * instruction banner, not data.
 *
 * Branded and propagation-enabled like every other per-brand content table: seeded from the parent
 * template, `withBrand` scopes every read and write.
 */
export const youtubeCopy = pgTable(
  'youtube_copy',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    copyNumber: integer('copy_number').notNull().default(1),
    status: text('status').notNull().default(COPY_STATUS_DEFAULT),
    angle: text('angle'),
    descriptions: text('descriptions'),
    headline: text('headline'),
    newsFeed: text('news_feed'),
    cta: text('cta').$type<YoutubeCopyCtasKey>(),
    funnel: text('funnel').$type<YoutubeCopyFunnelsKey>(),
    clientComment: text('client_comment'),
    used: boolean('used').notNull().default(false),
    winning: boolean('winning').notNull().default(false),
    metaRating: integer('meta_rating'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('youtube_copy_brand_id_idx').on(table.brandId),
    index('youtube_copy_template_row_id_idx').on(table.templateRowId),
  ],
);

export type YoutubeCopy = typeof youtubeCopy.$inferSelect;
export type NewYoutubeCopy = typeof youtubeCopy.$inferInsert;

/** Many-to-many: Youtube Copywriting "Collections" (multipleRecordLinks → `tbl6LBNrRqa6Hh4I2`). */
export const youtubeCopyCollections = pgTable(
  'youtube_copy_collections',
  {
    youtubeCopyId: uuid('youtube_copy_id')
      .notNull()
      .references(() => youtubeCopy.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.youtubeCopyId, table.collectionId] })],
);

/** Many-to-many: Youtube Copywriting "Product" (multipleRecordLinks → `tblfvfJMYNBz2OYYw`). */
export const youtubeCopyProducts = pgTable(
  'youtube_copy_products',
  {
    youtubeCopyId: uuid('youtube_copy_id')
      .notNull()
      .references(() => youtubeCopy.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.youtubeCopyId, table.productId] })],
);

/**
 * Many-to-many: Youtube Copywriting "Campaign Code" (multipleRecordLinks → `tblRNaWCVa1cCIwLL`,
 * prefersSingleRecordLink). The campaign-side "COPY" field is its inverse.
 */
export const youtubeCopyCampaigns = pgTable(
  'youtube_copy_campaigns',
  {
    youtubeCopyId: uuid('youtube_copy_id')
      .notNull()
      .references(() => youtubeCopy.id, { onDelete: 'cascade' }),
    campaignOfferId: uuid('campaign_offer_id')
      .notNull()
      .references(() => campaignsOffers.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.youtubeCopyId, table.campaignOfferId] })],
);

/**
 * Many-to-many: Youtube Copywriting "Copy Type" (multipleRecordLinks → `tblQiBPj9ypCmYxev`). The
 * copy-type side's "Copywriting" field is its inverse.
 */
export const youtubeCopyCopyTypes = pgTable(
  'youtube_copy_copy_types',
  {
    youtubeCopyId: uuid('youtube_copy_id')
      .notNull()
      .references(() => youtubeCopy.id, { onDelete: 'cascade' }),
    copyTypeId: uuid('copy_type_id')
      .notNull()
      .references(() => copyTypes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.youtubeCopyId, table.copyTypeId] })],
);

export type YoutubeCopyCollection = typeof youtubeCopyCollections.$inferSelect;
export type YoutubeCopyProduct = typeof youtubeCopyProducts.$inferSelect;
export type YoutubeCopyCampaign = typeof youtubeCopyCampaigns.$inferSelect;
export type YoutubeCopyCopyType = typeof youtubeCopyCopyTypes.$inferSelect;
