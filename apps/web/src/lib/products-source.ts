import {
  createAutoDb,
  demoProducts,
  getProductById,
  listProducts,
  type Db,
  type ProductListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Products route gets its rows (PRD §5.1). A copy of `personas-source.ts`, function for
 * function, because the demo-mode guarantee is the same one and it must not drift between routes.
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
 * The fixtures and a seeded database are row-for-row identical, ids and `conceptCount` included, so
 * the page renders one branch either way.
 */
export type ProductSourceKind = 'database' | 'demo';

export interface ProductListResult {
  readonly rows: ProductListRow[];
  readonly source: ProductSourceKind;
}

export interface ProductResult {
  readonly product: ProductListRow | null;
  readonly source: ProductSourceKind;
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
export interface ProductSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: ProductSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: ProductSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/**
 * Every product of the working brand, newest edit first, each already carrying `conceptCount` (the
 * live concepts whose angle points at the product). The fixtures are already in that order, so the
 * page never sorts.
 */
export async function loadProducts(deps: ProductSourceDeps = {}): Promise<ProductListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoProducts, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listProducts(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One product by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadProduct(
  id: string,
  deps: ProductSourceDeps = {},
): Promise<ProductResult> {
  if (inDemoMode(deps)) {
    return { product: demoProducts.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const product = brandId === null ? null : await getProductById(db, brandId, id);
    return { product, source: 'database' };
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
  deps: ProductSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
