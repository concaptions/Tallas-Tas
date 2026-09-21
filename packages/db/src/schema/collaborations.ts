import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { concepts } from './concepts';
import { creativeBriefs } from './briefs';
import { creators } from './creators';

/**
 * A single collaboration instance between a creator and the brand (Talal feedback 2026-09-21).
 *
 * One creator can have 20-30+ active collaborations per month. Each collaboration ties to
 * an optional concept and brief, carries its own cost, dates, and three status tracks
 * (internal, client, assets). A collaboration is "past" when all three statuses are in a
 * terminal state (approved/complete).
 *
 * Money columns are whole US dollars (same convention as `creators.creator_cost`).
 * `internal_status` and `client_status` reuse the creator status vocabularies from
 * `@tas/domain/state`; `assets_status` reuses the creator assets status vocabulary.
 */
export const collaborationInstances = pgTable(
  'collaboration_instances',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id),
    conceptId: uuid('concept_id').references(() => concepts.id),
    briefId: uuid('brief_id').references(() => creativeBriefs.id),
    costUsd: integer('cost_usd'),
    startDate: timestamp('start_date', { withTimezone: true }),
    endDate: timestamp('end_date', { withTimezone: true }),
    internalStatus: text('internal_status').notNull().default('request'),
    clientStatus: text('client_status').notNull().default('pending_for_approval'),
    assetsStatus: text('assets_status').notNull().default('pending_for_cs_approval'),
    notes: text('notes'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('collab_brand_id_idx').on(table.brandId),
    index('collab_creator_id_idx').on(table.creatorId),
    index('collab_concept_id_idx').on(table.conceptId),
  ],
);

export type CollaborationInstance = typeof collaborationInstances.$inferSelect;
export type NewCollaborationInstance = typeof collaborationInstances.$inferInsert;
