import {
  createAutoDb,
  demoAssets,
  getAssetById,
  listAssets,
  type AssetListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';

export interface AssetListResult {
  readonly rows: AssetListRow[];
  readonly source: 'demo' | 'database';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface AssetSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(deps: AssetSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: AssetSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadAssets(deps: AssetSourceDeps = {}): Promise<AssetListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoAssets, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listAssets(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadAssetById(
  id: string,
  deps: AssetSourceDeps = {},
): Promise<{ asset: AssetListRow | null }> {
  if (inDemoMode(deps)) {
    const row = demoAssets.find((a) => a.id === id) ?? null;
    return { asset: row };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return { asset: null };
    const row = await getAssetById(db, brandId, id);
    return { asset: row ?? null };
  });
}

export async function withAssetScope(deps: AssetSourceDeps = {}) {
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
