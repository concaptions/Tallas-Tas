import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns, propagationColumns } from '../columns';
import { brands } from './brands';
import { awarenessStageEnum } from './enums';
import { products } from './products';

/**
 * The research table every angle is written from (PRD §5.4). The fourteen PRD fields are columns, in
 * the PRD's own order; only `name` is required, because a strategist fills a persona over several
 * sittings. `stage_of_awareness` is the `awareness_stage` pg enum (Breakthrough Advertising's five
 * stages). Branded: `brand_id` is NOT NULL, so `withBrand` scopes every read and write.
 */
export const personas = pgTable(
  'personas',
  {
    ...baseColumns(),
    ...propagationColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    productId: uuid('product_id').references(() => products.id),
    name: text('name').notNull(),
    /**
     * The columns from `day_in_the_life` to `trigger_words` are NOT shown on the Gratsi-pinned
     * Personas page (docs/decisions/gratsi-display-spec-2026-10-02.md): the Gratsi base defines no
     * field for them. They are NOT deprecated — Niagara Sleep Solutions populates them on all three
     * of its personas — so they keep their data and stay readable to any brand whose own base has
     * the field. Per-brand visibility belongs in `brand_field_overrides`, not in a drop.
     */
    dayInTheLife: text('day_in_the_life'),
    demographic: text('demographic'),
    psychographic: text('psychographic'),
    coreDesires: text('core_desires'),
    /**
     * Gratsi's `Passion` field. Added to the production database by hand before this schema caught
     * up, so migration 0044 is written to be idempotent — `migrate-prod` skips a column that already
     * exists and records the journal row, which is exactly the drift it was built for.
     */
    passion: text('passion'),
    emotionalTriggers: text('emotional_triggers'),
    painPoints: text('pain_points'),
    successFactors: text('success_factors'),
    perceivedBarriers: text('perceived_barriers'),
    stageOfAwareness: awarenessStageEnum('stage_of_awareness'),
    buyingTriggers: text('buying_triggers'),
    problemChallenge: text('problem_challenge'),
    successTransformation: text('success_transformation'),
    triggerWords: text('trigger_words'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('personas_brand_id_idx').on(table.brandId),
    index('personas_product_id_idx').on(table.productId),
    index('personas_template_row_id_idx').on(table.templateRowId),
  ],
);

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
