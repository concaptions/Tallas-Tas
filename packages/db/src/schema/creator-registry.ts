import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import type { CreatorAgeBracket, CreatorPlatform } from './enums';

/**
 * Global Creator Registry — a cross-brand pool of every creator TAS has ever worked with.
 *
 * This is NOT per-brand. It is a shared directory, like `themes`. The per-brand `creators` table
 * links here via `registryCreatorId` so that when Gratsi and Niagara both work with the same
 * person, there is ONE registry entry and TWO brand-scoped creator rows.
 *
 * De-duplication: if a creator has an Instagram username, `normalizedInstagram` (lowercase,
 * stripped @) is the natural key. Two entries with the same IG are the same person.
 *
 * `brand_id` is forced null by a CHECK constraint, exactly as `themes` does: a row carrying a
 * brand is rejected by Postgres, not by convention.
 */
export interface RegistryBrandMembership {
  readonly brandLabel: string;
  readonly sourceAirtableBaseId: string;
  /** ISO timestamp of the first import that saw this person in that brand's base. */
  readonly firstSeenAt: string;
}

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

    // Every brand this person has worked with, INCLUDING brands that only exist in another
    // client's Airtable base and never in this Postgres (Oct 8 Talal ask, migration 0057). The
    // per-brand `creators` rows cover TAS's own brands; this array is the memory of the rest.
    brands: jsonb('brands').$type<RegistryBrandMembership[]>().notNull().default([]),
  },
  (table) => [
    check('creator_registry_global', sql`${table.brandId} is null`),
    index('creator_registry_name_idx').on(table.name),
    index('creator_registry_instagram_idx').on(table.instagramUsername),
    index('creator_registry_normalized_ig_idx').on(table.normalizedInstagram),
  ],
);

export type RegistryCreator = typeof creatorRegistry.$inferSelect;
export type NewRegistryCreator = typeof creatorRegistry.$inferInsert;
