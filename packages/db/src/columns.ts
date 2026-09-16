import { text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Columns every table carries (CLAUDE.md, "no exceptions"). Spread the result into each table:
 * `pgTable('name', { ...baseColumns(), ... })`. A fresh set of builders per call, because a Drizzle
 * builder mutates in place when a table chains `.references()` or `.notNull()` on it.
 *
 * `brand_id` is nullable: global tables (themes) leave it null and the foreign key to `brands` arrives
 * with TICKET-005. `created_by` and `updated_by` stay free text until `users` exists.
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
