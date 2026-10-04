import {
  demoAngles,
  demoBriefs,
  demoCampaigns,
  demoCollections,
  demoConcepts,
  demoCopy,
  demoProducts,
  getCopyById,
  listAngles,
  listBriefs,
  listCampaigns,
  listCollections,
  listConcepts,
  listCopy,
  listProducts,
  type CopyListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

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
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts` — never a private
 * copy of it — then the scoped queries in `@tas/db`. No singleton.
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
export interface ConceptOption {
  readonly id: string;
  readonly name: string;
}

/**
 * THE LOOKUP SIDES of the Meta Copywriting grid (GRATSI-MATCH, 2026-10-04,
 * `docs/audits/gratsi-column-diff-2026-10-04.md`): the linked tables' rows reduced to the fields
 * the Airtable lookups read, loaded HERE on the page's one connection and joined per row by the
 * page. Each pairs with a VIRTUAL `lookupRollup` column in the seed; nothing below is ever stored.
 *
 * - `Offer` / `Campaign (from Campaign)` / `Code (from Campaign)` read `discountOffer` / `name` /
 *   `code` off the rows `copywriting_campaigns` links.
 * - `Collections` / `Collection URL` / `Products (from Collections)` read the collections whose
 *   `copywriting_id` IS this row (the collection owns the link) — name, url, and the linked
 *   product's name.
 * - `Link (from Product)` / `(Internal) Product` read `link` / `name` off the row's `product_id`.
 * - `Angle` reads the linked brief's angle name — the datum `docs/decisions.md` records for the
 *   base's dead text remnant ("the angle is the brief's angle_id").
 */
export interface CopyLookupCampaign {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly discountOffer: string | null;
}

export interface CopyLookupCollection {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly productName: string | null;
  /** The owning side of Airtable's "Collections": the Meta copy this collection points at. */
  readonly copywritingId: string | null;
}

export interface CopyLookupProduct {
  readonly id: string;
  readonly name: string;
  readonly link: string | null;
}

/** One brief reduced to what the copy row's `Angle` lookup reads through `creative_brief_id`. */
export interface CopyBriefLookup {
  readonly id: string;
  readonly angleName: string | null;
}

export interface CopyWorkspaceResult {
  readonly rows: CopyListRow[];
  readonly creatives: CreativeOption[];
  readonly concepts: ConceptOption[];
  readonly campaigns: readonly CopyLookupCampaign[];
  readonly collections: readonly CopyLookupCollection[];
  readonly products: readonly CopyLookupProduct[];
  readonly briefLookups: readonly CopyBriefLookup[];
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
 *
 * `actorScope` comes from `BrandResolverDeps` and is handed straight to `resolveLiveBrandId`, so a
 * test can pin which agency's brand the live branch is allowed to resolve.
 */
export interface CopySourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: CopySourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

/** A brief row reduced to what the `<select>` needs; the name is the brief's own, never rebuilt. */
function toCreativeOption(brief: { readonly id: string; readonly name: string }): CreativeOption {
  return { id: brief.id, name: brief.name };
}

function toConceptOption(concept: { readonly id: string; readonly name: string }): ConceptOption {
  return { id: concept.id, name: concept.name };
}

function toLookupCampaign(row: {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
  readonly discountOffer: string | null;
}): CopyLookupCampaign {
  return { id: row.id, name: row.name, code: row.code, discountOffer: row.discountOffer };
}

function toLookupCollection(row: {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly productName: string | null;
  readonly copywritingId: string | null;
}): CopyLookupCollection {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    productName: row.productName,
    copywritingId: row.copywritingId,
  };
}

function toLookupProduct(row: {
  readonly id: string;
  readonly name: string;
  readonly link: string | null;
}): CopyLookupProduct {
  return { id: row.id, name: row.name, link: row.link };
}

/**
 * The brief's angle, for the copy row's `Angle` lookup: the brief's own `angle_id` when the link
 * is set (the datum `docs/decisions.md` records for the base's residual text), falling back to the
 * concept-inherited `angleName` `listBriefs` already resolved for a brief that reaches its angle
 * through its concept.
 */
function toBriefLookup(
  row: { readonly id: string; readonly angleId: string | null; readonly angleName: string | null },
  angleNamesById: ReadonlyMap<string, string>,
): CopyBriefLookup {
  const direct = row.angleId === null ? undefined : angleNamesById.get(row.angleId);
  return { id: row.id, angleName: direct ?? row.angleName };
}

const COPYWRITING_TABLE_KEY = 'copywriting';

/**
 * THE ordered, labelled, visible Meta Copywriting columns of the working brand, through the ONE
 * loader every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadCopyColumns(deps: CopySourceDeps = {}): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(COPYWRITING_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
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
    const brandId = await resolveLiveBrandId(db, deps);
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
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? [] : (await listBriefs(db, brandId)).map(toCreativeOption);
  });
}

/**
 * The whole page in one read: the rows, the panel's pickers, and the four linked tables the grid's
 * lookup columns read through (campaigns, collections, products, and each brief's angle). In live
 * mode every query shares one connection and the brand is resolved once; in demo mode every half
 * is a fixture and nothing is opened. One read per linked TABLE, joined per row by the page —
 * never a query per row.
 */
export async function loadCopyWorkspace(deps: CopySourceDeps = {}): Promise<CopyWorkspaceResult> {
  if (inDemoMode(deps)) {
    const demoAngleNames = new Map(demoAngles.map((angle) => [angle.id, angle.name]));
    return {
      rows: demoCopy,
      creatives: demoBriefs.map(toCreativeOption),
      concepts: demoConcepts.map(toConceptOption),
      campaigns: demoCampaigns.map(toLookupCampaign),
      collections: demoCollections.map(toLookupCollection),
      products: demoProducts.map(toLookupProduct),
      briefLookups: demoBriefs.map((brief) => toBriefLookup(brief, demoAngleNames)),
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) {
      return {
        rows: [],
        creatives: [],
        concepts: [],
        campaigns: [],
        collections: [],
        products: [],
        briefLookups: [],
        source: 'database' as const,
      };
    }
    const [rows, briefs, conceptRows, campaignRows, collectionRows, productRows, angleRows] =
      await Promise.all([
        listCopy(db, brandId),
        listBriefs(db, brandId),
        listConcepts(db, brandId),
        listCampaigns(db, brandId),
        listCollections(db, brandId),
        listProducts(db, brandId),
        listAngles(db, brandId),
      ]);
    const angleNamesById = new Map(angleRows.map((angle) => [angle.id, angle.name]));
    return {
      rows,
      creatives: briefs.map(toCreativeOption),
      concepts: conceptRows.map(toConceptOption),
      campaigns: campaignRows.map(toLookupCampaign),
      collections: collectionRows.map(toLookupCollection),
      products: productRows.map(toLookupProduct),
      briefLookups: briefs.map((brief) => toBriefLookup(brief, angleNamesById)),
      source: 'database' as const,
    };
  });
}

/** One copy row by id, or null. In demo mode the fixtures are searched; the database is not touched. */
export async function loadCopyById(id: string, deps: CopySourceDeps = {}): Promise<CopyResult> {
  if (inDemoMode(deps)) {
    return { copy: demoCopy.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
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
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
