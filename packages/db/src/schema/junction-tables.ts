import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { angles } from './angles';
import { collections } from './collections';
import { concepts } from './concepts';
import { creators } from './creators';
import { personas } from './personas';
import { products } from './products';
import { themes } from './themes';

/**
 * Many-to-many: which concepts a creator is filming (PRD §5.8 "Concepts to film (link)").
 * Also serves the concept→creator direction (PRD §5.7 "Creator (link)").
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

/**
 * Many-to-many: concept↔angle (PRD §5.7 "Angles (link)"). Airtable has this as
 * multipleRecordLinks; V0 used a single FK. The naming formula picks the first angle.
 */
export const conceptAngles = pgTable(
  'concept_angles',
  {
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    angleId: uuid('angle_id')
      .notNull()
      .references(() => angles.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.conceptId, table.angleId] })],
);

/**
 * Many-to-many: concept↔theme (PRD §5.7 "Themes (link)"). Airtable has this as
 * multipleRecordLinks; V0 used a single FK. The naming formula picks the first theme.
 */
export const conceptThemes = pgTable(
  'concept_themes',
  {
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => themes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.conceptId, table.themeId] })],
);

/**
 * Many-to-many: angle↔persona (PRD §5.6 "Personas (link)"). Airtable has this as
 * multipleRecordLinks; V0 used a single FK.
 */
export const anglePersonas = pgTable(
  'angle_personas',
  {
    angleId: uuid('angle_id')
      .notNull()
      .references(() => angles.id, { onDelete: 'cascade' }),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personas.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.angleId, table.personaId] })],
);

/**
 * Many-to-many: angle↔product (PRD §5.6 "Product (link)"). Airtable has this as
 * multipleRecordLinks; V0 used a single FK.
 */
export const angleProducts = pgTable(
  'angle_products',
  {
    angleId: uuid('angle_id')
      .notNull()
      .references(() => angles.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.angleId, table.productId] })],
);

/**
 * Many-to-many: concept↔collection (PRD §5.7 / Airtable "Collection" multipleRecordLinks).
 * Real Gratsi data shows this field populated on nearly every Concepts record.
 */
export const conceptCollections = pgTable(
  'concept_collections',
  {
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.conceptId, table.collectionId] })],
);

export type CreatorConcept = typeof creatorConcepts.$inferSelect;
export type CreatorProduct = typeof creatorProducts.$inferSelect;
export type ConceptAngle = typeof conceptAngles.$inferSelect;
export type ConceptTheme = typeof conceptThemes.$inferSelect;
export type AnglePersona = typeof anglePersonas.$inferSelect;
export type AngleProduct = typeof angleProducts.$inferSelect;
export type ConceptCollection = typeof conceptCollections.$inferSelect;
