import { serverEnv } from '@tas/env';
import {
  listRegistryCreators,
  searchRegistryCreators,
  type Db,
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

export async function withGlobalScope<T>(run: (db: Db) => Promise<T>): Promise<T> {
  if (isDemoMode()) {
    throw new Error('Writes are disabled in demo mode.');
  }
  return withDb(run);
}
