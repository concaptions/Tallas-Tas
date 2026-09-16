import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { angles } from './angles';
import { brands } from './brands';
import { themes } from './themes';

/**
 * One Angle paired with one Theme (PRD §5.7). `name` is the auto-generated `Batch-Angle-Theme`
 * string (CLAUDE.md non-negotiable 6) and is never typed by hand; the formula itself belongs to
 * `packages/domain/naming`. `theme_id` points at the global theme library, which carries no brand.
 */
export const concepts = pgTable(
  'concepts',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    angleId: uuid('angle_id').references(() => angles.id),
    themeId: uuid('theme_id').references(() => themes.id),
    name: text('name').notNull(),
    batch: text('batch'),
    category: text('category'),
    conceptStyle: text('concept_style'),
    hookExamples: text('hook_examples'),
    scriptIdea: text('script_idea'),
  },
  (table) => [
    index('concepts_brand_id_idx').on(table.brandId),
    index('concepts_angle_id_idx').on(table.angleId),
    index('concepts_theme_id_idx').on(table.themeId),
  ],
);

export type Concept = typeof concepts.$inferSelect;
export type NewConcept = typeof concepts.$inferInsert;
