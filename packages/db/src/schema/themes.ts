import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/**
 * The GLOBAL theme library (PRD §5.5, CLAUDE.md non-negotiable 3): one shared library across every
 * brand, never per-brand. The shared `brand_id` column stays null here and the `themes_global` check
 * constraint makes that structural — a row carrying a brand is rejected by Postgres, not by
 * convention. `themes` is therefore never a `BrandedTable` and is never reached through `withBrand`.
 */
export const themes = pgTable(
  'themes',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    referenceLinks: jsonb('reference_links').$type<string[]>(),
    notes: text('notes'),
  },
  (table) => [check('themes_global', sql`${table.brandId} is null`)],
);

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
