import {
  demoPersonas,
  getPersonaById,
  listPersonas,
  type Db,
  type PersonaListRow,
  type ResolvedColumn,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the Personas route gets its rows.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set. That is what makes the unauthenticated Vercel deployment safe:
 * the middleware lets every route through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 *
 * The fixtures and a seeded database are row-for-row identical, ids included, so the page renders
 * one branch either way.
 */
export type PersonaSourceKind = 'database' | 'demo';

export interface PersonaListResult {
  readonly rows: PersonaListRow[];
  readonly source: PersonaSourceKind;
}

export interface PersonaResult {
  readonly persona: PersonaListRow | null;
  readonly source: PersonaSourceKind;
}

/**
 * The brand's Personas columns as the resolver returned them. An alias of the shared result type, so
 * the page's import does not change and there is still only one definition of the shape.
 */
export type PersonaColumnsResult = ResolvedColumnsResult;

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
export interface PersonaSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
  /**
   * The column resolver itself. Injected for one reason: what the page does with an EMPTY
   * resolution is the behaviour that matters most here (see `loadPersonaColumns`), and a database
   * whose `column_definitions` are unseeded is not reachable from a unit test otherwise.
   */
  readonly resolveColumns?: (
    db: Db,
    brandId: string,
    tableKey: string,
  ) => Promise<readonly ResolvedColumn[]>;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: PersonaSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

/** Every persona of the working brand, newest edit first, each already carrying `productName`. */
export async function loadPersonas(deps: PersonaSourceDeps = {}): Promise<PersonaListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoPersonas, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listPersonas(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One persona by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadPersona(
  id: string,
  deps: PersonaSourceDeps = {},
): Promise<PersonaResult> {
  if (inDemoMode(deps)) {
    return { persona: demoPersonas.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const persona = brandId === null ? null : await getPersonaById(db, brandId, id);
    return { persona, source: 'database' };
  });
}

/** The one table key the Personas route resolves columns for; `PROPAGATION_TABLES` keys it. */
const PERSONAS_TABLE_KEY = 'personas';

/**
 * THE ordered, labelled, visible Personas columns of the working brand, through the ONE loader every
 * resolver-driven page shares (`lib/resolved-columns-source.ts`).
 *
 * The empty-resolution rule that used to be written out here lives there now, decided once: an empty
 * column set does not degrade, it erases, so the parent master set is served instead and
 * `unconfigured` says so. Products was the second page to need the identical twelve lines and eleven
 * more are due, which is reason enough for the rule to have one home.
 */
export async function loadPersonaColumns(
  deps: PersonaSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(PERSONAS_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * The write path for the Server Actions: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: PersonaSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
