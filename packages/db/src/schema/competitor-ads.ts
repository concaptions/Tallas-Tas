import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

export const competitorAds = pgTable(
  'competitor_ads',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    platform: text('platform').notNull(),
    advertiserName: text('advertiser_name').notNull(),
    adUrl: text('ad_url').notNull(),
    headline: text('headline'),
    bodyText: text('body_text'),
    format: text('format').notNull(),
    estimatedSpend: text('estimated_spend'),
    daysActive: integer('days_active'),
    firstSeen: text('first_seen').notNull(),
    lastSeen: text('last_seen'),
    notes: text('notes'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [index('competitor_ads_brand_id_idx').on(table.brandId)],
);

export const adPlatforms = ['meta', 'tiktok', 'youtube', 'google'] as const;
export type AdPlatform = (typeof adPlatforms)[number];

export type CompetitorAd = typeof competitorAds.$inferSelect;
export type NewCompetitorAd = typeof competitorAds.$inferInsert;
