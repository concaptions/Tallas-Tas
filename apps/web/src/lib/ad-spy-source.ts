import {
  createAutoDb,
  demoCompetitorAds,
  getCompetitorAdById,
  listCompetitorAds,
  type CompetitorAdListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';

export interface AdSpyResult {
  readonly rows: CompetitorAdListRow[];
  readonly source: 'demo' | 'database';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface AdSpySourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(deps: AdSpySourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: AdSpySourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCompetitorAds(deps: AdSpySourceDeps = {}): Promise<AdSpyResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCompetitorAds, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCompetitorAds(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCompetitorAdById(
  id: string,
  deps: AdSpySourceDeps = {},
): Promise<{ ad: CompetitorAdListRow | null }> {
  if (inDemoMode(deps)) {
    const row = demoCompetitorAds.find((a) => a.id === id) ?? null;
    return { ad: row };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return { ad: null };
    const row = await getCompetitorAdById(db, brandId, id);
    return { ad: row ?? null };
  });
}

export async function withAdSpyScope(deps: AdSpySourceDeps = {}) {
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
