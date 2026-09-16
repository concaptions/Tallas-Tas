import { text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Columns every table carries (CLAUDE.md, "no exceptions"). Spread the result into each table:
 * `pgTable('name', { ...baseColumns(), ... })`. A fresh set of builders per call, because a Drizzle
 * builder mutates in place when a table chains `.references()` or `.notNull()` on it.
 *
 * `brand_id` is nullable: global tables (themes) leave it null. A branded table overrides it with
 * `.notNull().references(() => brands.id)` (first done by `brand_assignments`, TICKET-005); the
 * foreign key on the shared column itself lands with the Phase 2 per-brand columns. `created_by` and
 * `updated_by` stay free text (a Clerk user id) rather than a foreign key to `users`.
 */
export function baseColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  };
}
