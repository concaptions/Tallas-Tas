import { createNeonDb, demoTeam, listTeam, type Db, type TeamListRow } from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveAgencyId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Team route gets its rows (PRD §11, §3; ticket `team.md` criterion 12). A copy of
 * `personas-source.ts`, function for function, because the demo-mode guarantee is the same one and
 * it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached. That
 * is what makes the unauthenticated Vercel deployment safe: the middleware lets every route
 * through, so a visitor must be unable to reach real data. `team-source.test.ts` proves it with an
 * injected connection factory that throws.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * agency resolved once, then `listTeam` from `@tas/db`. No singleton.
 *
 * THE ONE DIFFERENCE FROM THE BRAND-SCOPED SOURCES, and it is the point of the page: the scope here
 * is the AGENCY, not a brand. "Who works here, and on which brands" is a question no single brand's
 * scope can answer, so nothing below resolves a working brand and `listTeam` never goes through
 * `withBrand` (see the module comment on `packages/db/src/team.ts`). Do not add a brand argument to
 * any of it: a per-brand roster is a different page, and it is out of this ticket.
 *
 * The fixtures and a seeded database are row-for-row identical, ids included — `team.test.ts`
 * asserts `listTeam(db, agencyId)` equals `demoTeam` on a seeded database — so the page renders one
 * branch either way.
 */
export type TeamSourceKind = 'database' | 'demo';

export interface TeamListResult {
  readonly rows: TeamListRow[];
  readonly source: TeamSourceKind;
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
export interface TeamSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: TeamSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: TeamSourceDeps): boolean {
  return (deps.demoMode ?? isDemoMode)();
}

/**
 * Every member of the agency, ordered by full name, each already carrying `roles`, `brandNames` and
 * `lastActiveAt`. The fixtures are already in that order and `brandNames` is already alphabetical
 * and de-duplicated, so the page never sorts.
 *
 * An agency with no row at all yields an empty table rather than an agency-wide read: the `null`
 * branch never calls `listTeam` without a scope.
 */
export async function loadTeam(deps: TeamSourceDeps = {}): Promise<TeamListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoTeam, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const agencyId = await resolveLiveAgencyId(db, deps);
    const rows = agencyId === null ? [] : await listTeam(db, agencyId);
    return { rows, source: 'database' };
  });
}

/**
 * The write path for the Team route's Server Actions: one connection, the agency resolved once,
 * then `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot
 * own — and the actions refuse long before this, so the throw is a backstop, never the message a
 * visitor reads. Returns `null` when the workspace has no agency yet, the same shape
 * `withBrandScope` uses for a workspace with no brand.
 */
export async function withAgencyScope<T>(
  run: (db: Db, agencyId: string) => Promise<T>,
  deps: TeamSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const agencyId = await resolveLiveAgencyId(db, deps);
    return agencyId === null ? null : run(db, agencyId);
  });
}
