import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { concepts } from './concepts';

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
    caption: text('caption'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('assets_brand_id_idx').on(table.brandId),
    index('assets_concept_id_idx').on(table.conceptId),
  ],
);

export const assetCategories = ['reference', 'broll', 'raw_asset', 'mood_board'] as const;
export type AssetCategory = (typeof assetCategories)[number];

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
