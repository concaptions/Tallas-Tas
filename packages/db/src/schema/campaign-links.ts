import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { campaignsOffers } from './campaigns';
import { concepts } from './concepts';
import { copywriting } from './copy';

/**
 * Many-to-many: Meta Copywriting "Campaign Code" (`tblZpBYPTcZcmQ1Kf`, multipleRecordLinks →
 * Campaigns & Offers `tblRNaWCVa1cCIwLL`); the campaign-side "Ads Copywriting copy" field is its
 * inverse. Airtable prefers a single link on the copy side, so the importer writes at most one row
 * per copy; a junction rather than a `campaign_offer_id` on `copywriting` keeps PRD §5.11's lean copy
 * table untouched and the shape symmetric with `youtube_copy_campaigns`. The three Airtable lookups
 * through this link — "Offer", "Campaign (from Campaign)", "Code (from Campaign)" — are not stored;
 * a read joins `campaigns_offers`.
 */
export const copywritingCampaigns = pgTable(
  'copywriting_campaigns',
  {
    copyId: uuid('copy_id')
      .notNull()
      .references(() => copywriting.id, { onDelete: 'cascade' }),
    campaignOfferId: uuid('campaign_offer_id')
      .notNull()
      .references(() => campaignsOffers.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.copyId, table.campaignOfferId] })],
);

/**
 * Many-to-many: Campaigns & Offers "Angles" (`tblRNaWCVa1cCIwLL`, multipleRecordLinks). DESPITE ITS
 * NAME the field links to `tbl4UFSFcynlS2Pkn`, which in the Gratsi base is the CONCEPTS table (the
 * template base calls that id "Angles"; gap audit 2026-10-01 §4 documents the swap), so the target
 * is `concepts`, not `angles`. Owned by the campaign side; the concept page reads the rows back.
 */
export const campaignConcepts = pgTable(
  'campaign_concepts',
  {
    campaignOfferId: uuid('campaign_offer_id')
      .notNull()
      .references(() => campaignsOffers.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.campaignOfferId, table.conceptId] })],
);

export type CopywritingCampaign = typeof copywritingCampaigns.$inferSelect;
export type CampaignConcept = typeof campaignConcepts.$inferSelect;
