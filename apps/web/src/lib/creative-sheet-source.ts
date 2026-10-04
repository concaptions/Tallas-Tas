import {
  demoCreativeSheetItems,
  getCreativeSheetItemById,
  listCreativeSheetItems,
  type CreativeSheetItemListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the Creative Sheet route gets its rows (Airtable `tblGC0TxnHI7lKaNQ`, audit §2.3). A copy
 * of `products-source.ts`, function for function, because the demo-mode guarantee is the same one
 * and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 *
 * The fixtures and a seeded database are row-for-row identical, computed name and brief fields
 * included, so the page renders one branch either way.
 */
export type CreativeSheetSourceKind = 'database' | 'demo';

export interface CreativeSheetListResult {
  readonly rows: CreativeSheetItemListRow[];
  readonly source: CreativeSheetSourceKind;
}

export interface CreativeSheetItemResult {
  readonly item: CreativeSheetItemListRow | null;
  readonly source: CreativeSheetSourceKind;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env` and `connect` opens Neon.
 */
export interface CreativeSheetSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: CreativeSheetSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

const CREATIVE_SHEET_ITEMS_TABLE_KEY = 'creative_sheet_items';

/**
 * THE ordered, labelled, visible Creative Sheet columns of the working brand, through the ONE loader
 * every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadCreativeSheetColumns(
  deps: CreativeSheetSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(CREATIVE_SHEET_ITEMS_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/** Every sheet row of the working brand, newest edit first, named and joined to its brief. */
export async function loadCreativeSheetItems(
  deps: CreativeSheetSourceDeps = {},
): Promise<CreativeSheetListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCreativeSheetItems, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreativeSheetItems(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One sheet row by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadCreativeSheetItem(
  id: string,
  deps: CreativeSheetSourceDeps = {},
): Promise<CreativeSheetItemResult> {
  if (inDemoMode(deps)) {
    return { item: demoCreativeSheetItems.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const item = brandId === null ? null : await getCreativeSheetItemById(db, brandId, id);
    return { item, source: 'database' };
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
  deps: CreativeSheetSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
