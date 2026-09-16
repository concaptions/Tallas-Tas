import { type AnyPgColumn, boolean, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { agencies } from './agencies';
import { brandStatusEnum } from './enums';

/**
 * A client workspace (PRD §11) or the parent template (PRD §14.1). `template_brand_id` points a
 * child at the template it was seeded from; null means this brand *is* the template. The shared
 * `brand_id` stays null and unused here.
 */
export const brands = pgTable(
  'brands',
  {
    ...baseColumns(),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    website: text('website'),
    templateBrandId: uuid('template_brand_id').references((): AnyPgColumn => brands.id),
    isTemplate: boolean('is_template').notNull().default(false),
    status: brandStatusEnum('status').notNull().default('active'),
  },
  (table) => [
    // Also the index for the `agency_id` foreign key: a btree serves lookups on its leading column.
    unique('brands_agency_id_slug_unique').on(table.agencyId, table.slug),
    index('brands_template_brand_id_idx').on(table.templateBrandId),
  ],
);

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
