import { auth } from '@clerk/nextjs/server';
import {
  DEMO_BRAND_ID,
  agencies,
  angles,
  brands,
  concepts,
  demoAngles,
  demoConcepts,
  demoPersonas,
  demoThemes,
  getActiveBrandRole,
  listPersonas,
  memberships,
  themes,
  users,
  type DashboardRole,
  type Db,
  type PersonaListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';
import { cache } from 'react';

import { readActiveBrandId } from './active-brand';
import { isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

/**
 * The one place the app decides where its data comes from, and THE ONE PLACE IT DECIDES WHICH BRAND
 * IT IS LOOKING AT. Every `*-source.ts` module used to carry its own private copy of that second
 * decision; they now all call `resolveLiveBrandId` below, so there is a single definition to correct
 * when per-membership brand selection arrives with the switcher.
 *
 * DEMO MODE (no Clerk publishable key): the in-repo fixtures from `@tas/db`, and NOT the database —
 * `withDb()` is never reached, even with `DATABASE_URL` set, because every demo branch returns
 * BEFORE `serverEnv()` is read. That is the half of the demo-mode rule that makes an
 * unauthenticated visitor safe, because the middleware lets every route through. `connect` is
 * injectable for exactly one reason: "no client was constructed" is not observable otherwise, and
 * `data-source.test.ts` proves it with a factory that throws if it is ever called.
 *
 * LIVE MODE (Clerk configured): Postgres through `createAutoDb`, on ONE connection per request
 * (`requestConnection`, `request-db.ts`) shared by every loader and ended by `after` once the response
 * is sent; the agency and brand scope are resolved once per request too (`agencyIdFor`/`scopeFor`
 * below). Both are React `cache` memos, per request, never per process — no module-level singleton
 * (CLAUDE.md, "No shared mutable module state").
 *
 * The fixtures and a seeded database are row-for-row identical, ids included (`seed(db)` writes the
 * same rows into a child brand whose id is `DEMO_BRAND_ID`), so a page renders one branch either way.
 */
export interface BrandSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

export interface SectionCounts {
  readonly personas: number;
  readonly angles: number;
  readonly themes: number;
  readonly concepts: number;
}

export interface Overview {
  readonly brand: BrandSummary | null;
  readonly counts: SectionCounts;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * What the request knows about who is asking, before any row is read. Both fields are nullable
 * because both genuinely can be absent: a background job or a script has no session at all, and a
 * signed-in user with no active Clerk Organization has a `userId` but no `orgId`.
 */
export interface ActorScope {
  readonly clerkOrgId: string | null;
  readonly clerkUserId: string | null;
}

/** The seam the brand resolver takes, and therefore the seam every `*-source.ts` module passes on. */
export interface BrandResolverDeps {
  readonly actorScope?: () => Promise<ActorScope>;
  /**
   * The brand the person chose in the switcher, as remembered by the cookie. A seam for the same
   * reason `actorScope` is one: production reads it from `next/headers`, a test hands it in. It is
   * only ever a REQUEST — `resolveLiveBrand` validates it against the agency in scope.
   */
  readonly activeBrandId?: () => Promise<string | null>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env`, `connect` opens Neon and `actorScope` asks Clerk.
 */
export interface DataSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

/**
 * Raised instead of guessing. `brands.agency_id` is NOT NULL, so "the first live non-template brand"
 * is only a well-defined answer while the database holds one agency; with two it silently becomes
 * whichever tenant's row sorts first, which every later `withBrand(brandId)` call then scopes
 * *correctly* — to a brand the actor may not belong to. A loud failure on a cross-tenant read is the
 * right answer; a quiet wrong one is not.
 */
export class AmbiguousBrandError extends Error {
  /** The candidates that could not be told apart, so the caller can say what it found. */
  readonly agencyIds: readonly string[];

  constructor(agencyIds: readonly string[]) {
    super(
      `Cannot resolve a working brand: ${agencyIds.join(', ')} are in scope and the request ` +
        'carries no actor to choose between them. Refusing to guess rather than read another tenant.',
    );
    this.name = 'AmbiguousBrandError';
    this.agencyIds = [...agencyIds];
  }
}

/** The brand the demo fixtures belong to. `seed(db)` gives the seeded child brand this exact id. */
const DEMO_BRAND: BrandSummary = {
  id: DEMO_BRAND_ID,
  name: 'Niagara Sleep Solutions',
  status: 'active',
};

const EMPTY_COUNTS: SectionCounts = { personas: 0, angles: 0, themes: 0, concepts: 0 };

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: DataSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const connect = deps.connect ?? neonConnection;
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error(
      'DATABASE_URL is not configured. Run in demo mode or provide a Neon connection string.',
    );
  }
  const connection = connect(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

/**
 * True when the data layer should serve fixtures instead of querying the database. This is a
 * superset of `isDemoMode()`: fixtures are used when Clerk is absent (full demo) OR when the
 * database is not configured (auth works but no data store yet — the P5-001 transitional state).
 */
function inFixtureMode(deps: DataSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

/** A live row is current when it has not been soft deleted. Soft delete only, never `DELETE FROM`. */
function isLive(row: { deletedAt: Date | null }): boolean {
  return row.deletedAt === null;
}

/**
 * The session, as the resolver needs it. Clerk's `auth()` throws outside a request context — a
 * background job, a script, a unit test — and that is not an error here: it means "no actor scope",
 * which the resolver answers by narrowing on the agency count or by refusing. It never becomes a
 * guess, so swallowing the throw cannot produce a cross-tenant read.
 */
async function clerkActorScope(): Promise<ActorScope> {
  try {
    const { userId, orgId } = await auth();
    return { clerkOrgId: orgId ?? null, clerkUserId: userId ?? null };
  } catch {
    return { clerkOrgId: null, clerkUserId: null };
  }
}

/**
 * The actor's agency, or null when the request carries no usable scope.
 *
 * An active Clerk Organization is the canonical mapping (D-003: one agency per organisation). A
 * session without one falls back to the person's memberships, and an actor who belongs to two
 * agencies with neither selected is ambiguous in exactly the same way the database is — so it
 * refuses there too rather than picking the first membership.
 */
async function actorAgencyId(db: Db, deps: BrandResolverDeps): Promise<string | null> {
  const scope = await (deps.actorScope ?? clerkActorScope)();
  if (scope.clerkOrgId === null && scope.clerkUserId === null) {
    return null;
  }

  const agencyRows = (await db.select().from(agencies)).filter(isLive);
  if (scope.clerkOrgId !== null) {
    const match = agencyRows.find((row) => row.clerkOrgId === scope.clerkOrgId);
    if (match !== undefined) {
      return match.id;
    }
  }
  if (scope.clerkUserId === null) {
    return null;
  }

  const userRows = (await db.select().from(users)).filter(isLive);
  const user = userRows.find((row) => row.clerkUserId === scope.clerkUserId);
  if (user === undefined) {
    return null;
  }
  const membershipRows = (await db.select().from(memberships)).filter(isLive);
  const ids = [
    ...new Set(membershipRows.filter((row) => row.userId === user.id).map((row) => row.agencyId)),
  ];
  if (ids.length > 1) {
    throw new AmbiguousBrandError(ids);
  }
  return ids[0] ?? null;
}

/**
 * THE agency in scope, and the ONE way any module gets one: it is the ACTOR'S agency, resolved from
 * the session, or nothing at all. There is deliberately no "sole agency" fallback.
 *
 * A fallback to "the only agency there is" would answer a request that carries no usable actor
 * scope with a tenant's data anyway — which on the public `/client` tree means an unauthenticated
 * visitor is served the agency's client-approved briefs, and on `/app` (if a swallowed Clerk error
 * ever leaves the scope null behind `auth.protect()`) means the same. Returning `null` instead
 * resolves to no brand and an empty workspace: deny rather than guess, the safe direction for a
 * multi-tenant read (CLAUDE.md non-negotiables 4 and 10). A signed-in user whose organisation is
 * not yet linked to an agency therefore sees an empty workspace, not another tenant's — the fix for
 * that is to link the organisation (onboarding / `ensureAgencyUser`), never to widen this resolver.
 *
 * `actorAgencyId` still throws `AmbiguousBrandError` when an actor genuinely belongs to two
 * agencies and has selected neither; that is a real ambiguity in the actor's own scope, not a guess
 * across tenants. Every agency-scoped read goes through this, exactly as every brand-scoped read
 * goes through `resolveLiveBrandId`. Two resolvers, both here, neither copied.
 */
export async function resolveLiveAgencyId(
  db: Db,
  deps: BrandResolverDeps = {},
): Promise<string | null> {
  return agencyIdFor(db, deps);
}

/**
 * Resolution, once per request. Every loader on a page used to resolve the actor's agency and brand
 * for itself — five times on a full Overview load, two sequential whole-table reads each — although
 * nothing about the answer changes inside one request. These memos key on the request's `db`
 * handle, which `requestConnection` makes one object per request, so the first loader to ask does
 * the reads and the rest share its promise (a rejection, e.g. `AmbiguousBrandError`, is shared too).
 *
 * The memo is taken ONLY when no seam is injected. A test that hands in `actorScope` or
 * `activeBrandId` always gets a fresh, uncached resolution, so every tenancy test exercises the real
 * resolver; and React `cache` does not memoize outside a server render (Vitest, Server Actions), so
 * there it is a plain call either way. Nothing is shared across requests: a different request is a
 * different `db` and a different cache.
 */
const requestAgencyId = cache((db: Db) => actorAgencyId(db, {}));

function agencyIdFor(db: Db, deps: BrandResolverDeps): Promise<string | null> {
  return deps.actorScope === undefined ? requestAgencyId(db) : actorAgencyId(db, deps);
}

/** The agency in scope, its selectable brands, and the one the request is scoped to. */
interface ResolvedScope {
  readonly agencyId: string | null;
  readonly options: readonly BrandRowLike[];
  readonly active: BrandRowLike | null;
}

async function computeScope(db: Db, deps: BrandResolverDeps): Promise<ResolvedScope> {
  const agencyId = await agencyIdFor(db, deps);
  if (agencyId === null) {
    return { agencyId: null, options: [], active: null };
  }
  const options = agencyBrands(await db.select().from(brands), agencyId);
  const requestedId = await (deps.activeBrandId ?? readActiveBrandId)();
  return { agencyId, options, active: pickActiveBrand(options, requestedId) };
}

const requestScope = cache((db: Db) => computeScope(db, {}));

function scopeFor(db: Db, deps: BrandResolverDeps): Promise<ResolvedScope> {
  return deps.actorScope === undefined && deps.activeBrandId === undefined
    ? requestScope(db)
    : computeScope(db, deps);
}

/** A brand row, as much of it as the resolver reads. */
interface BrandRowLike {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly isTemplate: boolean;
  readonly agencyId: string;
  readonly deletedAt: Date | null;
}

function toBrandSummary(row: BrandRowLike): BrandSummary {
  return { id: row.id, name: row.name, status: row.status };
}

/**
 * Every live, non-template brand of one agency, in the query's order. The switcher's options and
 * the single working brand are both drawn from THIS list, so "which brands exist for me" has one
 * definition and the chooser can never offer a brand a read would then refuse.
 */
function agencyBrands(rows: readonly BrandRowLike[], agencyId: string): BrandRowLike[] {
  return rows.filter((row) => isLive(row) && !row.isTemplate && row.agencyId === agencyId);
}

/**
 * The brand a request is scoped to, chosen from the brands it is ALLOWED to see. This is the
 * entitlement gate, and it is a pure function so the gate itself is unit-tested without a database:
 * the requested id is honoured only when it names one of `options`, and any other value — a stale
 * cookie, a forged one, or one pointing at another agency's brand (which is simply not in
 * `options`) — falls through to the agency's first brand, exactly the pre-switcher behaviour.
 */
export function pickActiveBrand(
  options: readonly BrandRowLike[],
  requestedId: string | null,
): BrandRowLike | null {
  if (requestedId !== null) {
    const requested = options.find((brand) => brand.id === requestedId);
    if (requested !== undefined) {
      return requested;
    }
  }
  return options[0] ?? null;
}

/**
 * THE working brand: the one the switcher last selected if it is still in scope, otherwise the first
 * live client workspace OF THE AGENCY IN SCOPE, never the parent template. The agency comes from the
 * actor when there is one, and otherwise from the database only while it can answer without guessing;
 * `AmbiguousBrandError` is thrown rather than returning a brand the actor may not belong to.
 *
 * `brands` is read and filtered in memory rather than through a `where` clause because `@tas/web`
 * does not depend on `drizzle-orm` directly; the predicate belongs in `@tas/db` next to
 * `withBrand`, which is a `packages/db` ticket. The choice this function makes is the fix; pushing
 * it into SQL is an optimisation on top of it.
 */
export async function resolveLiveBrand(
  db: Db,
  deps: BrandResolverDeps = {},
): Promise<BrandSummary | null> {
  const { active } = await scopeFor(db, deps);
  return active === null ? null : toBrandSummary(active);
}

/** Every brand of the agency in scope, and the active one, for the switcher. */
export interface BrandScope {
  /** The brand the workspace is scoped to right now, or null when the agency has none. */
  readonly active: BrandSummary | null;
  /** Every brand the actor may switch to, in query order. A superset containing `active`. */
  readonly options: readonly BrandSummary[];
}

/**
 * What the top bar needs to draw the switcher: the active brand AND the brands it can switch to.
 * Same fixture/live split as `currentBrand`, and the active brand is chosen by the same
 * `pickActiveBrand` gate, so the option marked active is always the one a scoped read will use.
 */
export async function loadBrandScope(deps: DataSourceDeps = {}): Promise<BrandScope> {
  if (inFixtureMode(deps)) {
    return { active: DEMO_BRAND, options: [DEMO_BRAND] };
  }
  return withDb(deps, async (db) => {
    const { active, options } = await scopeFor(db, deps);
    return {
      active: active === null ? null : toBrandSummary(active),
      options: options.map(toBrandSummary),
    };
  });
}

/**
 * Whether `brandId` is a brand the actor in scope may select — the entitlement check the
 * `selectBrandAction` runs before it trusts a brand id from the client. Lives here, next to the
 * resolver, so "a brand the actor owns" has ONE definition and the write path cannot drift from the
 * read path. Never trusts the id: it is checked against the agency the SESSION resolves to.
 */
export async function isBrandSelectable(
  db: Db,
  brandId: string,
  deps: BrandResolverDeps = {},
): Promise<boolean> {
  const { options } = await scopeFor(db, deps);
  return options.some((brand) => brand.id === brandId);
}

/** `resolveLiveBrand`, for the callers that only ever pass the id to a scoped `@tas/db` function. */
export async function resolveLiveBrandId(
  db: Db,
  deps: BrandResolverDeps = {},
): Promise<string | null> {
  return (await resolveLiveBrand(db, deps))?.id ?? null;
}

/**
 * Heading and card counts for the shell and the Overview page, in one round trip in live mode.
 * `themes` is the GLOBAL library (non-negotiable 3), so it is counted across brands, not scoped.
 */
export async function loadOverview(deps: DataSourceDeps = {}): Promise<Overview> {
  if (inFixtureMode(deps)) {
    return {
      brand: DEMO_BRAND,
      counts: {
        personas: demoPersonas.length,
        angles: demoAngles.length,
        themes: demoThemes.length,
        concepts: demoConcepts.length,
      },
    };
  }

  return withDb(deps, async (db) => {
    const brand = await resolveLiveBrand(db, deps);
    if (brand === null) {
      return { brand, counts: EMPTY_COUNTS };
    }
    const scoped = (rows: { brandId: string | null; deletedAt: Date | null }[]) =>
      rows.filter((row) => isLive(row) && row.brandId === brand.id).length;

    const [personaRows, angleRows, themeRows, conceptRows] = await Promise.all([
      listPersonas(db, brand.id),
      db.select().from(angles),
      db.select().from(themes),
      db.select().from(concepts),
    ]);

    return {
      brand,
      counts: {
        personas: personaRows.length,
        angles: scoped(angleRows),
        themes: themeRows.filter(isLive).length,
        concepts: scoped(conceptRows),
      },
    };
  });
}

/**
 * The role the Overview draws its dashboard for (Sprint 12): the current user's role on the active
 * brand. In fixture/demo mode there is no identity to ask, so it is `admin` — the all-cards view,
 * unchanged from before role detection. In live mode the brand and the Clerk user are resolved from
 * the session, then `getActiveBrandRole` decides; anyone without a row here also falls back to
 * `admin`, so no one gets a blank Overview.
 */
export async function loadActiveRole(deps: DataSourceDeps = {}): Promise<DashboardRole> {
  if (inFixtureMode(deps)) {
    return 'admin';
  }
  return withDb(deps, async (db) => {
    const [brandId, scope] = await Promise.all([
      resolveLiveBrandId(db, deps),
      (deps.actorScope ?? clerkActorScope)(),
    ]);
    if (brandId === null || scope.clerkUserId === null) {
      return 'admin';
    }
    return (await getActiveBrandRole(db, brandId, scope.clerkUserId)) ?? 'admin';
  });
}

/** Just the brand, for the shell's top bar. */
export async function currentBrand(deps: DataSourceDeps = {}): Promise<BrandSummary | null> {
  if (inFixtureMode(deps)) {
    return DEMO_BRAND;
  }
  return withDb(deps, (db) => resolveLiveBrand(db, deps));
}

/**
 * Every persona of the working brand, in `updated_at` order, already carrying `productName`. The
 * Personas page calls this and nothing else; it never opens a connection of its own.
 */
export async function listPersonaRows(deps: DataSourceDeps = {}): Promise<PersonaListRow[]> {
  if (inFixtureMode(deps)) {
    return demoPersonas;
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? [] : listPersonas(db, brandId);
  });
}
