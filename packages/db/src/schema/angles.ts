import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { personas } from './personas';
import { products } from './products';

/**
 * The hypothesis a strategist writes from a persona (PRD §5.6). `description` is the hypothesis
 * itself; `type` stays free text until the Emotional / Functional / Identity / Critical multi-select
 * gets its own ticket. Both links are nullable: an angle can be drafted before either is chosen.
 */
export const angles = pgTable(
  'angles',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    personaId: uuid('persona_id').references(() => personas.id),
    productId: uuid('product_id').references(() => products.id),
    name: text('name').notNull(),
    description: text('description'),
    painPoints: text('pain_points'),
    usp: text('usp'),
    type: text('type'),
  },
  (table) => [
    index('angles_brand_id_idx').on(table.brandId),
    index('angles_persona_id_idx').on(table.personaId),
    index('angles_product_id_idx').on(table.productId),
  ],
);

export type Angle = typeof angles.$inferSelect;
export type NewAngle = typeof angles.$inferInsert;
