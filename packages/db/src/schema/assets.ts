import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { concepts } from './concepts';
import { creators } from './creators';

/**
 * A file stored in the asset library (PRD §16 item 1): reference images/videos, B-rolls, raw
 * creator assets, or mood-board items linked to a concept. Branded: every asset belongs to exactly
 * one brand. The `r2Key` is the object key in Cloudflare R2; `url` is the public or presigned read
 * URL cached at upload time (regenerated when credentials rotate).
 */
export const assets = pgTable(
  'assets',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    r2Key: text('r2_key').notNull(),
    url: text('url').notNull(),
    category: text('category').$type<AssetCategory>().notNull(),
    conceptId: uuid('concept_id').references(() => concepts.id),
    // A creator's showcase video (Sprint 7, UGC media): the same R2-backed row, linked to the
    // creator instead of a concept, so the UGC panel reuses the attachment storage rather than a
    // second table. Nullable: most assets belong to a concept.
    creatorId: uuid('creator_id').references(() => creators.id),
    caption: text('caption'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('assets_brand_id_idx').on(table.brandId),
    index('assets_concept_id_idx').on(table.conceptId),
    index('assets_creator_id_idx').on(table.creatorId),
  ],
);

export const assetCategories = [
  'reference',
  'broll',
  'raw_asset',
  'mood_board',
  'showcase_video',
  'ad',
  'edited_footage',
] as const;
export type AssetCategory = (typeof assetCategories)[number];

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
