import { index, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { creativeBriefs } from './briefs';

/**
 * Creative Reporting (Airtable `tblgW4bwDSSeqihlr`): the hand-kept performance sheet the team fills
 * per launched ad — a name, the ad design and its link, and the headline Meta numbers against their
 * targets. This is NOT `ad_metrics`, which is the Meta-synced row (spend, impressions, clicks, a date
 * range, all NOT NULL); the audit (docs/audits/airtable-module-gap-2026-10-01.md §14) found the two
 * shapes differ too much to share a table. Stored fields, one to one:
 *
 * - "Name + Angle + Offer" → `name_angle_offer`, NOT NULL. The base's nominal primary field is
 *   "Creative Name", an invalid formula (it references the orphaned lookup below), so this text field
 *   is the row's effective name and the only field every record carries.
 * - Notes → `notes`; Ad Design (attachments) → `ad_design` (URLs); Ad Link → `ad_link`.
 * - CTR (percent, precision 2) → `ctr` numeric(6,4): the Airtable API returns a percent as a fraction
 *   (0.0412 = 4.12%), stored as-is, same convention as `ad_metrics.ctr`.
 * - Thumb-Stop Rate (number, precision 2) → `thumb_stop_rate` numeric(6,2);
 *   Results (number, precision 1) → `results` numeric(10,1); CPA and Target CPA (currency, 2) →
 *   `cpa`, `target_cpa` numeric(10,2); ROAS (number, 2) → `roas` numeric(8,2);
 *   Target ROAS (number, 1) → `target_roas` numeric(8,1).
 *
 * `brief_id` has no Airtable counterpart. The base once linked a report to a creative — all that
 * remains is the dangling lookup "Creative Name (from Creative)" (`recordLinkFieldId: null`, its
 * source link field deleted) — so the importer leaves it null and the platform sets it when a report
 * is filed against a brief. Nullable, FK to `creative_briefs`, indexed for the per-brief report list.
 *
 * Deliberately NOT stored, computed in the query layer instead:
 * - "Difference CPA" (formula, currency): `cpa - target_cpa`, trivially derived from two stored
 *   columns, and a stored copy could drift from them.
 * - "Creative Name" (formula, `isValid: false`) and "Creative Name (from Creative)" (lookup,
 *   `isValid: false`): both broken in the live base; the platform reads the name through `brief_id`.
 *
 * Branded and propagation-enabled like every other per-brand content table: `withBrand` scopes every
 * read and write.
 */
export const creativeReporting = pgTable(
  'creative_reporting',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    nameAngleOffer: text('name_angle_offer').notNull(),
    briefId: uuid('brief_id').references(() => creativeBriefs.id),
    notes: text('notes'),
    adDesign: jsonb('ad_design').$type<string[]>(),
    adLink: text('ad_link'),
    ctr: numeric('ctr', { precision: 6, scale: 4 }),
    thumbStopRate: numeric('thumb_stop_rate', { precision: 6, scale: 2 }),
    results: numeric('results', { precision: 10, scale: 1 }),
    cpa: numeric('cpa', { precision: 10, scale: 2 }),
    targetCpa: numeric('target_cpa', { precision: 10, scale: 2 }),
    roas: numeric('roas', { precision: 8, scale: 2 }),
    targetRoas: numeric('target_roas', { precision: 8, scale: 1 }),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creative_reporting_brand_id_idx').on(table.brandId),
    index('creative_reporting_template_row_id_idx').on(table.templateRowId),
    index('creative_reporting_brief_id_idx').on(table.briefId),
  ],
);

export type CreativeReport = typeof creativeReporting.$inferSelect;
export type NewCreativeReport = typeof creativeReporting.$inferInsert;
