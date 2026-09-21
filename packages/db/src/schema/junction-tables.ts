import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { concepts } from './concepts';
import { creators } from './creators';
import { products } from './products';

/**
 * Many-to-many: which concepts a creator is filming (PRD §5.8 "Concepts to film (link)").
 * Replaces the Sprint 1 `creators.concept_ids` jsonb column.
 */
export const creatorConcepts = pgTable(
  'creator_concepts',
  {
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.creatorId, table.conceptId] })],
);

/**
 * Many-to-many: which products a creator is associated with (PRD §5.8 "Products (link)").
 * Replaces the Sprint 1 `creators.product_ids` jsonb column.
 */
export const creatorProducts = pgTable(
  'creator_products',
  {
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => creators.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.creatorId, table.productId] })],
);

export type CreatorConcept = typeof creatorConcepts.$inferSelect;
export type CreatorProduct = typeof creatorProducts.$inferSelect;
