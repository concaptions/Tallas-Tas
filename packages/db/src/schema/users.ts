import { pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/**
 * One row per person, team member or client, keyed to their Clerk user (PRD §11: everyone gets their
 * own account). `slack_user_id` feeds the Phase 5 DM routing. The shared `brand_id` stays null and
 * unused here.
 */
export const users = pgTable('users', {
  ...baseColumns(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  slackUserId: text('slack_user_id'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
