import { index, integer, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { creators } from './creators';

export const creatorRankings = pgTable(
  'creator_rankings',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id),
    creatorName: text('creator_name').notNull(),
    totalAds: integer('total_ads').notNull(),
    totalSpend: numeric('total_spend', { precision: 12, scale: 2 }).notNull(),
    totalConversions: integer('total_conversions').notNull(),
    avgRoas: numeric('avg_roas', { precision: 8, scale: 2 }),
    avgCpa: numeric('avg_cpa', { precision: 10, scale: 2 }),
    rank: integer('rank').notNull(),
    periodLabel: text('period_label').notNull(),
  },
  (table) => [
    index('creator_rankings_brand_id_idx').on(table.brandId),
    index('creator_rankings_creator_id_idx').on(table.creatorId),
  ],
);

export type CreatorRanking = typeof creatorRankings.$inferSelect;
export type NewCreatorRanking = typeof creatorRankings.$inferInsert;
