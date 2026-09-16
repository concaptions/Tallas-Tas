import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
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
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    productId: uuid('product_id').references(() => products.id),
    name: text('name').notNull(),
    dayInTheLife: text('day_in_the_life'),
    demographic: text('demographic'),
    psychographic: text('psychographic'),
    coreDesires: text('core_desires'),
    emotionalTriggers: text('emotional_triggers'),
    painPoints: text('pain_points'),
    successFactors: text('success_factors'),
    perceivedBarriers: text('perceived_barriers'),
    stageOfAwareness: awarenessStageEnum('stage_of_awareness'),
    buyingTriggers: text('buying_triggers'),
    problemChallenge: text('problem_challenge'),
    successTransformation: text('success_transformation'),
    triggerWords: text('trigger_words'),
  },
  (table) => [
    index('personas_brand_id_idx').on(table.brandId),
    index('personas_product_id_idx').on(table.productId),
  ],
);

export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
