import {
  BRIEF_CLIENT_STATUS_DEFAULT,
  brands,
  createNeonDb,
  demoBriefs,
  getBriefById,
  listBriefs,
  type BriefListRow,
  type Db,
} from '@tas/db';
import { creativeTrack } from '@tas/domain/creatives';
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
 * Where the Creative Briefs route gets its rows (PRD §5.10). A copy of `personas-source.ts` /
 * `concepts-source.ts`, function for function, because the demo-mode guarantee is the same one and
 * it must not drift between routes.
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
 * The fixtures and a seeded database are row-for-row identical, ids and inherited names included,
 * so the page renders one branch either way. `demoBriefs` already arrives in `updated_at`
 * descending order — the order `listBriefs` returns — so nothing here sorts.
 *
 * This module is also the ONE place the two stored status strings are narrowed to the state
 * machine's key types, and the one place a brief's TRACK is attached to its row. Downstream of here
 * a component never compares a status to a literal and never branches on `'Static'`.
 */
export type BriefSourceKind = 'database' | 'demo';

/**
 * A brief as the pages render it: the `@tas/db` row with its two status columns narrowed from
 * `string` to the state machine's key types, plus the track those statuses are graded on.
 *
 * `track` is derived, not stored. Unlike a concept — which is always on the video ladder, hence the
 * single `CONCEPT_TRACK` constant next door — a brief's ladder depends on its own `type`: a
 * carousel is a set of stills and is graded on the static track, a motion image is cut like a video
 * and is graded on the video track. Carrying it on the row is what makes the narrowing below and
 * the rail the page renders agree by construction; the mapping itself is `creativeTrack` in
 * `@tas/domain/creatives`, never a branch written here.
 */
export type BriefRow = Omit<BriefListRow, 'internalStatus' | 'clientStatus'> & {
  readonly internalStatus: InternalStatusKey;
  readonly clientStatus: ClientStatusKey;
  readonly track: CreativeTrack;
};

export interface BriefListResult {
  readonly rows: BriefRow[];
  readonly source: BriefSourceKind;
}

export interface BriefResult {
  readonly brief: BriefRow | null;
  readonly source: BriefSourceKind;
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
export interface BriefSourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

/**
 * The state a brief of this track rests at before anything has happened to it: the FIRST entry of
 * its own ladder. For the video track that is `BRIEF_INTERNAL_STATUS_DEFAULT`, the literal
 * `schema/briefs.ts` gives the column — `briefs-source.test.ts` asserts the two are the same
 * string. The static track starts somewhere else, which is exactly why this is a function of the
 * track and not the column default: a column default cannot look at another column, so a static
 * brief whose stored status this build cannot place must fall back to the static track's own first
 * step rather than to a video state the stepper could never render.
 */
function trackStart(track: CreativeTrack): InternalStatusKey {
  const [first] = internalStatusFor(track);
  if (first === undefined) {
    throw new Error(`the ${track} internal track is empty`);
  }
  return first.key;
}

/**
 * The stored internal status, narrowed to a key of THIS brief's track.
 *
 * `creative_briefs.internal_status` is plain `text` on purpose (the state machine in
 * `@tas/domain/state` owns the vocabulary, not a pg enum), so the row type says `string` and the
 * narrowing has to happen exactly once, here at the boundary. A value this track cannot place — a
 * key written by a newer build, the non-linear `on_hold` branch, which is deliberately not a member
 * of either linear list, or a key belonging to the OTHER track — falls back to this track's first
 * step rather than being rendered as a step the stepper cannot place.
 *
 * That last case is not an error path, it is the ordinary one for a fresh static brief.
 * `creative_briefs.internal_status` defaults to `BRIEF_INTERNAL_STATUS_DEFAULT`, a video-track
 * literal, because — as `schema/briefs.ts` says — a column default cannot look at another column;
 * a Static or Carousel brief nobody has moved yet therefore rests on a key its own ladder does not
 * contain, and the same sentence in that file names the answer: the page reads the track from the
 * brief's `type` and shows `sent_to_designer`. This function is where that happens, once, instead
 * of in the rail and again in the list.
 */
function internalStatusOf(stored: string, track: CreativeTrack): InternalStatusKey {
  return internalStatusFor(track).find((entry) => entry.key === stored)?.key ?? trackStart(track);
}

/** The stored client status, narrowed the same way and for the same reason. */
function clientStatusOf(stored: string): ClientStatusKey {
  return CLIENT_STATUS.find((entry) => entry.key === stored)?.key ?? BRIEF_CLIENT_STATUS_DEFAULT;
}

/**
 * One `@tas/db` row as the pages want it. Nothing else is transformed: the inherited concept, angle
 * and product names arrive already resolved (and already null wherever a link is absent — the
 * standalone case, PRD §8), and ordering is the query's.
 */
export function toBriefRow(row: BriefListRow): BriefRow {
  const track = creativeTrack(row.type);
  return {
    ...row,
    track,
    internalStatus: internalStatusOf(row.internalStatus, track),
    clientStatus: clientStatusOf(row.clientStatus),
  };
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: BriefSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: BriefSourceDeps): boolean {
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
 * Every brief of the working brand, newest edit first, each already carrying the concept name, the
 * angle name and the product name it inherits through its concept — all three null for a standalone.
 */
export async function loadBriefs(deps: BriefSourceDeps = {}): Promise<BriefListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoBriefs.map(toBriefRow), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const rows = brandId === null ? [] : await listBriefs(db, brandId);
    return { rows: rows.map(toBriefRow), source: 'database' };
  });
}

/**
 * One brief by id, or null — the detail page turns that null into `notFound()` rather than
 * crashing. In demo mode the fixtures are searched; the database is not touched.
 */
export async function loadBriefById(id: string, deps: BriefSourceDeps = {}): Promise<BriefResult> {
  if (inDemoMode(deps)) {
    const found = demoBriefs.find((row) => row.id === id);
    return { brief: found === undefined ? null : toBriefRow(found), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const brief = brandId === null ? null : await getBriefById(db, brandId, id);
    return { brief: brief === null ? null : toBriefRow(brief), source: 'database' };
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
  deps: BriefSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    return brandId === null ? null : run(db, brandId);
  });
}
