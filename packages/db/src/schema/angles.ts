import { boolean, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { personas } from './personas';
import { products } from './products';
import type { AngleFormat, AngleType } from './enums';

/**
 * The hypothesis a strategist writes from a persona (PRD §5.6). `description` is the hypothesis
 * itself. Both links are nullable: an angle can be drafted before either is chosen.
 *
 * `type`, `formats` and `ad_inspo_links` are `jsonb` arrays, not pg enum arrays: PRD §5.6 calls Type
 * and Formats multi-selects, so a row carries a set. Their vocabulary is `angleTypes` /
 * `angleFormats` in `enums.ts` (each with its pg enum, as `awarenessStages` has), which is what a
 * component imports — the column stores the chosen subset. All three are NOT NULL defaulting to
 * `[]`, so a reader never branches on null before mapping, and `type` stays nullable-safe through
 * its widening from the single text value it held in migration 0002.
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
    type: jsonb('type').$type<AngleType[]>().notNull().default([]),
    formats: jsonb('formats').$type<AngleFormat[]>().notNull().default([]),
    adInspoLinks: jsonb('ad_inspo_links').$type<string[]>().notNull().default([]),
    potential: text('potential'),
    winning: boolean('winning').notNull().default(false),
    internalNotes: text('internal_notes'),
    clientNotes: text('client_notes'),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('angles_brand_id_idx').on(table.brandId),
    index('angles_persona_id_idx').on(table.personaId),
    index('angles_product_id_idx').on(table.productId),
  ],
);

export type Angle = typeof angles.$inferSelect;
export type NewAngle = typeof angles.$inferInsert;
