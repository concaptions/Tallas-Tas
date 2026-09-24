import {
  demoCreativeDimensions,
  getCreativeDimensionById,
  listCreativeDimensions,
  type CreativeDimensionListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

export interface CreativeDimensionListResult {
  readonly rows: CreativeDimensionListRow[];
  readonly source: 'database' | 'demo';
}

export interface CreativeDimensionResult {
  readonly dimension: CreativeDimensionListRow | null;
  readonly source: 'database' | 'demo';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface CreativeDimensionSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(
  deps: CreativeDimensionSourceDeps,
  query: (db: Db) => Promise<T>,
): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = connect(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: CreativeDimensionSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCreativeDimensions(
  deps: CreativeDimensionSourceDeps = {},
): Promise<CreativeDimensionListResult> {
  if (inDemoMode(deps)) return { rows: demoCreativeDimensions, source: 'demo' };
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreativeDimensions(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCreativeDimension(
  id: string,
  deps: CreativeDimensionSourceDeps = {},
): Promise<CreativeDimensionResult> {
  if (inDemoMode(deps)) {
    return { dimension: demoCreativeDimensions.find((r) => r.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const dimension = brandId === null ? null : await getCreativeDimensionById(db, brandId, id);
    return { dimension, source: 'database' };
  });
}

export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: CreativeDimensionSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) throw new Error(DEMO_MUTATION_REFUSED);
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
