import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import type { CreatorAgeBracket, CreatorPlatform } from './enums';

/**
 * Global Creator Registry — a cross-brand pool of every creator TAS has ever worked with.
 *
 * This is NOT per-brand. It is a shared directory. The per-brand `creators` table links here
 * via `registryCreatorId` so that when Gratsi and Niagara both work with the same person,
 * there is ONE registry entry and TWO brand-scoped creator rows.
 */
export const creatorRegistry = pgTable(
  'creator_registry',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    instagramUsername: text('instagram_username'),
    profilePicUrl: text('profile_pic_url'),
    creatorLink: text('creator_link'),
    platform: jsonb('platform').$type<CreatorPlatform[]>().notNull().default([]),
    ageBracket: text('age_bracket').$type<CreatorAgeBracket>(),
    gender: text('gender'),
    ethnicity: text('ethnicity'),
    shippingLocation: text('shipping_location'),
    totalBrands: integer('total_brands').notNull().default(0),
    totalProjects: integer('total_projects').notNull().default(0),
    avgRating: integer('avg_rating'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    notes: text('notes'),
    normalizedInstagram: text('normalized_instagram').unique(),
    legacyAirtableId: text('legacy_airtable_id'),
  },
  (table) => [
    index('creator_registry_name_idx').on(table.name),
    index('creator_registry_instagram_idx').on(table.instagramUsername),
    index('creator_registry_normalized_ig_idx').on(table.normalizedInstagram),
  ],
);

export type RegistryCreator = typeof creatorRegistry.$inferSelect;
export type NewRegistryCreator = typeof creatorRegistry.$inferInsert;
