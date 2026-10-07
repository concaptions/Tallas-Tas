import { listClientAccessTokens, type ClientAccessToken, type Db } from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId } from './data-source';
import { requestConnection } from './request-db';

export interface TokenListResult {
  readonly tokens: ClientAccessToken[];
}

async function withDb<T>(query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = requestConnection(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

export async function loadClientTokens(): Promise<TokenListResult> {
  if (inDemoMode({})) {
    return { tokens: [] };
  }
  return withDb(async (db) => {
    const brandId = await resolveLiveBrandId(db, {});
    if (brandId === null) return { tokens: [] };
    const tokens = await listClientAccessTokens(db, brandId);
    return { tokens };
  });
}
