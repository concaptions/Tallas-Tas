import {
  demoCreativeReports,
  getCreativeReportById,
  listCreativeReports,
  type CreativeReportListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

/**
 * Where the Creative Reporting route gets its rows (Airtable "Creative Reporting", audit §2 row 14
 * and §14). A copy of `products-source.ts`, function for function, because the demo-mode guarantee
 * is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed and `DATABASE_URL` is never read — the demo
 * branch returns BEFORE `serverEnv()` is reached.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts`, then the scoped
 * queries in `@tas/db`. No singleton.
 */
export type CreativeReportSourceKind = 'database' | 'demo';

export interface CreativeReportListResult {
  readonly rows: CreativeReportListRow[];
  readonly source: CreativeReportSourceKind;
}

export interface CreativeReportResult {
  readonly report: CreativeReportListRow | null;
  readonly source: CreativeReportSourceKind;
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
export interface CreativeReportSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(
  deps: CreativeReportSourceDeps,
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

function inDemoMode(deps: CreativeReportSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/**
 * Every report of the working brand, newest edit first, each already carrying its brief name and
 * its difference-CPA formula. The fixtures are already in that order, so the page never sorts.
 */
export async function loadCreativeReports(
  deps: CreativeReportSourceDeps = {},
): Promise<CreativeReportListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCreativeReports, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreativeReports(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One report by id, or null. In demo mode the fixtures are searched; no database is touched. */
export async function loadCreativeReport(
  id: string,
  deps: CreativeReportSourceDeps = {},
): Promise<CreativeReportResult> {
  if (inDemoMode(deps)) {
    return { report: demoCreativeReports.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const report = brandId === null ? null : await getCreativeReportById(db, brandId, id);
    return { report, source: 'database' };
  });
}

/**
 * The write path for the Server Actions: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet. The actions refuse long before this.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: CreativeReportSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
