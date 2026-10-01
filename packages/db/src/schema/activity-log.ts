import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * The activity log (Sprint 10, EDIT-03): one row per changed field per write — who changed which
 * field of which record, from what to what, when. Written by Server Actions only (`insertActivity`
 * beside the row update), never by a client, so it records what the database was told. Per-brand
 * like every record it describes; `entity_type` + `entity_id` name the record (`creative_brief`
 * today, any table tomorrow) without a foreign key per table. `created_at` from the shared helper
 * is the timestamp; `created_by` is the actor's id and `actor_name` what the page prints.
 */
export const activityLog = pgTable(
  'activity_log',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    field: text('field').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    actorName: text('actor_name'),
  },
  (table) => [
    index('activity_log_brand_id_idx').on(table.brandId),
    index('activity_log_entity_idx').on(table.entityType, table.entityId),
  ],
);

export type ActivityEntry = typeof activityLog.$inferSelect;
export type NewActivityEntry = typeof activityLog.$inferInsert;
