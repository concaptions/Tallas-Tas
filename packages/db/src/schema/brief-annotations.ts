import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { creativeBriefs } from './briefs';
import { users } from './users';

/**
 * Brief-scoped frame-level annotations (Ticket 10, migration 0070). One row per pin on a creative,
 * anchored to the brief and optionally to a submission version — nullable so an annotation can be
 * filed before an upload exists. The polymorphic `annotations` table (sibling file) stays beside
 * this one; a later unify ticket migrates the polymorphic rows into this shape and drops the
 * polymorphic schemas (docs/decisions.md 2026-10-14 entry).
 *
 * `x_pct` and `y_pct` are percentages (0–100) with two decimals, so the overlay reads a fractional
 * coordinate without a round trip to pixels. CHECK constraints enforce the range at the database.
 * Soft-deletable through `deleted_at`; see `briefAnnotations.ts` for the writers.
 */
export const briefAnnotations = pgTable(
  'brief_annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    briefId: uuid('brief_id')
      .notNull()
      .references(() => creativeBriefs.id, { onDelete: 'cascade' }),
    submissionVersion: integer('submission_version'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    xPct: numeric('x_pct', { precision: 5, scale: 2 }).notNull(),
    yPct: numeric('y_pct', { precision: 5, scale: 2 }).notNull(),
    note: text('note').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('brief_annotations_brief_version_idx').on(table.briefId, table.submissionVersion),
    check('brief_annotations_x_pct_check', sql`${table.xPct} BETWEEN 0 AND 100`),
    check('brief_annotations_y_pct_check', sql`${table.yPct} BETWEEN 0 AND 100`),
  ],
);

export type BriefAnnotation = typeof briefAnnotations.$inferSelect;
export type NewBriefAnnotation = typeof briefAnnotations.$inferInsert;
