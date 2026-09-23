import { boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { angles } from './angles';
import { assets } from './assets';
import { brands } from './brands';
import { campaignsOffers } from './campaigns';
import { collections } from './collections';
import { concepts } from './concepts';
import { products } from './products';
import type {
  CreativeFunnel,
  CreativeLanguage,
  CreativePerformance,
  CreativePlatform,
  CreativePriority,
  CreativeSource,
  CreativeType,
} from './enums';

/**
 * The value `internal_status` starts at: the FIRST entry of `INTERNAL_VIDEO_STATUS` in
 * `@tas/domain/state`, verbatim — a brief is handed to whoever builds it before anything exists.
 * A static brief is moved to `sent_to_designer` by the page, which reads the track from the brief's
 * `type`; the column default cannot, because a default cannot look at another column.
 *
 * The literals are repeated here rather than imported for the reason `schema/concepts.ts` gives at
 * length: `@tas/db` does not depend on `@tas/domain`, the edge runs the other way everywhere in this
 * repo, and `apps/web` is where the two are asserted equal.
 */
export const BRIEF_INTERNAL_STATUS_DEFAULT = 'sent_to_video_editor';

/** The first entry of `CLIENT_STATUS` in `@tas/domain/state`; see the note above on the literal. */
export const BRIEF_CLIENT_STATUS_DEFAULT = 'pending_for_approval';

/**
 * One record per creative asset (PRD §5.10, "the heart of the system").
 *
 * `concept_id` is NULLABLE and must stay that way: CLAUDE.md non-negotiable 5 and PRD §8 — "statics
 * don't always belong to a concept… a Creative Brief must be able to exist WITHOUT a parent
 * concept". Every field a linked brief inherits (concept name, angle, product) is therefore a join
 * that returns null rather than a column, and `listBriefs` is written so a standalone row costs
 * nothing extra.
 *
 * `name` is the auto-generated PRD §7 string
 * `{FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-V{VERSION}-(PRODUCT)` and is never typed by a user
 * (CLAUDE.md non-negotiable 6); the formula is the pure `creativeName` in
 * `packages/domain/src/creatives`, and this column only stores what that function returned.
 * `sequence` is the NUMBER in it: "the number increments per funnel+format combination within the
 * brand", so it is the brief's own column rather than a derived count — a row keeps the number it
 * was given even after an earlier brief is soft-deleted, which a `count(*)` would silently reuse.
 * `batch` is the BATCH segment; a linked brief copies its concept's batch, and a standalone brief
 * has no concept to copy one from, which is exactly why it is a column here and not a join.
 *
 * `inspo_links` and `dimensions` are `jsonb` arrays, both NOT NULL defaulting to `[]`, as on
 * `concepts.ad_inspo_links`: a reader maps them without branching on null. `dimensions` holds the
 * §8 defaults for the brief's type ("4:5", "1:1", "9:16" for video; "1:1", "9:16" for statics),
 * editable per row, and the vocabulary of ratios lives in `packages/domain/src/creatives`.
 *
 * `internal_status` and `client_status` are plain `text` carrying the KEYS of the two-track state
 * machine, the arrangement `schema/concepts.ts` documents: the machine in `packages/domain/src/state`
 * owns the set of states, the transitions and the client gate (`isClientTrackOpen`, which opens the
 * client track only at `approved` — PRD §9, CLAUDE.md non-negotiable 4). The three QA flags are
 * NOT NULL false, so a checklist renders three unticked boxes on a fresh row rather than three nulls.
 */
export const creativeBriefs = pgTable(
  'creative_briefs',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    conceptId: uuid('concept_id').references(() => concepts.id),
    angleId: uuid('angle_id').references(() => angles.id),
    productId: uuid('product_id').references(() => products.id),
    collectionId: uuid('collection_id').references(() => collections.id),
    campaignOfferId: uuid('campaign_offer_id').references(() => campaignsOffers.id),
    assetId: uuid('asset_id').references(() => assets.id),
    name: text('name').notNull(),
    batch: text('batch'),
    source: text('source').$type<CreativeSource>().notNull().default('TAS'),
    funnel: text('funnel').$type<CreativeFunnel>().notNull().default('TOF'),
    type: text('type').$type<CreativeType>().notNull().default('Video'),
    version: integer('version').notNull().default(1),
    sequence: integer('sequence').notNull().default(1),
    priority: text('priority').$type<CreativePriority>(),
    assignee: text('assignee'),
    briefToDesign: text('brief_to_design'),
    scriptContent: text('script_content'),
    elementsTested: text('elements_tested'),
    inspoLinks: jsonb('inspo_links').$type<string[]>().notNull().default([]),
    dimensions: jsonb('dimensions').$type<string[]>().notNull().default([]),
    platform: jsonb('platform').$type<CreativePlatform[]>().notNull().default([]),
    designFileUrl: text('design_file_url'),
    qaVideoEditor: boolean('qa_video_editor').notNull().default(false),
    qaDesigner: boolean('qa_designer').notNull().default(false),
    qaStrategist: boolean('qa_strategist').notNull().default(false),
    spellingFeedback: text('spelling_feedback'),
    spellingFeedback2: text('spelling_feedback_2'),
    clickForAiSpellChecker: boolean('click_for_ai_spell_checker').notNull().default(false),
    adContent: text('ad_content'),
    inspiration: text('inspiration'),
    inspirationImage: jsonb('inspiration_image').$type<string[]>(),
    qaChecklistDoc: jsonb('qa_checklist_doc').$type<string[]>(),
    designFile: jsonb('design_file').$type<string[]>(),
    scriptAndBriefBreakdown: jsonb('script_and_brief_breakdown').$type<string[]>(),
    language: text('language').$type<CreativeLanguage>(),
    offer: text('offer'),
    internalStatus: text('internal_status').notNull().default(BRIEF_INTERNAL_STATUS_DEFAULT),
    clientStatus: text('client_status').notNull().default(BRIEF_CLIENT_STATUS_DEFAULT),
    performance: text('performance').$type<CreativePerformance>(),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creative_briefs_brand_id_idx').on(table.brandId),
    index('creative_briefs_concept_id_idx').on(table.conceptId),
    index('creative_briefs_template_row_id_idx').on(table.templateRowId),
  ],
);

export type CreativeBrief = typeof creativeBriefs.$inferSelect;
export type NewCreativeBrief = typeof creativeBriefs.$inferInsert;
