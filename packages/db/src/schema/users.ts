import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/**
 * One row per person, team member or client, keyed to their Clerk user (PRD §11: everyone gets their
 * own account). `slack_user_id` feeds the Phase 5 DM routing.
 *
 * `last_active_at` is the last time the person was seen in the app, NULLABLE on purpose: someone who
 * has been invited and has never signed in has no such moment, and the Team table (PRD §11) reads
 * that null as "Never" rather than inventing a date. It is written by the session, never by a form.
 * The shared `brand_id` stays null and unused here.
 */
export const users = pgTable('users', {
  ...baseColumns(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  slackUserId: text('slack_user_id'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
