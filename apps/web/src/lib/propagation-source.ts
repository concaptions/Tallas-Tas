import {
  agencies,
  createNeonDb,
  demoPromotionRequests,
  demoReviewedPromotionRequests,
  listPromotionRequests,
  type Db,
  type PromotionRequestRow,
} from '@tas/db';
import { PROMOTION_STATUS_INITIAL, type PromotionStatusKey } from '@tas/domain/state';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Propagation route gets its rows (PRD §5: "request comes in to the ADMIN dashboard to
 * approve everything"; §14.1: "One template, propagated"). A copy of `personas-source.ts` and
 * `team-source.ts`, function for function, because the demo-mode guarantee is the same one and it
 * must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`, never `process.env`):
 * the in-repo fixtures from `@tas/db`. No database client is constructed, no connection is opened
 * and `DATABASE_URL` is never read, even when it is set — every demo branch below returns BEFORE
 * `serverEnv()` is reached, and `propagation-source.test.ts` proves it with an injected `connect`
 * spy that throws if it is ever called. That is what makes the unauthenticated Vercel deployment
 * safe: the middleware lets every route through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * agency resolved once, then the scoped queries in `@tas/db`. No singleton.
 *
 * THE SCOPE IS THE AGENCY, NOT A BRAND, and that is the point of the page rather than an oversight.
 * A promotion request is raised BY a child brand but settled FOR the template, so the admin looks at
 * every brand's pending requests at once; `packages/db/src/promotion-requests.ts` carries the long
 * version of that argument and puts `brands.agency_id = $agencyId` on every statement. Nothing below
 * resolves a working brand and nothing below goes through `withBrand`. Do not add a brand argument
 * to any of it — a per-brand queue is a different page and it is out of this ticket.
 *
 * `demoPromotionRequests` and a seeded database are row-for-row identical, ids included
 * (`promotion-requests.test.ts` asserts `listPendingPromotionRequests` equals the fixtures on a
 * seeded database), so the table renders one branch either way.
 *
 * WHAT THIS MODULE DOES NOT DO: decide anything. The queue's membership and its order are the
 * query's answer (`status`, `requested_at` descending), so no status literal and no comparator lives
 * in a component; the page hands down the state the address asks for and renders what comes back.
 * Narrowing the FIXTURES to one state is done here, next to the query that does the same job, for
 * exactly that reason. It never re-reads `brands` to name one, because every row already carries
 * `brandName` from the join.
 */
export type PromotionSourceKind = 'database' | 'demo';

export interface PromotionListResult {
  readonly rows: PromotionRequestRow[];
  readonly source: PromotionSourceKind;
}

export interface PromotionResult {
  readonly request: PromotionRequestRow | null;
  readonly source: PromotionSourceKind;
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
export interface PromotionSourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: PromotionSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: PromotionSourceDeps): boolean {
  return (deps.demoMode ?? isDemoMode)();
}

/**
 * The working agency: the first live one, exactly as `team-source.ts` resolves it. The platform runs
 * a single agency (TAS Digital) today, so this is a placeholder for the membership-derived agency
 * that arrives with the org switcher, not a permanent rule. Passing it down is what keeps another
 * tenant's requests — and another tenant's brand names — out of the table if a second agency is ever
 * inserted before that switcher exists.
 */
async function liveAgencyId(db: Db): Promise<string | null> {
  const rows = await db.select().from(agencies);
  return rows.find((row) => row.deletedAt === null)?.id ?? null;
}

/**
 * Every fixture the demo branch can be asked about by id: the pending three the page renders, plus
 * the two an admin has already settled. The TABLE is `demoPromotionRequests` alone (criterion 8:
 * exactly three rows, all pending) — this wider list exists only so a lookup by id answers honestly
 * about a request that has already been decided instead of pretending it never existed.
 */
const demoRequestsById: readonly PromotionRequestRow[] = [
  ...demoPromotionRequests,
  ...demoReviewedPromotionRequests,
];

/**
 * The agency's PENDING promotion requests, newest request first, each already carrying the name of
 * the child brand that raised it.
 *
 * The status is `PROMOTION_STATUS_INITIAL` from `@tas/domain/state`, not a `'pending'` typed here
 * and never one typed in the page, so the queue's membership is the domain's answer. An agency with
 * no row at all yields an empty table rather than an unscoped read: the `null` branch in
 * `loadPromotionRequestsByStatus` never calls the query without a scope.
 */
export async function loadPromotionRequests(
  deps: PromotionSourceDeps = {},
): Promise<PromotionListResult> {
  return loadPromotionRequestsByStatus(PROMOTION_STATUS_INITIAL, deps);
}

/**
 * The agency's requests in ONE state, or in every state when `status` is `undefined` — the read
 * behind the page's `?status=` filter. Newest request first either way.
 *
 * It is the same function as `loadPromotionRequests` above with the state left open, and the page
 * calls this one so that the pending queue and the two settled views are one code path rather than
 * a queue plus a special case. `undefined` means "every state" rather than a fourth key, because
 * `listPromotionRequests` in `@tas/db` already spells `all` that way and a filter word that is not
 * a status has no business travelling into a query.
 *
 * THE STATUS VOCABULARY IS THE DOMAIN'S (`PromotionStatusKey`), so a caller cannot ask for a state
 * this product does not have, and the DEFAULT is `PROMOTION_STATUS_INITIAL` rather than the literal
 * `'pending'` — the queue's membership is still decided by `@tas/domain` and `@tas/db`, never by a
 * string typed in `apps/web`.
 *
 * In demo mode the fixtures are narrowed and ordered here rather than in the page, for the reason
 * the module header gives: the page does not filter and does not sort. The fixture arrays are never
 * mutated — `toSorted` would be the same thing with a newer lib target, and the spread says it
 * plainly.
 */
export async function loadPromotionRequestsByStatus(
  status: PromotionStatusKey | undefined,
  deps: PromotionSourceDeps = {},
): Promise<PromotionListResult> {
  if (inDemoMode(deps)) {
    const matching =
      status === undefined
        ? demoRequestsById
        : demoRequestsById.filter((row) => row.status === status);
    const rows = [...matching].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    return { rows, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const agencyId = await liveAgencyId(db);
    const rows = agencyId === null ? [] : await listPromotionRequests(db, agencyId, status);
    return { rows, source: 'database' };
  });
}

/**
 * One request by id, or null, in ANY status — the lookup a confirmation or a receipt needs after a
 * decision has already moved a row off the pending queue. In demo mode the fixtures are searched;
 * no client is built.
 */
export async function loadPromotionRequest(
  id: string,
  deps: PromotionSourceDeps = {},
): Promise<PromotionResult> {
  if (inDemoMode(deps)) {
    return { request: demoRequestsById.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const agencyId = await liveAgencyId(db);
    const rows = agencyId === null ? [] : await listPromotionRequests(db, agencyId);
    return { request: rows.find((row) => row.id === id) ?? null, source: 'database' };
  });
}

/**
 * The write path for the Propagation route's Server Actions: one connection, the agency resolved
 * once, then `run` — so the actor's roles and the row being settled are read and written inside a
 * single scope rather than across two.
 *
 * Throws in demo mode: a mutation must never reach a database the demo visitor cannot own. The
 * actions refuse long before this, so the throw is the backstop and never the sentence a visitor
 * reads. Returns `null` when the workspace has no agency yet, the same shape `withBrandScope` uses
 * for a workspace with no brand.
 */
export async function withAgencyScope<T>(
  run: (db: Db, agencyId: string) => Promise<T>,
  deps: PromotionSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const agencyId = await liveAgencyId(db);
    return agencyId === null ? null : run(db, agencyId);
  });
}
