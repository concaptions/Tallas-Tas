import {
  createNeonDb,
  demoInterfaceConfig,
  getInterfacePageById,
  listInterfaceConfig,
  type Db,
  type InterfacePageRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Interface Config route gets its rows (PRD §10: "the interface must be configurable per
 * client, at two levels: **Which pages appear** … **Which fields appear**"). A copy of
 * `personas-source.ts`, function for function, because the demo-mode guarantee is the same one and
 * it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`, never `process.env`):
 * the in-repo fixtures from `@tas/db`. No database client is constructed, no connection is opened
 * and `DATABASE_URL` is never read, even when it is set — the demo branch returns BEFORE
 * `serverEnv()` is reached, and `interface-config-source.test.ts` proves it with an injected
 * `connect` spy that throws if it is ever called. That is what makes the unauthenticated Vercel
 * deployment safe: the middleware lets every route through, so a visitor must be unable to reach
 * real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 *
 * `demoInterfaceConfig` and a seeded database are row-for-row identical, ids included, so the tree
 * and the preview render one branch either way.
 *
 * WHAT THIS MODULE DOES NOT DO: filter. `listInterfaceConfig` returns disabled pages and invisible
 * fields on purpose — the configuration screen has to show a switched-off page in order to switch
 * it back on. What a CLIENT would see is `visibleFields` / `enabledPages` from `@tas/domain`, asked
 * at render time. There is no second opinion about it here.
 */
export type InterfaceConfigSourceKind = 'database' | 'demo';

export interface InterfaceConfigResult {
  readonly rows: InterfacePageRow[];
  readonly source: InterfaceConfigSourceKind;
}

export interface InterfacePageResult {
  readonly page: InterfacePageRow | null;
  readonly source: InterfaceConfigSourceKind;
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
export interface InterfaceConfigSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(
  deps: InterfaceConfigSourceDeps,
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

function inDemoMode(deps: InterfaceConfigSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/**
 * The brand's whole interface configuration: every page in position order, each with its fields in
 * position order, enabled and disabled alike.
 */
export async function loadInterfaceConfig(
  deps: InterfaceConfigSourceDeps = {},
): Promise<InterfaceConfigResult> {
  if (inDemoMode(deps)) {
    return { rows: demoInterfaceConfig, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listInterfaceConfig(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One configured page by id, or null. In demo mode the fixtures are searched; no client is built. */
export async function loadInterfacePage(
  id: string,
  deps: InterfaceConfigSourceDeps = {},
): Promise<InterfacePageResult> {
  if (inDemoMode(deps)) {
    return { page: demoInterfaceConfig.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const page = brandId === null ? null : await getInterfacePageById(db, brandId, id);
    return { page, source: 'database' };
  });
}

/**
 * The write path for the Server Actions: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet.
 *
 * The actions never let that throw escape: each one refuses in demo mode BEFORE it gets here, so
 * this is the belt to that pair of braces rather than the path a demo visitor takes.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: InterfaceConfigSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
