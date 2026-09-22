import { type AnyPgColumn, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * Threaded comments on any record type (PRD §10, Sprint 6). A comment belongs to a brand + record
 * (polymorphic `record_type` + `record_id`), and threading is a self-referencing `parent_comment_id`
 * with max depth enforced in domain logic (2 levels: top-level + one reply level).
 *
 * `authorName` is denormalised at write time so the client portal can display it without joining to
 * Clerk. The tradeoff is a stale name if someone renames their account; the benefit is that client
 * queries never touch internal user tables.
 */
export const comments = pgTable(
  'comments',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    recordType: text('record_type').notNull(),
    recordId: uuid('record_id').notNull(),
    parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id),
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull(),
    body: text('body').notNull(),
  },
  (table) => [
    index('comments_brand_record_idx').on(table.brandId, table.recordType, table.recordId),
    index('comments_parent_comment_id_idx').on(table.parentCommentId),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
