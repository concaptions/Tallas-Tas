import { demoCollections, listCollections, type CollectionListRow, type Db } from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { requestConnection } from '@/lib/request-db';

/**
 * The ONE read left on the retired `collections` table (Oct 12 client sync, Ticket 1): the
 * Campaigns & Offers page names the collections whose `campaign_id` points at a campaign. The
 * workspace, its column loader and its writers left with the route; the table is frozen, not
 * dropped.
 */

export interface CollectionListResult {
  readonly rows: CollectionListRow[];
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
  return requestConnection(databaseUrl);
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

