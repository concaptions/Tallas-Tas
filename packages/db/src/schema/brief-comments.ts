import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { creativeBriefs } from './briefs';
import { users } from './users';

/**
 * Brief-scoped comment thread (Ticket 10, migration 0070). One row per comment, anchored to a brief
 * AND to a specific submission version — a comment is always said about a version of the cut, so
 * `submission_version` is NOT NULL (contrast with `briefAnnotations.submissionVersion`, which is
 * nullable because an annotation can be filed before any upload).
 *
 * `parent_comment_id` is self-referential and NULL on a root comment; a partial index keeps the
 * reply lookup cheap. Soft-deletable through `deleted_at`. The polymorphic `comments` table (sibling
 * file) stays beside this one; the unify ticket migrates its rows into this shape.
 */
export const briefComments = pgTable(
  'brief_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    briefId: uuid('brief_id')
      .notNull()
      .references(() => creativeBriefs.id, { onDelete: 'cascade' }),
    submissionVersion: integer('submission_version').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    body: text('body').notNull(),
    parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => briefComments.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('brief_comments_brief_version_idx').on(table.briefId, table.submissionVersion),
    index('brief_comments_parent_idx').on(table.parentCommentId),
  ],
);

export type BriefComment = typeof briefComments.$inferSelect;
export type NewBriefComment = typeof briefComments.$inferInsert;
