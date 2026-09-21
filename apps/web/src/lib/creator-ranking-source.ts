import {
  createAutoDb,
  demoCreatorRankings,
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
