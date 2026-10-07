import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../columns';
import { brands } from './brands';

/**
 * A magic-link token that grants a client access to a brand's client interface (PRD §11).
 *
 * The token is a long random string sent via email; the client clicks the link and the middleware
 * resolves `token` → `brand_id` + `email`. Revoked tokens are kept for audit trail (soft delete is
 * on `deleted_at` from `baseColumns()`); `revoked` is an explicit flag so the lookup query is a
 * single `WHERE token = ? AND revoked = false AND (expires_at IS NULL OR expires_at > now())`.
 *
 * `label` is an optional human-readable note the admin sees in the token list ("Gratsi — Sarah Q3
 * review"), never shown to the client.
 */
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
