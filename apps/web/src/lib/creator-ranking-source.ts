import {
  createAutoDb,
  demoCreatorRankings,
  getCreatorRankingById,
  listCreatorRankings,
  type CreatorRankingListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';

export interface CreatorRankingResult {
  readonly rows: CreatorRankingListRow[];
  readonly source: 'demo' | 'database';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface CreatorRankingSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(
  deps: CreatorRankingSourceDeps,
  query: (db: Db) => Promise<T>,
): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) throw new Error('DATABASE_URL is not configured.');
  const connection = connect(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: CreatorRankingSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCreatorRankings(
  deps: CreatorRankingSourceDeps = {},
): Promise<CreatorRankingResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCreatorRankings, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreatorRankings(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCreatorRankingById(
  id: string,
  deps: CreatorRankingSourceDeps = {},
): Promise<{ ranking: CreatorRankingListRow | null }> {
  if (inDemoMode(deps)) {
    const row = demoCreatorRankings.find((r) => r.id === id) ?? null;
    return { ranking: row };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return { ranking: null };
    const row = await getCreatorRankingById(db, brandId, id);
    return { ranking: row ?? null };
  });
}

export async function withCreatorRankingScope(deps: CreatorRankingSourceDeps = {}) {
  const connect = deps.connect ?? neonConnection;
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) throw new Error('DATABASE_URL is not configured.');
  const connection = connect(databaseUrl);
  const brandId = await resolveLiveBrandId(connection.db, deps);
  if (brandId === null) {
    await connection.close();
    throw new Error('No brand found for the current workspace.');
  }
  return { db: connection.db, brandId, close: connection.close };
}
