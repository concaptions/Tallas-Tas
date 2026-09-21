import { index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { concepts } from './concepts';
import { creativeBriefs } from './briefs';

export const adMetrics = pgTable(
  'ad_metrics',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    briefId: uuid('brief_id').references(() => creativeBriefs.id),
    conceptId: uuid('concept_id').references(() => concepts.id),
    metaAdId: text('meta_ad_id'),
    adName: text('ad_name').notNull(),
    spend: numeric('spend', { precision: 12, scale: 2 }).notNull(),
    impressions: integer('impressions').notNull(),
    clicks: integer('clicks').notNull(),
    conversions: integer('conversions').notNull(),
    ctr: numeric('ctr', { precision: 6, scale: 4 }),
    cpc: numeric('cpc', { precision: 10, scale: 2 }),
    cpa: numeric('cpa', { precision: 10, scale: 2 }),
    roas: numeric('roas', { precision: 8, scale: 2 }),
    dateRange: text('date_range').notNull(),
  },
  (table) => [
    index('ad_metrics_brand_id_idx').on(table.brandId),
    index('ad_metrics_concept_id_idx').on(table.conceptId),
    index('ad_metrics_brief_id_idx').on(table.briefId),
  ],
);

export type AdMetric = typeof adMetrics.$inferSelect;
export type NewAdMetric = typeof adMetrics.$inferInsert;
