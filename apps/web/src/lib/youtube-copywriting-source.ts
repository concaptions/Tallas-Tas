import {
  demoCampaigns,
  demoCollections,
  demoCopyTypes,
  demoProducts,
  demoYoutubeCopy,
  getYoutubeCopyById,
  listCampaigns,
  listCollections,
  listCopyTypes,
  listProducts,
  listYoutubeCopy,
  type Db,
  type YoutubeCopyListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the YouTube Copywriting route gets its rows (Airtable `tblVR1UmkbDoDzJ7z`). A copy of
 * `products-source.ts` / `copy-source.ts`, function for function, because the demo-mode guarantee
 * is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — every demo branch returns BEFORE `serverEnv()` is reached.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts`, then the scoped
 * queries in `@tas/db`. No singleton.
 *
 * The panel's four chip pickers need the brand's collections, products, campaigns and copy types.
 * They are loaded HERE, on the same connection as the rows, rather than through the sibling
 * `*-source.ts` modules: one page read opens one connection. Copy types in particular are read
 * straight from `@tas/db` (`demoCopyTypes` / `listCopyTypes`) for that reason.
 */
export type YoutubeCopySourceKind = 'database' | 'demo';

/** One option of a chip picker: a linked record's id and the name its chip shows. */
export interface LinkOption {
  readonly id: string;
  readonly name: string;
}

/** A campaign option: the chip shows the Campaign Code, falling back to the generated name. */
export interface CampaignOption extends LinkOption {
  readonly code: string | null;
}

export interface YoutubeCopyWorkspaceResult {
  readonly rows: YoutubeCopyListRow[];
  readonly collections: LinkOption[];
  readonly products: LinkOption[];
  readonly campaigns: CampaignOption[];
  readonly copyTypes: LinkOption[];
  readonly source: YoutubeCopySourceKind;
}

export interface YoutubeCopyResult {
  readonly copy: YoutubeCopyListRow | null;
  readonly source: YoutubeCopySourceKind;
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
export interface YoutubeCopySourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: YoutubeCopySourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function toOption(row: { readonly id: string; readonly name: string }): LinkOption {
  return { id: row.id, name: row.name };
}

function toCampaignOption(row: {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}): CampaignOption {
  return { id: row.id, name: row.name, code: row.code };
}

const YOUTUBE_COPY_TABLE_KEY = 'youtube_copy';

/**
 * THE ordered, labelled, visible YouTube Copywriting columns of the working brand, through the ONE
 * loader every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadYoutubeCopyColumns(
  deps: YoutubeCopySourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(YOUTUBE_COPY_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * The whole page in one read: the rows, newest edit first, and the four pickers' options. In live
 * mode the five queries share one connection and the brand is resolved once; in demo mode every
 * half is a fixture and nothing is opened.
 */
export async function loadYoutubeCopyWorkspace(
  deps: YoutubeCopySourceDeps = {},
): Promise<YoutubeCopyWorkspaceResult> {
  if (inDemoMode(deps)) {
    return {
      rows: demoYoutubeCopy,
      collections: demoCollections.map(toOption),
      products: demoProducts.map(toOption),
      campaigns: demoCampaigns.map(toCampaignOption),
      copyTypes: demoCopyTypes.map(toOption),
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) {
      return {
        rows: [],
        collections: [],
        products: [],
        campaigns: [],
        copyTypes: [],
        source: 'database' as const,
      };
    }
    const [rows, collections, products, campaigns, copyTypes] = await Promise.all([
      listYoutubeCopy(db, brandId),
      listCollections(db, brandId),
      listProducts(db, brandId),
      listCampaigns(db, brandId),
      listCopyTypes(db, brandId),
    ]);
    return {
      rows,
      collections: collections.map(toOption),
      products: products.map(toOption),
      campaigns: campaigns.map(toCampaignOption),
      copyTypes: copyTypes.map(toOption),
      source: 'database' as const,
    };
  });
}

/** One row by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadYoutubeCopy(
  id: string,
  deps: YoutubeCopySourceDeps = {},
): Promise<YoutubeCopyResult> {
  if (inDemoMode(deps)) {
    return { copy: demoYoutubeCopy.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const copy = brandId === null ? null : await getYoutubeCopyById(db, brandId, id);
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
  deps: YoutubeCopySourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
