import {
  createAutoDb,
  demoUploadLinks,
  getUploadLinkById,
  listUploadLinks,
  type Db,
  type UploadLinkListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

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

export interface UploadLinkResult {
  readonly link: UploadLinkListRow | null;
  readonly source: 'demo' | 'database';
}

/** One upload link by id, or null. In demo mode the fixtures are searched. */
export async function loadUploadLinkById(
  id: string,
  deps: UploadLinksSourceDeps = {},
): Promise<UploadLinkResult> {
  if (inDemoMode(deps)) {
    return { link: demoUploadLinks.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const link = brandId === null ? null : await getUploadLinkById(db, brandId, id);
    return { link, source: 'database' };
  });
}

/**
 * The write path for Server Actions: one connection, the actor's brand resolved once, then `run`.
 * Throws in demo mode and returns null when the workspace has no brand yet.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: UploadLinksSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
