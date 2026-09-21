import { jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

/**
 * Columns for content tables that participate in parent-child template propagation (CLAUDE.md
 * architecture: "nullable template_row_id pointing at the parent row, overridden_fields jsonb
 * listing locally edited fields"). Spread after `baseColumns()` in each content table.
 *
 * `template_row_id` — the parent template row this child row was seeded from. Null on template
 * rows themselves. The FK is added per-table (self-referencing).
 *
 * `overridden_fields` — field names the child brand has locally edited. The propagation engine
 * skips these fields when pushing template updates. Defaults to empty array.
 *
 * `custom_fields` — JSONB bag for user-defined fields whose schema lives in `custom_field_schemas`.
 * Keeps the Postgres schema stable while letting strategists extend tables per-brand.
 */
export function propagationColumns() {
  return {
    templateRowId: uuid('template_row_id'),
    overriddenFields: jsonb('overridden_fields').$type<string[]>().notNull().default([]),
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
  };
}
