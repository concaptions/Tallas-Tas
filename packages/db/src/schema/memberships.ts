import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { agencies } from './agencies';
import { agencyRoleEnum } from './enums';
import { users } from './users';

/**
 * A user's role inside an agency (D-003: the agency-wide part of authorisation; admins see every
 * brand). Clients have no membership. The shared `brand_id` stays null and unused here.
 */
export const memberships = pgTable(
  'memberships',
  {
    ...baseColumns(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id),
    role: agencyRoleEnum('role').notNull(),
  },
  (table) => [
    // Also the index for the `user_id` foreign key: a btree serves lookups on its leading column.
    unique('memberships_user_id_agency_id_unique').on(table.userId, table.agencyId),
    index('memberships_agency_id_idx').on(table.agencyId),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
