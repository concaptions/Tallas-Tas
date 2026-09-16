import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { themeCategoryEnum } from './enums';

/**
 * The GLOBAL theme library (PRD §5.5, CLAUDE.md non-negotiable 3): one shared library across every
 * brand, never per-brand. The shared `brand_id` column stays null here and the `themes_global` check
 * constraint makes that structural — a row carrying a brand is rejected by Postgres, not by
 * convention. `themes` is therefore never a `BrandedTable` and is never reached through `withBrand`.
 *
 * `category` is the PRD's three kinds as a single-select enum (`theme_category`): a theme is a
 * framework, a production style or a seasonal hook, never several at once, which is why it is the
 * enum column itself rather than the `jsonb` set `angles.type` and `angles.formats` carry.
 */
export const themes = pgTable(
  'themes',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    category: themeCategoryEnum('category').notNull(),
    referenceLinks: jsonb('reference_links').$type<string[]>(),
    notes: text('notes'),
  },
  (table) => [check('themes_global', sql`${table.brandId} is null`)],
);

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
