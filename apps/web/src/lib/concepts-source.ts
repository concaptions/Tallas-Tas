import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  CONCEPT_INTERNAL_STATUS_DEFAULT,
  brands,
  createNeonDb,
  demoConcepts,
  getConceptById,
  listConcepts,
  type ConceptListRow,
  type Db,
} from '@tas/db';
import {
  CLIENT_STATUS,
  internalStatusFor,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Concepts route gets its rows (PRD §5.7). A copy of `personas-source.ts`, function for
 * function, because the demo-mode guarantee is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached. That
 * is what makes the unauthenticated Vercel deployment safe: the middleware lets every route
 * through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved from `brands`, then the scoped queries in `@tas/db`. No singleton.
 *
 * The fixtures and a seeded database are row-for-row identical, ids and every inherited field
 * included, so the page renders one branch either way. The Angles and Themes the detail page's two
 * dropdowns need are NOT loaded here: they come from `angles-source.ts` and `themes-source.ts`, so
 * each table has exactly one loader.
 *
 * This module is also the ONE place the two stored status strings are narrowed to the state
 * machine's key types — see `toConceptRow` below. Downstream of here a component never compares a
 * status to a literal.
 */
export type ConceptSourceKind = 'database' | 'demo';

/**
 * Concepts run on the VIDEO internal track (PRD §5.7 briefs a video editor; `concepts.internal_status`
 * defaults to the first entry of `INTERNAL_VIDEO_STATUS`). Exported so the page, the board columns
 * and the Server Actions all ask `internalStatusFor(CONCEPT_TRACK)` instead of each writing `'video'`.
 */
export const CONCEPT_TRACK: CreativeTrack = 'video';

/**
 * A concept as the pages render it: the `@tas/db` row with its two status columns narrowed from
 * `string` to the state machine's key types, so `TwoTrackApproval` and `StatusChip` can be handed
 * the row's own values with no cast and no local widening.
 */
export type ConceptRow = Omit<ConceptListRow, 'internalStatus' | 'clientStatus'> & {
  readonly internalStatus: InternalStatusKey;
  readonly clientStatus: ClientStatusKey;
};

export interface ConceptListResult {
  readonly rows: ConceptRow[];
  readonly source: ConceptSourceKind;
}

export interface ConceptResult {
  readonly concept: ConceptRow | null;
  readonly source: ConceptSourceKind;
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
export interface ConceptSourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

/**
 * The stored internal status, narrowed to a key of this concept's track.
 *
 * `concepts.internal_status` is plain `text` on purpose (the state machine in `@tas/domain/state`
 * owns the vocabulary, not a pg enum), so the row type says `string` and the narrowing has to
 * happen exactly once, here at the boundary. A value this build does not know — a key written by a
 * newer build, or the non-linear `on_hold` branch, which is deliberately not a member of either
 * linear list — falls back to the column's own default rather than being rendered as a step the
 * stepper cannot place. `CONCEPT_INTERNAL_STATUS_DEFAULT` comes from `@tas/db`, and
 * `concepts-source.test.ts` asserts it is the same string as the first entry of the track.
 */
function internalStatusOf(stored: string): InternalStatusKey {
  return (
    internalStatusFor(CONCEPT_TRACK).find((entry) => entry.key === stored)?.key ??
    CONCEPT_INTERNAL_STATUS_DEFAULT
  );
}

/** The stored client status, narrowed the same way and for the same reason. */
function clientStatusOf(stored: string): ClientStatusKey {
  return CLIENT_STATUS.find((entry) => entry.key === stored)?.key ?? CONCEPT_CLIENT_STATUS_DEFAULT;
}

/**
 * One `@tas/db` row as the pages want it. Nothing else is transformed: the inherited angle fields
 * arrive already resolved (and already null wherever a link is absent), and ordering is the query's.
 */
export function toConceptRow(row: ConceptListRow): ConceptRow {
  return {
    ...row,
    internalStatus: internalStatusOf(row.internalStatus),
    clientStatus: clientStatusOf(row.clientStatus),
  };
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: ConceptSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: ConceptSourceDeps): boolean {
  return (deps.demoMode ?? isDemoMode)();
}

/**
 * The working brand: the first live client workspace, never the parent template. A single-brand V0
 * shell needs no more; per-membership selection arrives with the brand switcher.
 */
async function liveBrandId(db: Db): Promise<string | null> {
  const rows = await db.select().from(brands);
  return rows.find((row) => row.deletedAt === null && !row.isTemplate)?.id ?? null;
}

/**
 * Every concept of the working brand, newest edit first, each already carrying the angle's name,
 * the theme's name and the five fields the detail page shows read-only under "from Angle".
 */
export async function loadConcepts(deps: ConceptSourceDeps = {}): Promise<ConceptListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoConcepts.map(toConceptRow), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const rows = brandId === null ? [] : await listConcepts(db, brandId);
    return { rows: rows.map(toConceptRow), source: 'database' };
  });
}

/**
 * One concept by id, or null — the detail page turns that null into `notFound()` rather than
 * crashing. In demo mode the fixtures are searched; the database is not touched.
 */
export async function loadConceptById(
  id: string,
  deps: ConceptSourceDeps = {},
): Promise<ConceptResult> {
  if (inDemoMode(deps)) {
    const found = demoConcepts.find((row) => row.id === id);
    return { concept: found === undefined ? null : toConceptRow(found), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const concept = brandId === null ? null : await getConceptById(db, brandId, id);
    return { concept: concept === null ? null : toConceptRow(concept), source: 'database' };
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
  deps: ConceptSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    return brandId === null ? null : run(db, brandId);
  });
}
