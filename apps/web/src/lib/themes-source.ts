import {
  createNeonDb,
  demoThemes,
  getThemeById,
  listThemes,
  type Db,
  type ThemeListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Themes route gets its rows (PRD §5.5). A copy of `personas-source.ts`, function for
 * function, because the demo-mode guarantee is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached. That
 * is what makes the unauthenticated Vercel deployment safe: the middleware lets every route
 * through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, then
 * the queries in `@tas/db`. No singleton.
 *
 * THE ONE DIFFERENCE FROM EVERY OTHER SOURCE, and it is the point of the page: there is no brand
 * here. The theme library is GLOBAL (CLAUDE.md non-negotiable 3, PRD §5.5 "shared across every
 * brand in the platform"), so no function below resolves a working brand, `listThemes` takes the
 * database alone, and the write path is `withGlobalScope` rather than `withBrandScope`. Do not add
 * a brand argument to any of it: a per-brand theme library is the Airtable problem this page
 * exists to delete.
 *
 * The fixtures and a seeded database are row-for-row identical, ids and `usedByBrandCount`
 * included, so the page renders one branch either way.
 */
export type ThemeSourceKind = 'database' | 'demo';

export interface ThemeListResult {
  readonly rows: ThemeListRow[];
  readonly source: ThemeSourceKind;
}

export interface ThemeResult {
  readonly theme: ThemeListRow | null;
  readonly source: ThemeSourceKind;
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
export interface ThemeSourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: ThemeSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: ThemeSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/**
 * The whole library, newest edit first, each row already carrying `usedByBrandCount` — the number
 * of distinct brands whose live concepts reference it, counted in SQL by `@tas/db` and never in a
 * component. The fixtures are already in that order, so the page never sorts.
 */
export async function loadThemes(deps: ThemeSourceDeps = {}): Promise<ThemeListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoThemes, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const rows = await listThemes(db);
    return { rows, source: 'database' };
  });
}

/** One theme by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadTheme(id: string, deps: ThemeSourceDeps = {}): Promise<ThemeResult> {
  if (inDemoMode(deps)) {
    return { theme: demoThemes.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const theme = await getThemeById(db, id);
    return { theme, source: 'database' };
  });
}

/**
 * The write path for the Server Actions: one connection, then `run`. Throws in demo mode — a
 * mutation must never reach a database the demo visitor cannot own — and the actions refuse long
 * before this, so the throw is a backstop, never the message a visitor reads.
 *
 * `run` receives the database and nothing else. The brand-scoped sources hand their callback a
 * `brandId` and answer `null` when the workspace has no brand yet; a global library has neither
 * case, so this returns `T` rather than `T | null` and the "no brand yet" branch does not exist.
 */
export async function withGlobalScope<T>(
  run: (db: Db) => Promise<T>,
  deps: ThemeSourceDeps = {},
): Promise<T> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, run);
}
