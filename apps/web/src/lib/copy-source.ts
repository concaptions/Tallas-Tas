import {
  brands,
  createNeonDb,
  demoBriefs,
  demoCopy,
  getCopyById,
  listBriefs,
  listCopy,
  type CopyListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

/**
 * Where the Copywriting route gets its rows (PRD §5.11). A copy of `personas-source.ts` /
 * `briefs-source.ts`, function for function, because the demo-mode guarantee is the same one and it
 * must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — every demo branch returns BEFORE `serverEnv()` is reached, and
 * `copy-source.test.ts` proves it with an injected connection factory that throws if it is ever
 * called. That is what makes the unauthenticated Vercel deployment safe: the middleware lets every
 * route through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved from `brands`, then the scoped queries in `@tas/db`. No singleton.
 *
 * The fixtures and a seeded database are row-for-row identical, ids and joined creative names
 * included, so the page renders one branch either way. `demoCopy` already arrives in `updated_at`
 * descending order — the order `listCopy` returns — so nothing here sorts.
 *
 * Nothing here formats anything. The Copy # TITLE is `copyTitle` in `@tas/domain/copy` applied to
 * the stored `copyNumber`, the status LABEL and tone are `@tas/domain/state`, and an absent
 * `creativeName` stays `null` all the way to the table, which renders the muted em dash. A row is
 * handed on exactly as `@tas/db` returned it.
 */
export type CopySourceKind = 'database' | 'demo';

/**
 * One option of the panel's Linked Creative `<select>` (ticket criterion 7): a creative brief's id
 * and its auto-generated PRD §7 name. The list is the same rows `listBriefs` returns — never a
 * free-text field, and never a name built here.
 *
 * The "No creative" option is NOT in this list. It is the absence of a choice, which the panel
 * renders as its own empty-valued option and the action stores as `creativeBriefId: null`; putting
 * a sentinel id in here would make "unattached" look like a brief that could be deleted.
 */
export interface CreativeOption {
  readonly id: string;
  readonly name: string;
}

export interface CopyListResult {
  readonly rows: CopyListRow[];
  readonly source: CopySourceKind;
}

/**
 * Everything the Copywriting page renders in one read: the table's rows and the panel's Linked
 * Creative options. One call, so live mode opens ONE connection for both — a page that called two
 * loaders would open and close Neon twice per request to draw a single screen.
 */
export interface CopyWorkspaceResult {
  readonly rows: CopyListRow[];
  readonly creatives: CreativeOption[];
  readonly source: CopySourceKind;
}

export interface CopyResult {
  readonly copy: CopyListRow | null;
  readonly source: CopySourceKind;
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
export interface CopySourceDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createNeonDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: CopySourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const connection = connect(serverEnv().DATABASE_URL);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

function inDemoMode(deps: CopySourceDeps): boolean {
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

/** A brief row reduced to what the `<select>` needs; the name is the brief's own, never rebuilt. */
function toCreativeOption(brief: { readonly id: string; readonly name: string }): CreativeOption {
  return { id: brief.id, name: brief.name };
}

/**
 * Every copy row of the working brand, newest edit first, each already carrying the name of the
 * creative it is tied to — or `null`, the ordinary unattached case (CLAUDE.md non-negotiable 5).
 */
export async function loadCopy(deps: CopySourceDeps = {}): Promise<CopyListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCopy, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const rows = brandId === null ? [] : await listCopy(db, brandId);
    return { rows, source: 'database' };
  });
}

/** The brand's creative briefs as Linked Creative options, in whatever order `listBriefs` returns. */
export async function loadCreativeOptions(deps: CopySourceDeps = {}): Promise<CreativeOption[]> {
  if (inDemoMode(deps)) {
    return demoBriefs.map(toCreativeOption);
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    return brandId === null ? [] : (await listBriefs(db, brandId)).map(toCreativeOption);
  });
}

/**
 * The whole page in one read. In live mode the two queries share a connection and the brand is
 * resolved once; in demo mode both halves are fixtures and nothing is opened.
 */
export async function loadCopyWorkspace(deps: CopySourceDeps = {}): Promise<CopyWorkspaceResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCopy, creatives: demoBriefs.map(toCreativeOption), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    if (brandId === null) {
      return { rows: [], creatives: [], source: 'database' as const };
    }
    const [rows, briefs] = await Promise.all([listCopy(db, brandId), listBriefs(db, brandId)]);
    return { rows, creatives: briefs.map(toCreativeOption), source: 'database' as const };
  });
}

/** One copy row by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadCopyById(id: string, deps: CopySourceDeps = {}): Promise<CopyResult> {
  if (inDemoMode(deps)) {
    return { copy: demoCopy.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    const copy = brandId === null ? null : await getCopyById(db, brandId, id);
    return { copy, source: 'database' };
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
  deps: CopySourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await liveBrandId(db);
    return brandId === null ? null : run(db, brandId);
  });
}
