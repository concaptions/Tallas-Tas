import { pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';

/** Proves the schema → migration → seed → test loop (TICKET-003). Not a product table. */
export const healthCheck = pgTable('health_check', {
  ...baseColumns(),
  note: text('note').notNull(),
});

export type HealthCheck = typeof healthCheck.$inferSelect;
export type NewHealthCheck = typeof healthCheck.$inferInsert;
