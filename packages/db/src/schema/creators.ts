import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import type { CreatorAgeBracket, CreatorPlatform } from './enums';

/**
 * The value each of the three status tracks starts at: the FIRST entry of the matching list in
 * `@tas/domain/state`, verbatim.
 *
 * The literals are repeated here rather than imported for the reason `schema/copy.ts` gives at
 * length: `@tas/db` does not depend on `@tas/domain`, the edge runs the other way everywhere in this
 * repo, and `apps/web` is where the two are asserted equal. The domain owns the SET of states and
 * their labels; these columns only store which one a row is in.
 */

/** First entry of `CREATOR_INTERNAL_STATUS`: a creator begins as a request nobody has looked at. */
export const CREATOR_INTERNAL_STATUS_DEFAULT = 'request';

/** First entry of `CREATOR_STATUS` (PRD §5.8's client-facing track): waiting on the client. */
export const CREATOR_CLIENT_STATUS_DEFAULT = 'pending_for_approval';

/** First entry of `CREATOR_ASSETS_STATUS`: delivered footage waiting on a CS review. */
export const CREATOR_ASSETS_STATUS_DEFAULT = 'pending_for_cs_approval';

/**
 * First entry of `PARTNERSHIP_ACTIVITY` (Active / Not Active / Ended). A creator row exists long
 * before anyone whitelists their handle, so "not active" is where every row starts — including the
 * rows that will never run a partnership ad at all (`for_partnership_ads` false).
 */
export const PARTNERSHIP_ACTIVITY_DEFAULT = 'not_active';

/**
 * The creators TAS hires and the client approves (PRD §5.8), with the partnership / whitelisting
 * fields §5.8.1 puts "inside the UGC management Table" on the SAME record.
 *
 * One table, not two. §5.8.1 is explicit that these are fields of the UGC record, and the data
 * agrees: a partnership is struck with a creator the brand already hired, it is keyed by the
 * creator's own Instagram handle, and "Continue Working With?" is a question about the creator, not
 * about an ad. A second `partnership_ads` table would have had a 1:1 foreign key back to this one
 * and two rows that could disagree about who the creator is. `for_partnership_ads` — PRD §5.8.1's
 * "up-front qualifier" — is the discriminator instead, and `listPartnershipCreators` is the
 * client-facing list §5.8.1 asks for (the Gratsi list) rather than a separate table.
 *
 * THREE STATUS TRACKS, exactly as §5.8 lists them, all plain `text` carrying a KEY of
 * `@tas/domain/state`: `internal_creator_status` (Request → Pending for CS Approval → Revisions
 * Needed → Approved), `client_status` (the client-facing one, the only track the client interface
 * ever renders, CLAUDE.md non-negotiable 10) and `internal_assets_status` (the same three-state
 * review applied to the footage that comes back). `client_note` is what the client wrote back; null
 * on every row they have not commented on.
 *
 * MONEY. `budget_per_60s`, `creator_cost` and `partnership_price_per_30_days` are integers holding
 * WHOLE US DOLLARS, not cents. Creator rates are quoted, negotiated and invoiced in whole dollars
 * (a Fiverr gig is $180, never $180.40), none of the three is ever divided by anything, and whole
 * dollars keep the fixtures, the seed and a CSV export legible. If a brand ever needs cents the
 * migration is a column type change, not a re-interpretation of stored values. All three are
 * internal-only figures the client interface never reads (non-negotiable 10).
 *
 * EXPIRY IS NOT STORED. `partnership_activated_at`, `partnership_period_days` (30/60/90) and
 * `extension_days` are the three inputs; the date permission lapses is `partnershipExpiresOn` in
 * `packages/domain`, a pure function (CLAUDE.md: business logic is never in a query or a component).
 * A stored expiry column would go stale the moment an extension is granted, and the 25-day reminder
 * PRD §5.8.1 asks for reads the same function rather than a second copy of the arithmetic.
 *
 * `extension_days` is NOT NULL defaulting to 0, so the arithmetic is total: a partnership with no
 * extension adds zero days rather than forcing every caller to coalesce a null. `period_days` is
 * nullable because a row that was never activated has no period, and `continue_working_with` is a
 * NULLABLE boolean because "nobody has decided yet" is a real third state of that question and the
 * one most rows sit in.
 *
 * Branded: `brand_id` is NOT NULL, so `withBrand` scopes every read and write.
 */
export const creators = pgTable(
  'creators',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),

    // Core (PRD §5.8), in the PRD's own order. Only `name` is required: a creator is added the
    // moment someone has a name and a link, and the rest is filled in over the booking.
    name: text('name').notNull(),
    ageBracket: text('age_bracket').$type<CreatorAgeBracket>(),
    gender: text('gender'),
    ethnicity: text('ethnicity'),
    profilePicUrl: text('profile_pic_url'),
    videoIntroUrl: text('video_intro_url'),
    creatorLink: text('creator_link'),
    platform: text('platform').$type<CreatorPlatform>(),
    internalBrief: text('internal_brief'),
    shippingLocation: text('shipping_location'),
    trackingNumber: text('tracking_number'),
    dateOfManagement: timestamp('date_of_management', { withTimezone: true }),
    deadline: timestamp('deadline', { withTimezone: true }),
    budgetPer60s: integer('budget_per_60s'),
    creatorCost: integer('creator_cost'),

    // The three tracks of PRD §5.8 plus the client's note.
    internalCreatorStatus: text('internal_creator_status')
      .notNull()
      .default(CREATOR_INTERNAL_STATUS_DEFAULT),
    clientStatus: text('client_status').notNull().default(CREATOR_CLIENT_STATUS_DEFAULT),
    internalAssetsStatus: text('internal_assets_status')
      .notNull()
      .default(CREATOR_ASSETS_STATUS_DEFAULT),
    clientNote: text('client_note'),

    // Partnership / whitelisted ads (PRD §5.8.1), fields of this same record.
    instagramUsername: text('instagram_username'),
    forPartnershipAds: boolean('for_partnership_ads').notNull().default(false),
    partnershipActivity: text('partnership_activity')
      .notNull()
      .default(PARTNERSHIP_ACTIVITY_DEFAULT),
    partnershipActivatedAt: timestamp('partnership_activated_at', { withTimezone: true }),
    partnershipPeriodDays: integer('partnership_period_days'),
    continueWorkingWith: boolean('continue_working_with'),
    extensionDays: integer('extension_days').notNull().default(0),
    partnershipPricePer30Days: integer('partnership_price_per_30_days'),
    partnershipNotes: text('partnership_notes'),
    facebookProfileUrl: text('facebook_profile_url'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creators_brand_id_idx').on(table.brandId),
    // The §5.8.1 list is always "this brand's partnership creators", never a global scan, so the
    // qualifier is indexed WITH the brand rather than on its own.
    index('creators_partnership_idx').on(table.brandId, table.forPartnershipAds),
  ],
);

export type Creator = typeof creators.$inferSelect;
export type NewCreator = typeof creators.$inferInsert;
