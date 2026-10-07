import { and, desc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { clientAccessTokens, type ClientAccessToken, type NewClientAccessToken } from './schema';
import { withBrand } from './tenancy';

/**
 * Client Access Tokens data access (Phase 2 magic-link auth). Branded: every token belongs to a
 * brand, and all reads and writes go through `withBrand(db, brandId)`. The token management UI
 * on Interface Config lets admins create, list and revoke tokens; the landing page validates
 * the token directly by its unique `token` column.
 */

type ManagedColumn =
  'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'deletedAt';

export type ClientAccessTokenInput = Omit<NewClientAccessToken, ManagedColumn>;

export async function listClientAccessTokens(
  db: Db,
  brandId: string,
): Promise<ClientAccessToken[]> {
  return withBrand(db, brandId)
    .select(clientAccessTokens)
    .orderBy(desc(clientAccessTokens.createdAt));
}

export async function getClientAccessTokenByValue(
  db: Db,
  tokenValue: string,
): Promise<ClientAccessToken | null> {
  const [row] = await db
    .select()
    .from(clientAccessTokens)
    .where(
      and(
        eq(clientAccessTokens.token, tokenValue),
        eq(clientAccessTokens.revoked, false),
        isNull(clientAccessTokens.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertClientAccessToken(
  db: Db,
  brandId: string,
  values: ClientAccessTokenInput,
  actorId: string,
): Promise<ClientAccessToken> {
  const [row] = await withBrand(db, brandId)
    .insert(clientAccessTokens, { ...values, createdBy: actorId, updatedBy: actorId })
    .returning();
  if (row === undefined) {
    throw new Error('client_access_tokens insert returned no row');
  }
  return row;
}

export async function revokeClientAccessToken(
  db: Db,
  brandId: string,
  id: string,
  actorId: string,
): Promise<ClientAccessToken | null> {
  const [row] = await withBrand(db, brandId)
    .update(
      clientAccessTokens,
      { revoked: true, updatedBy: actorId, updatedAt: new Date() },
      eq(clientAccessTokens.id, id),
    )
    .returning();
  return row ?? null;
}

export async function touchClientAccessToken(db: Db, tokenValue: string): Promise<void> {
  await db
    .update(clientAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(clientAccessTokens.token, tokenValue));
}
