import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { clientAccessTokens, type ClientAccessToken } from './schema/client-access-tokens';

/**
 * Find a valid (non-revoked, non-expired, non-deleted) token row by its raw token string.
 * Expiry is checked in application code via `isTokenExpired` from `@tas/domain` because
 * Drizzle's `gt(now())` would couple the query to the database clock; the caller filters.
 */
export async function findTokenByValue(db: Db, token: string): Promise<ClientAccessToken | null> {
  const rows = await db
    .select()
    .from(clientAccessTokens)
    .where(
      and(
        eq(clientAccessTokens.token, token),
        eq(clientAccessTokens.revoked, false),
        isNull(clientAccessTokens.deletedAt),
      ),
    );
  return rows[0] ?? null;
}

/**
 * Find a valid token row by raw token string scoped to a brand.
 */
export async function findTokenByValueAndBrand(
  db: Db,
  token: string,
  brandId: string,
): Promise<ClientAccessToken | null> {
  const rows = await db
    .select()
    .from(clientAccessTokens)
    .where(
      and(
        eq(clientAccessTokens.token, token),
        eq(clientAccessTokens.brandId, brandId),
        eq(clientAccessTokens.revoked, false),
        isNull(clientAccessTokens.deletedAt),
      ),
    );
  return rows[0] ?? null;
}

/** Mark `last_used_at` on a token row. Best-effort — callers should not fail on error. */
export async function touchTokenLastUsed(db: Db, tokenId: string): Promise<void> {
  await db
    .update(clientAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(clientAccessTokens.id, tokenId));
}

/** Revoke a token by setting `revoked = true`. Returns the updated row or null if not found. */
export async function revokeToken(
  db: Db,
  tokenId: string,
  brandId: string,
  actorId: string,
): Promise<ClientAccessToken | null> {
  const rows = await db
    .update(clientAccessTokens)
    .set({ revoked: true, updatedBy: actorId, updatedAt: new Date() })
    .where(
      and(
        eq(clientAccessTokens.id, tokenId),
        eq(clientAccessTokens.brandId, brandId),
        isNull(clientAccessTokens.deletedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/** List all tokens for a brand (including revoked, excluding soft-deleted). */
export async function listTokensForBrand(db: Db, brandId: string): Promise<ClientAccessToken[]> {
  return db
    .select()
    .from(clientAccessTokens)
    .where(and(eq(clientAccessTokens.brandId, brandId), isNull(clientAccessTokens.deletedAt)));
}

/** Insert a new client access token. Returns the inserted row. */
export async function insertClientToken(
  db: Db,
  input: {
    brandId: string;
    token: string;
    email: string;
    label: string | null;
    expiresAt: Date;
    createdBy: string;
    updatedBy: string;
  },
): Promise<ClientAccessToken> {
  const rows = await db.insert(clientAccessTokens).values(input).returning();
  // insert always returns exactly one row
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return rows[0]!;
}
