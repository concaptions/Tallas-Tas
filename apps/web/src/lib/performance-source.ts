import {
  demoAdMetrics,
  getAdMetricById,
  listAdMetrics,
  type AdMetricListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

export interface PerformanceResult {
  readonly rows: AdMetricListRow[];
  readonly source: 'demo' | 'database';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface PerformanceSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(deps: PerformanceSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: PerformanceSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadPerformance(
  deps: PerformanceSourceDeps = {},
): Promise<PerformanceResult> {
  if (inDemoMode(deps)) {
    return { rows: demoAdMetrics, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listAdMetrics(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadAdMetricById(
  id: string,
  deps: PerformanceSourceDeps = {},
): Promise<{ metric: AdMetricListRow | null }> {
  if (inDemoMode(deps)) {
    const row = demoAdMetrics.find((m) => m.id === id) ?? null;
    return { metric: row };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return { metric: null };
    const row = await getAdMetricById(db, brandId, id);
    return { metric: row ?? null };
  });
}

export async function withPerformanceScope(deps: PerformanceSourceDeps = {}) {
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
