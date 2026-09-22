import {
  createAutoDb,
  demoCollections,
  getCollectionById,
  listCollections,
  type CollectionListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

export interface CollectionListResult {
  readonly rows: CollectionListRow[];
  readonly source: 'database' | 'demo';
}

export interface CollectionResult {
  readonly collection: CollectionListRow | null;
  readonly source: 'database' | 'demo';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface CollectionSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(deps: CollectionSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: CollectionSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCollections(
  deps: CollectionSourceDeps = {},
): Promise<CollectionListResult> {
  if (inDemoMode(deps)) return { rows: demoCollections, source: 'demo' };
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCollections(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCollection(
  id: string,
  deps: CollectionSourceDeps = {},
): Promise<CollectionResult> {
  if (inDemoMode(deps)) {
    return { collection: demoCollections.find((r) => r.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const collection = brandId === null ? null : await getCollectionById(db, brandId, id);
    return { collection, source: 'database' };
  });
}

export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: CollectionSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) throw new Error(DEMO_MUTATION_REFUSED);
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
