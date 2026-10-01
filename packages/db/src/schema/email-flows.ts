import { date, index, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { campaignsOffers } from './campaigns';
import type { EmailChannelsKey, EmailFlowStatusesKey } from './enums';

/**
 * Email Flows Management (Airtable `tblubVflAQZgJSxcF` in the live Gratsi base; absent from the
 * template base): one row per automated Klaviyo flow (welcome series, abandoned cart, ...), as
 * opposed to `email_campaigns`, which are one-off sends. The lifecycle lives in `status`, the
 * `emailFlowStatuses` vocabulary (`enums.ts`): the campaign workflow with Live and Pending in place of
 * Scheduled. `type` is the base's "Type" single select, whose three options are exactly the
 * campaigns' "Channel" (Email, SMS, Push Notification), so it shares `emailChannels`. `copywriting`
 * is the body copy (richText in the base), `klaviyo_link` the url field, and `design` / `inspo` carry
 * the two attachment fields as arrays of file URLs, the shape every attachment column uses.
 * `assignee_id` is the "Assignee" singleCollaborator as a Clerk user id, the way `themes.assignee_id`
 * stores one.
 *
 * Two base fields are formulas and are deliberately NOT stored; the UI derives them from
 * `expected_setup_date`:
 * - "Design Due Date" = `DATEADD({Expected Setup Date}, -5, 'days')` → `expected_setup_date` − 5 days.
 * - "Copywriting Due Date" = `DATEADD({Design Due Date}, -5, 'days')` → `expected_setup_date` − 10 days.
 *
 * The one multipleRecordLinks field, "Campaigns & Offers" (flagged prefersSingleRecordLink in the
 * base, still a multi-link), is the `email_flow_campaigns` junction below; the base's inverse link,
 * Campaigns & Offers "Email Campaigns Management copy", reads the same rows the other way.
 *
 * Branded and propagation-enabled like every other per-brand content table: seeded from the parent
 * template, `withBrand` scopes every read and write. Internal only, never shown to clients.
 */
export const emailFlows = pgTable(
  'email_flows',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    flowName: text('flow_name').notNull(),
    expectedSetupDate: date('expected_setup_date'),
    flowPurpose: text('flow_purpose'),
    status: text('status').$type<EmailFlowStatusesKey>(),
    copywriting: text('copywriting'),
    design: jsonb('design').$type<string[]>(),
    klaviyoLink: text('klaviyo_link'),
    type: text('type').$type<EmailChannelsKey>(),
    inspo: jsonb('inspo').$type<string[]>(),
    assigneeId: text('assignee_id'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('email_flows_brand_id_idx').on(table.brandId),
    index('email_flows_template_row_id_idx').on(table.templateRowId),
  ],
);

export type EmailFlow = typeof emailFlows.$inferSelect;
export type NewEmailFlow = typeof emailFlows.$inferInsert;

/**
 * Many-to-many: email flow ↔ campaign/offer (Airtable "Campaigns & Offers" multipleRecordLinks on
 * `tblubVflAQZgJSxcF`; the inverse is Campaigns & Offers "Email Campaigns Management copy").
 */
export const emailFlowCampaigns = pgTable(
  'email_flow_campaigns',
  {
    emailFlowId: uuid('email_flow_id')
      .notNull()
      .references(() => emailFlows.id, { onDelete: 'cascade' }),
    campaignOfferId: uuid('campaign_offer_id')
      .notNull()
      .references(() => campaignsOffers.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.emailFlowId, table.campaignOfferId] })],
);

export type EmailFlowCampaign = typeof emailFlowCampaigns.$inferSelect;
