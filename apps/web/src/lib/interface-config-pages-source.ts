import {
  findCustomPageBySlug,
  listBrandCustomPages,
  listTabVisibility,
  listTemplateCustomPages,
  type CustomInterfacePage,
  type Db,
  type InterfaceTabVisibility,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

/**
 * The custom-pages / tab-visibility route's data access (Oct 6/7 Agent 4). A sibling to
 * `interface-config-source.ts`: the latter owns the shipped PRD §10 configuration, this one owns
 * the new tables the Oct 6/7 sprint added.
 *
 * DEMO MODE returns the empty state (no custom pages, no tab-visibility overrides). The admin page
 * still renders the shipped sections and the two new sections, but their lists are empty — this is
 * fine: the demo deployment is for exploring the SHAPE of the product, not seeded tenant data, and
 * writing custom pages demands a Clerk-authenticated session anyway. `DEMO_MUTATION_REFUSED` is the
 * refusal every mutation returns before anything is parsed.
 *
 * LIVE MODE opens a Neon connection, resolves the actor's brand once, and reads through the scoped
 * queries in `@tas/db/custom-interface-pages`. No singleton.
 */

export interface CustomPagesSnapshot {
  readonly templatePages: readonly CustomInterfacePage[];
  readonly brandPages: readonly CustomInterfacePage[];
  readonly tabVisibility: readonly InterfaceTabVisibility[];
  readonly brandId: string | null;
}

export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface InterfacePagesSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(
  deps: InterfacePagesSourceDeps,
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

/** The admin page's whole data read in one call. Falls through to an empty snapshot in demo mode. */
export async function loadCustomPagesSnapshot(
  deps: InterfacePagesSourceDeps = {},
): Promise<CustomPagesSnapshot> {
  if (inDemoMode(deps)) {
    return { templatePages: [], brandPages: [], tabVisibility: [], brandId: null };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) {
      return { templatePages: [], brandPages: [], tabVisibility: [], brandId: null };
    }
    const [templatePages, brandPages, tabVisibility] = await Promise.all([
      listTemplateCustomPages(db),
      listBrandCustomPages(db, brandId),
      listTabVisibility(db, brandId),
    ]);
    return { templatePages, brandPages, tabVisibility, brandId };
  });
}

/** The read for the client-portal custom route; resolves the row even when the brand hasn't overridden. */
export async function loadCustomPageForBrand(
  brandId: string,
  slug: string,
  deps: InterfacePagesSourceDeps = {},
): Promise<CustomInterfacePage | null> {
  if (inDemoMode(deps)) {
    return null;
  }
  return withDb(deps, async (db) => findCustomPageBySlug(db, brandId, slug));
}

/**
 * The write-path escape hatch for the Server Actions: opens a connection, resolves the actor's
 * brand once, then runs `run`. Throws in demo mode so a write never reaches a database the demo
 * visitor cannot own. Returns null when the workspace has no brand yet.
 *
 * The admin actions refuse in demo mode BEFORE they call this, so the throw is the belt to that
 * pair of braces rather than a path the demo visitor takes.
 */
export async function withInterfacePagesScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: InterfacePagesSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
