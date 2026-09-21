import {
  createAutoDb,
  demoAngles,
  getAngleById,
  listAngles,
  type AngleListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Angles route gets its rows (PRD §5.6). A copy of `personas-source.ts`, function for
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
 * The fixtures and a seeded database are row-for-row identical, ids and the two joined names
 * included, so the page renders one branch either way. The personas and products the panel's two
 * dropdowns need are NOT loaded here: they come from `personas-source.ts` and `products-source.ts`,
 * so each table has exactly one loader.
 */
export type AngleSourceKind = 'database' | 'demo';

export interface AngleListResult {
  readonly rows: AngleListRow[];
  readonly source: AngleSourceKind;
}

export interface AngleResult {
  readonly angle: AngleListRow | null;
  readonly source: AngleSourceKind;
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
export interface AngleSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: AngleSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: AngleSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/**
 * Every angle of the working brand, newest edit first, each already carrying `personaName` and
 * `productName` (null where the link is absent or the linked row is no longer live). The fixtures
 * are already in that order, so the page never sorts.
 */
export async function loadAngles(deps: AngleSourceDeps = {}): Promise<AngleListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoAngles, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listAngles(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One angle by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadAngle(id: string, deps: AngleSourceDeps = {}): Promise<AngleResult> {
  if (inDemoMode(deps)) {
    return { angle: demoAngles.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const angle = brandId === null ? null : await getAngleById(db, brandId, id);
    return { angle, source: 'database' };
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
  deps: AngleSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
