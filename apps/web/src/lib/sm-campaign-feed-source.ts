import {
  demoSmCampaignFeedTasks,
  getSmCampaignFeedTaskById,
  listSmCampaignFeedTasks,
  type Db,
  type SmCampaignFeedTaskListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the SM Campaign Feed route gets its rows (Airtable `tblLRajTW55XEhVhk`). A copy of
 * `products-source.ts`, function for function, because the demo-mode guarantee is the same one and
 * it must not drift between routes.
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
 * The fixtures and a seeded database are row-for-row identical, so the page renders one branch
 * either way.
 */
export type SmCampaignFeedSourceKind = 'database' | 'demo';

export interface SmCampaignFeedListResult {
  readonly rows: SmCampaignFeedTaskListRow[];
  readonly source: SmCampaignFeedSourceKind;
}

export interface SmCampaignFeedTaskResult {
  readonly task: SmCampaignFeedTaskListRow | null;
  readonly source: SmCampaignFeedSourceKind;
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
 *
 * `actorScope` comes from `BrandResolverDeps` and is handed straight to `resolveLiveBrandId`, so a
 * test can pin which agency's brand the live branch is allowed to resolve.
 */
export interface SmCampaignFeedSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(
  deps: SmCampaignFeedSourceDeps,
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

function inDemoMode(deps: SmCampaignFeedSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

const SM_CAMPAIGN_FEED_TABLE_KEY = 'sm_campaign_feed_tasks';

/**
 * THE ordered, labelled, visible SM Campaign Feed columns of the working brand, through the ONE
 * loader every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadSmCampaignFeedColumns(
  deps: SmCampaignFeedSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(SM_CAMPAIGN_FEED_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * Every task of the working brand, soonest due first and undated tasks last. The fixtures are already
 * in that order, so the page never sorts.
 */
export async function loadSmCampaignFeedTasks(
  deps: SmCampaignFeedSourceDeps = {},
): Promise<SmCampaignFeedListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoSmCampaignFeedTasks, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listSmCampaignFeedTasks(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One task by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadSmCampaignFeedTask(
  id: string,
  deps: SmCampaignFeedSourceDeps = {},
): Promise<SmCampaignFeedTaskResult> {
  if (inDemoMode(deps)) {
    return { task: demoSmCampaignFeedTasks.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const task = brandId === null ? null : await getSmCampaignFeedTaskById(db, brandId, id);
    return { task, source: 'database' };
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
  deps: SmCampaignFeedSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
