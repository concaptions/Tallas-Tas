import { pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/**
 * The tenant above brands: TAS Digital today, one row per Clerk Organization (D-003). `clerk_org_id`
 * is null until the organisation exists in Clerk. The shared `brand_id` stays null and unused here.
 */
export const agencies = pgTable('agencies', {
  ...baseColumns(),
  name: text('name').notNull(),
  clerkOrgId: text('clerk_org_id').unique(),
  slug: text('slug').notNull().unique(),
});

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
