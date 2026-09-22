import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';

/**
 * Competitive Research: competitor intelligence records. Branded, propagation-enabled.
 *
 * 7 Airtable fields: Name, Type (single-select), Website, Insta, FB Page,
 * Meta Ads Library (long text), Analysis (long text).
 */
export const competitiveResearch = pgTable(
  'competitive_research',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    name: text('name').notNull(),
    type: text('type'),
    website: text('website'),
    instagram: text('instagram'),
    facebookPage: text('facebook_page'),
    metaAdsLibrary: text('meta_ads_library'),
    analysis: text('analysis'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('competitive_research_brand_id_idx').on(table.brandId),
    index('competitive_research_template_row_id_idx').on(table.templateRowId),
  ],
);

export type CompetitiveResearchEntry = typeof competitiveResearch.$inferSelect;
export type NewCompetitiveResearchEntry = typeof competitiveResearch.$inferInsert;
