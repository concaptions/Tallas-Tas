import {
  demoClientAssetFolders,
  getClientAssetFolderById,
  listClientAssetFolders,
  type ClientAssetFolderListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the Client Assets route gets its rows (Airtable "Client Assets Organisation", audit §2.9).
 * A copy of `products-source.ts`, function for function, because the demo-mode guarantee is the
 * same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached. That
 * is what makes the unauthenticated Vercel deployment safe: the middleware lets every route
 * through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 */
export type ClientAssetFolderSourceKind = 'database' | 'demo';

export interface ClientAssetFolderListResult {
  readonly rows: ClientAssetFolderListRow[];
  readonly source: ClientAssetFolderSourceKind;
}

export interface ClientAssetFolderResult {
  readonly folder: ClientAssetFolderListRow | null;
  readonly source: ClientAssetFolderSourceKind;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env` and `connect` opens Neon. A test injects `connect` to prove the
 * demo branch never constructs a client.
 */
export interface ClientAssetFolderSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(
  deps: ClientAssetFolderSourceDeps,
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

const CLIENT_ASSET_FOLDERS_TABLE_KEY = 'client_asset_folders';

/**
 * THE ordered, labelled, visible Client Assets columns of the working brand, through the ONE loader
 * every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadClientAssetColumns(
  deps: ClientAssetFolderSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(CLIENT_ASSET_FOLDERS_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * Every folder of the working brand, newest edit first, each already carrying its linked brief ids
 * and names. The fixtures are already in that order, so the page never sorts.
 */
export async function loadClientAssetFolders(
  deps: ClientAssetFolderSourceDeps = {},
): Promise<ClientAssetFolderListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoClientAssetFolders, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listClientAssetFolders(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One folder by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadClientAssetFolder(
  id: string,
  deps: ClientAssetFolderSourceDeps = {},
): Promise<ClientAssetFolderResult> {
  if (inDemoMode(deps)) {
    return {
      folder: demoClientAssetFolders.find((row) => row.id === id) ?? null,
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const folder = brandId === null ? null : await getClientAssetFolderById(db, brandId, id);
    return { folder, source: 'database' };
  });
}

/**
 * The write path for the Server Actions: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet. The actions refuse long before this, so the
 * throw is a backstop, never the message a visitor reads.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: ClientAssetFolderSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
