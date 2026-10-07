import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

export const clientAccessTokens = pgTable(
  'client_access_tokens',
  {
    ...baseColumns(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    token: text('token').notNull().unique(),
    email: text('email').notNull(),
    label: text('label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revoked: boolean('revoked').notNull().default(false),
  },
  (table) => [
    index('client_access_tokens_brand_id_idx').on(table.brandId),
    index('client_access_tokens_token_idx').on(table.token),
    index('client_access_tokens_email_idx').on(table.email),
  ],
);

export type ClientAccessToken = typeof clientAccessTokens.$inferSelect;
export type NewClientAccessToken = typeof clientAccessTokens.$inferInsert;
