import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';
import { brandRoleEnum } from './enums';
import { users } from './users';

/**
 * The tenancy edge (PRD §3 team assignment, §11 access): who holds which role on which brand. The
 * only tenancy table whose `brand_id` is NOT NULL, so it overrides the shared nullable column and is
 * the first table `withBrand(brandId)` scopes (stage 2).
 */
export const brandAssignments = pgTable(
  'brand_assignments',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: brandRoleEnum('role').notNull(),
  },
  (table) => [
    // Also the index for the `user_id` foreign key: a btree serves lookups on its leading column.
    unique('brand_assignments_user_id_brand_id_role_unique').on(
      table.userId,
      table.brandId,
      table.role,
    ),
    // The ticket's (brand_id, user_id) index; also the index for the `brand_id` foreign key.
    index('brand_assignments_brand_id_user_id_idx').on(table.brandId, table.userId),
  ],
);

export type BrandAssignment = typeof brandAssignments.$inferSelect;
export type NewBrandAssignment = typeof brandAssignments.$inferInsert;
