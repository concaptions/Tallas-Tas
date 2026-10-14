import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { creativeBriefs } from './briefs';
import { users } from './users';

/**
 * The uploads history for a brief (Ticket 11, migration 0071). One row per submission; at most one
 * row per brief carries `is_current = true` (enforced by the partial unique index), so the version
 * chip row and the annotation link never see two "current" rows for one brief.
 *
 * `thumbnail_url` and `duration_seconds` are nullable: an image upload has no duration, and a new
 * row may render before its thumbnail is derived. `version` is per-brief and 1-based; the writer
 * takes `pg_advisory_xact_lock(hashtext(briefId))` to serialise concurrent uploads.
 */
export const briefSubmissions = pgTable(
  'brief_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    briefId: uuid('brief_id')
      .notNull()
      .references(() => creativeBriefs.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    fileUrl: text('file_url').notNull(),
    fileType: text('file_type').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: integer('duration_seconds'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    isCurrent: boolean('is_current').notNull().default(false),
  },
  (table) => [
    uniqueIndex('brief_submissions_brief_version_unique').on(table.briefId, table.version),
    uniqueIndex('brief_submissions_one_current')
      .on(table.briefId)
      .where(sql`${table.isCurrent} = true`),
    index('brief_submissions_brief_idx').on(table.briefId),
  ],
);

export type BriefSubmission = typeof briefSubmissions.$inferSelect;
export type NewBriefSubmission = typeof briefSubmissions.$inferInsert;
