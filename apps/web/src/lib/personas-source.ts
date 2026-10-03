import {
  COLUMN_SEED,
  demoPersonas,
  getPersonaById,
  listPersonas,
  resolveColumns,
  type Db,
  type PersonaListRow,
  type ResolvedColumn,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { orderColumns } from '@/components/views/resolved-columns';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

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

/** The brand's Personas columns as the resolver returned them, and where they came from. */
export interface PersonaColumnsResult {
  readonly columns: readonly ResolvedColumn[];
  readonly source: PersonaSourceKind;
  /**
   * True when `columns` is the PARENT MASTER-SET FALLBACK rather than this brand's own resolved
   * configuration, because the brand resolved no columns at all. Demo mode is never flagged: there
   * the same set is the designed answer (see `PARENT_PERSONA_COLUMNS`). The page states the flag
   * instead of passing a fallback off as configuration.
   */
  readonly unconfigured: boolean;
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

function inDemoMode(deps: PersonaSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
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
 * THE PARENT TEMPLATE'S MASTER SET of Personas columns: the parent rows of `COLUMN_SEED`, the same
 * rows `seedColumnDefinitions` writes, read out of the seed rather than retyped here where they
 * could drift from it. `passion` is absent because it is Gratsi's own child-added column, not the
 * parent's, and the hidden rows are dropped because the resolver drops them.
 *
 * It is the answer in two situations, and for the same reason both times — a child that departs
 * from the parent NOWHERE resolves to the parent's set verbatim:
 *
 * 1. DEMO MODE, which has no database at all, so `resolveColumns` cannot run. The fixtures are
 *    Niagara Sleep Solutions, a child brand with no `column_definitions` rows of its own, so this
 *    set is exactly what the resolver would return for it. Expected, and not flagged.
 * 2. AN EMPTY RESOLUTION in live mode, which is NOT expected and is flagged — see
 *    `loadPersonaColumns`, which is where the two cases are told apart.
 *
 * Ordered by the ONE comparator the grid and the panel use, so the set comes out in exactly the
 * order `resolveColumns` would have returned the same rows in.
 */
const PARENT_PERSONA_COLUMNS: readonly ResolvedColumn[] = orderColumns(
  COLUMN_SEED.filter((group) => group.target.kind === 'parent')
    .flatMap((group) => group.rows)
    .filter((row) => row.tableKey === PERSONAS_TABLE_KEY && row.isHidden !== true)
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
 * THE ordered, labelled, visible Personas columns of the working brand — the page's column set.
 *
 * Live mode resolves them per brand, so the parent template's relabel reaches every attached child
 * on the next read and a detached child keeps its own. Demo mode answers from the parent master set
 * above without opening a connection, exactly like every other loader in this module.
 *
 * AN EMPTY RESOLUTION IS NEVER PASSED ON, because an empty column set does not degrade — it erases.
 * `resolveColumns` legitimately returns `[]` for a brand with no `column_definitions` rows of its
 * own and no seeded parent (`template_brand_id` NULL, or any brand at all before the seed has run),
 * and `brandId` is null while the workspace has no brand yet. Handed `[]`, the page renders a
 * `thead` with no `th` and rows with no cells, an empty Fields popover, a gallery with no fields,
 * and a name-only panel — the brand's stored prose neither shown nor editable, with no notice.
 * Dropping a column is the one outcome the owner forbids, so the parent master set is served
 * instead and `unconfigured` says so, which the workspace states on the page.
 */
export async function loadPersonaColumns(
  deps: PersonaSourceDeps = {},
): Promise<PersonaColumnsResult> {
  if (inDemoMode(deps)) {
    return { columns: PARENT_PERSONA_COLUMNS, source: 'demo', unconfigured: false };
  }
  return withDb(deps, async (db) => {
    const resolve = deps.resolveColumns ?? resolveColumns;
    const brandId = await resolveLiveBrandId(db, deps);
    const columns = brandId === null ? [] : await resolve(db, brandId, PERSONAS_TABLE_KEY);
    return columns.length === 0
      ? { columns: PARENT_PERSONA_COLUMNS, source: 'database', unconfigured: true }
      : { columns, source: 'database', unconfigured: false };
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
