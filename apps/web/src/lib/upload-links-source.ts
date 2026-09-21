import {
  createAutoDb,
  demoUploadLinks,
  listUploadLinks,
  type Db,
  type UploadLinkListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';

export interface UploadLinksResult {
  readonly rows: UploadLinkListRow[];
  readonly source: 'demo' | 'database';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface UploadLinksSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(deps: UploadLinksSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: UploadLinksSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadUploadLinks(
  deps: UploadLinksSourceDeps = {},
): Promise<UploadLinksResult> {
  if (inDemoMode(deps)) {
    return { rows: demoUploadLinks, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listUploadLinks(db, brandId);
    return { rows, source: 'database' };
  });
}
