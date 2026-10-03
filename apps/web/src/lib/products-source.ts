import {
  COLUMN_SEED,
  demoProducts,
  getProductById,
  listProducts,
  resolveColumns,
  type Db,
  type ProductListRow,
  type ResolvedColumn,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { orderColumns } from '@/components/views/resolved-columns';
import { requestConnection } from '@/lib/request-db';

/**
 * Where the Products route gets its rows (PRD §5.1). A copy of `personas-source.ts`, function for
 * function, because the demo-mode guarantee is the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed, no connection is opened and `DATABASE_URL` is
 * never read, even when it is set — the demo branch returns BEFORE `serverEnv()` is reached. That
 * is what makes the unauthenticated Vercel deployment safe: the middleware lets every route
 * through, so a visitor must be unable to reach real data.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
 *
 * The fixtures and a seeded database are row-for-row identical, ids and `conceptCount` included, so
 * the page renders one branch either way.
 */
export type ProductSourceKind = 'database' | 'demo';

export interface ProductListResult {
  readonly rows: ProductListRow[];
  readonly source: ProductSourceKind;
}

export interface ProductResult {
  readonly product: ProductListRow | null;
  readonly source: ProductSourceKind;
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
 *
 * `actorScope` comes from `BrandResolverDeps` and is handed straight to `resolveLiveBrandId`, so a
 * test can pin which agency's brand the live branch is allowed to resolve.
 */
export interface ProductSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
  /**
   * The column resolver itself, injected for one reason: what the page does with an EMPTY resolution
   * is the behaviour that matters most (see `loadProductColumns`), and a database whose
   * `column_definitions` are unseeded is not reachable from a unit test otherwise.
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
async function withDb<T>(deps: ProductSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: ProductSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

const PRODUCTS_TABLE_KEY = 'products';

export interface ProductColumnsResult {
  readonly columns: readonly ResolvedColumn[];
  readonly source: ProductSourceKind;
  /**
   * True when `columns` is the PARENT MASTER-SET FALLBACK rather than this brand's own resolved
   * configuration, because the brand resolved no columns at all. Demo mode is never flagged: there
   * the same set is the designed answer (see `PARENT_PRODUCT_COLUMNS`).
   */
  readonly unconfigured: boolean;
}

/**
 * The parent template's Products columns, from `COLUMN_SEED` itself rather than a second list.
 *
 * Deriving it from the seed is what keeps demo mode honest: the fallback cannot drift from what the
 * seed actually writes, because it IS what the seed writes. Hidden rows are dropped, since a hidden
 * row is a column the brand does not show.
 *
 * Ordered by the ONE comparator the grid uses, so the set comes out exactly as `resolveColumns`
 * would have returned the same rows.
 */
const PARENT_PRODUCT_COLUMNS: readonly ResolvedColumn[] = orderColumns(
  COLUMN_SEED.filter((group) => group.target.kind === 'parent')
    .flatMap((group) => group.rows)
    .filter((row) => row.tableKey === PRODUCTS_TABLE_KEY && row.isHidden !== true)
    .map((row) => ({
      columnKey: row.columnKey,
      displayLabel: row.displayLabel,
      displayOrder: row.displayOrder,
      fieldType: row.fieldType ?? null,
      source: row.source ?? 'parent',
      isDetached: false,
      inheritedFrom: null,
    })),
);

/**
 * THE ordered, labelled, visible Products columns of the working brand.
 *
 * Live mode resolves them per brand, so the parent template's relabel reaches every attached child
 * on the next read and a detached child keeps its own. Demo mode answers from the parent master set
 * without opening a connection, exactly like every other loader here — and demo mode's brand is
 * Niagara, which holds no rows of its own, so the parent set is also what a live read would return
 * for it.
 *
 * AN EMPTY RESOLUTION IS NEVER PASSED ON, for the same reason as Personas: an empty column set does
 * not degrade, it erases. `resolveColumns` legitimately returns `[]` for a brand with no rows and no
 * seeded parent, and `brandId` is null while the workspace has no brand yet. Handed `[]` the page
 * renders a `thead` with no `th`, rows with no cells and an empty Fields popover. Dropping a column
 * is the one outcome the owner forbids, so the parent master set is served and `unconfigured` says
 * so, which the workspace states on the page.
 */
export async function loadProductColumns(
  deps: ProductSourceDeps = {},
): Promise<ProductColumnsResult> {
  if (inDemoMode(deps)) {
    return { columns: PARENT_PRODUCT_COLUMNS, source: 'demo', unconfigured: false };
  }
  return withDb(deps, async (db) => {
    const resolve = deps.resolveColumns ?? resolveColumns;
    const brandId = await resolveLiveBrandId(db, deps);
    const columns = brandId === null ? [] : await resolve(db, brandId, PRODUCTS_TABLE_KEY);
    return columns.length === 0
      ? { columns: PARENT_PRODUCT_COLUMNS, source: 'database', unconfigured: true }
      : { columns, source: 'database', unconfigured: false };
  });
}

/**
 * Every product of the working brand, newest edit first, each already carrying `conceptCount` (the
 * live concepts whose angle points at the product). The fixtures are already in that order, so the
 * page never sorts.
 */
export async function loadProducts(deps: ProductSourceDeps = {}): Promise<ProductListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoProducts, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listProducts(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One product by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadProduct(
  id: string,
  deps: ProductSourceDeps = {},
): Promise<ProductResult> {
  if (inDemoMode(deps)) {
    return { product: demoProducts.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const product = brandId === null ? null : await getProductById(db, brandId, id);
    return { product, source: 'database' };
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
  deps: ProductSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
