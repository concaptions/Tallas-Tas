import {
  demoCopyTypes,
  getCopyTypeById,
  listCopyTypes,
  type CopyTypeListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the Copy Types route gets its rows (Airtable "(Internal) Copy Type", gap audit 2026-10-01
 * §2.13). A copy of `products-source.ts`, function for function, because the demo-mode guarantee is
 * the same one and it must not drift between routes.
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
 *
 * `loadCopyTypes` is exported for the copy pages too: a Meta or YouTube copy panel that offers a
 * copy-type picker reads the brand's types through this same seam, never through a private loader.
 */
export type CopyTypeSourceKind = 'database' | 'demo';

export interface CopyTypeListResult {
  readonly rows: CopyTypeListRow[];
  readonly source: CopyTypeSourceKind;
}

export interface CopyTypeResult {
  readonly copyType: CopyTypeListRow | null;
  readonly source: CopyTypeSourceKind;
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
export interface CopyTypeSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: CopyTypeSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: CopyTypeSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

const COPY_TYPES_TABLE_KEY = 'copy_types';

/**
 * THE ordered, labelled, visible columns of the working brand, through the ONE loader every
 * resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadCopyTypeColumns(
  deps: CopyTypeSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(COPY_TYPES_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * Every copy type of the working brand, newest edit first, each already carrying its linked Meta and
 * YouTube copies. The fixtures are already in that order, so the page never sorts.
 */
export async function loadCopyTypes(deps: CopyTypeSourceDeps = {}): Promise<CopyTypeListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCopyTypes, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCopyTypes(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One copy type by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadCopyType(
  id: string,
  deps: CopyTypeSourceDeps = {},
): Promise<CopyTypeResult> {
  if (inDemoMode(deps)) {
    return { copyType: demoCopyTypes.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const copyType = brandId === null ? null : await getCopyTypeById(db, brandId, id);
    return { copyType, source: 'database' };
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
  deps: CopyTypeSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
