import { serverEnv } from '@tas/env';
import {
  listRegistryCreatorBrandHistory,
  listRegistryCreators,
  searchRegistryCreators,
  type Db,
  type RegistryBrandHistoryRow,
  type RegistryCreatorListRow,
} from '@tas/db';

import { requestConnection, type DbConnection } from '@/lib/request-db';
import { isDemoMode } from '@/lib/demo-mode';

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = neonConnection(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

export async function loadRegistryCreators(query?: string): Promise<RegistryCreatorListRow[]> {
  if (isDemoMode()) return [];
  return withDb((db) => (query ? searchRegistryCreators(db, query) : listRegistryCreators(db)));
}

/**
 * The brand history (per-brand `creators` rows joined to the brand) for one registry creator, or an
 * empty list in demo mode. Ticket 13 Phase B1: the server loader the pool page uses to prefetch
 * what the aside shows, so no client-side `getRegistryCreatorHistoryAction` round trip is needed.
 */
export async function loadRegistryBrandHistory(
  registryCreatorId: string,
): Promise<RegistryBrandHistoryRow[]> {
  if (isDemoMode()) return [];
  return withDb((db) => listRegistryCreatorBrandHistory(db, registryCreatorId));
}

/**
 * The brand history for every registry id passed in, as a `{id → rows}` map. Lets the pool page
 * pre-compute the per-creator "brand count" and the "In other brands" chip row the per-brand
 * creator panel reads, in ONE connection, in sidebar order.
 */
export async function loadRegistryBrandHistoryMap(
  registryCreatorIds: readonly string[],
): Promise<ReadonlyMap<string, readonly RegistryBrandHistoryRow[]>> {
  if (isDemoMode() || registryCreatorIds.length === 0) {
    return new Map();
  }
  return withDb(async (db) => {
    const entries = await Promise.all(
      registryCreatorIds.map(
        async (id) => [id, await listRegistryCreatorBrandHistory(db, id)] as const,
      ),
    );
    return new Map(entries);
  });
}

export async function withGlobalScope<T>(run: (db: Db) => Promise<T>): Promise<T> {
  if (isDemoMode()) {
    throw new Error('Writes are disabled in demo mode.');
  }
  return withDb(run);
}
