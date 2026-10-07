import {
  demoAssets,
  demoCollaborations,
  demoCreators,
  demoPartnershipCreators,
  getCreatorById,
  listAssets,
  listCollaborations,
  listCreatorAssets,
  listCreators,
  listPartnershipCreators,
  PARTNERSHIP_REFERENCE_DATE,
  type AssetListRow,
  type CollaborationListRow,
  type CreatorListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the UGC Management route gets its rows (PRD §5.8 and §5.8.1). A copy of
 * `personas-source.ts` / `copy-source.ts`, function for function, because the demo-mode guarantee is
 * the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — every demo branch returns BEFORE `serverEnv()` is reached, and
 * `ugc-source.test.ts` proves it with an injected connection factory that throws if it is ever
 * called. That is what makes the unauthenticated Vercel deployment safe: the middleware lets every
 * route through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 *
 * THE CLOCK IS PART OF THE READ. Everything §5.8.1 shows about a partnership — the lapse date, the
 * countdown, the near-expiry highlight — is `now` applied to three stored columns by the pure
 * functions in `@tas/domain/creators`. So `now` is resolved ONCE here, on the server, and travels
 * with the rows; no component may call `new Date()` (ticket criterion 11: a second clock is a
 * hydration mismatch waiting to happen).
 *
 * In demo mode that instant is `PARTNERSHIP_REFERENCE_DATE`, the date the fixtures are pinned to,
 * NOT the wall clock: the fixtures encode "three days left", and read against a real clock they
 * would drift to two, then one, then Expired, and the demo deployment would quietly stop showing
 * the one row §5.8.1 exists to put in front of somebody. Live mode passes the real clock, because
 * real rows carry real dates.
 *
 * Nothing here formats or decides anything. Status LABELS and tones are `@tas/domain/state`, expiry
 * is `@tas/domain/creators`, and a row is handed on exactly as `@tas/db` returned it.
 */
export type UgcSourceKind = 'database' | 'demo';

export interface CreatorListResult {
  readonly rows: CreatorListRow[];
  readonly source: UgcSourceKind;
}

/**
 * Everything the UGC page renders in one read: the Creators grid, the Partnership Ads table and the
 * instant both are read against. One call, so live mode opens ONE connection for the whole screen
 * rather than one per tab.
 */
export interface UgcWorkspaceResult {
  readonly creators: CreatorListRow[];
  readonly partnerships: CreatorListRow[];
  readonly now: Date;
  readonly source: UgcSourceKind;
}

export interface CreatorResult {
  readonly creator: CreatorListRow | null;
  readonly source: UgcSourceKind;
}

export interface CollaborationListResult {
  readonly rows: CollaborationListRow[];
  readonly source: UgcSourceKind;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env`, `connect` opens Neon and `clock` is the wall clock. A test injects
 * `connect` to prove the demo branch never constructs a client.
 *
 * `actorScope` comes from `BrandResolverDeps` and is handed straight to `resolveLiveBrandId`, so a
 * test can pin which agency's brand the live branch is allowed to resolve.
 */
export interface UgcSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
  readonly clock?: () => Date;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: UgcSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

/** The live instant the partnership arithmetic is read against. Never called in demo mode. */
function liveNow(deps: UgcSourceDeps): Date {
  return (deps.clock ?? (() => new Date()))();
}

const CREATORS_TABLE_KEY = 'creators';

/**
 * THE ordered, labelled, visible creators columns of the working brand, through the ONE loader every
 * resolver-driven page shares (`lib/resolved-columns-source.ts`). The table key is `creators`, not
 * `ugc`: the page is named for the module, the table for the records.
 */
export async function loadCreatorColumns(deps: UgcSourceDeps = {}): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(CREATORS_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/** Every creator of the working brand, newest edit first. */
export async function loadCreators(deps: UgcSourceDeps = {}): Promise<CreatorListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCreators, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreators(db, brandId);
    return { rows, source: 'database' };
  });
}

/**
 * The brand's partnership creators — `for_partnership_ads` true — newest edit first. The filter is
 * `listPartnershipCreators`'s, applied in SQL inside the scope, never a `filter` over a full read.
 */
export async function loadPartnerships(deps: UgcSourceDeps = {}): Promise<CreatorListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoPartnershipCreators, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listPartnershipCreators(db, brandId);
    return { rows, source: 'database' };
  });
}

/**
 * The whole page in one read. In live mode the two queries share a connection and the brand is
 * resolved once; in demo mode both halves are fixtures, nothing is opened, and `now` is the instant
 * the fixtures are pinned to.
 */
export async function loadUgc(deps: UgcSourceDeps = {}): Promise<UgcWorkspaceResult> {
  if (inDemoMode(deps)) {
    return {
      creators: demoCreators,
      partnerships: demoPartnershipCreators,
      now: PARTNERSHIP_REFERENCE_DATE,
      source: 'demo',
    };
  }
  const now = liveNow(deps);
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) {
      return { creators: [], partnerships: [], now, source: 'database' as const };
    }
    const [creators, partnerships] = await Promise.all([
      listCreators(db, brandId),
      listPartnershipCreators(db, brandId),
    ]);
    return { creators, partnerships, now, source: 'database' as const };
  });
}

/** One creator by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadCreator(id: string, deps: UgcSourceDeps = {}): Promise<CreatorResult> {
  if (inDemoMode(deps)) {
    return { creator: demoCreators.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const creator = brandId === null ? null : await getCreatorById(db, brandId, id);
    return { creator, source: 'database' };
  });
}

export interface CreatorVideoListResult {
  readonly rows: readonly AssetListRow[];
  readonly source: UgcSourceKind;
}

/**
 * A creator's showcase videos (Sprint 7, UGC media): the `assets` rows linked to the creator,
 * newest first. The same attachment storage every other upload uses — one table, one R2 bucket —
 * filtered by `creator_id` rather than a second media table.
 */
export async function loadCreatorVideos(
  creatorId: string,
  deps: UgcSourceDeps = {},
): Promise<CreatorVideoListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoAssets.filter((row) => row.creatorId === creatorId), source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCreatorAssets(db, brandId, creatorId);
    return { rows, source: 'database' };
  });
}

/** A creator's collaboration instances, newest first. */
export async function loadCollaborations(
  creatorId: string,
  deps: UgcSourceDeps = {},
): Promise<CollaborationListResult> {
  if (inDemoMode(deps)) {
    return {
      rows: demoCollaborations.filter((row) => row.creatorId === creatorId),
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCollaborations(db, brandId, creatorId);
    return { rows, source: 'database' };
  });
}

/** One asset's thumbnail data as the gallery card renders it: the URL, the filename and the category. */
export interface CreatorAssetSummary {
  readonly url: string;
  readonly filename: string;
  readonly category: string;
}

/**
 * All assets in the brand that are linked to a creator, grouped by `creatorId`. The gallery card
 * shows up to four thumbnails and the total count, so every creator's assets travel on the same
 * page load rather than N+1-ing a request per card.
 *
 * In demo mode the fixtures are filtered in JS; in live mode `listAssets` runs one scoped query
 * and the grouping is done here, never in a component.
 */
export async function loadAllCreatorAssets(
  deps: UgcSourceDeps = {},
): Promise<Map<string, readonly CreatorAssetSummary[]>> {
  const toSummary = (row: AssetListRow): CreatorAssetSummary => ({
    url: row.url,
    filename: row.filename,
    category: row.category,
  });

  if (inDemoMode(deps)) {
    const map = new Map<string, CreatorAssetSummary[]>();
    for (const row of demoAssets) {
      if (row.creatorId === null) continue;
      const list = map.get(row.creatorId);
      if (list !== undefined) {
        list.push(toSummary(row));
      } else {
        map.set(row.creatorId, [toSummary(row)]);
      }
    }
    return map;
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return new Map<string, CreatorAssetSummary[]>();
    const all = await listAssets(db, brandId);
    const map = new Map<string, CreatorAssetSummary[]>();
    for (const row of all) {
      if (row.creatorId === null) continue;
      const list = map.get(row.creatorId);
      if (list !== undefined) {
        list.push(toSummary(row));
      } else {
        map.set(row.creatorId, [toSummary(row)]);
      }
    }
    return map;
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
  deps: UgcSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
