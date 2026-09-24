import { agencies, brands, memberships, users, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmbiguousBrandError,
  currentBrand,
  isBrandSelectable,
  listPersonaRows,
  loadBrandScope,
  loadOverview,
  pickActiveBrand,
  resolveLiveAgencyId,
  resolveLiveBrand,
  resolveLiveBrandId,
  type ActorScope,
} from './data-source';

/**
 * Two guarantees live here, and neither was asserted anywhere before.
 *
 * 1. THE DEMO GUARANTEE. With no Clerk key and a `DATABASE_URL` set, every entry point answers from
 *    the fixtures and the connection factory is never called. The factory is injected for exactly
 *    that reason — "no client was constructed" is not observable otherwise. Every other
 *    `*-source.ts` module has had this test; `data-source.ts` is the module the demo-mode rule is
 *    written about, and it had neither the seam nor the test.
 *
 * 2. THE TENANCY GUARANTEE. `brands.agency_id` is NOT NULL, so "the first live non-template brand"
 *    only means something while one agency exists. `resolveLiveBrand` therefore picks the brand of
 *    the agency IN SCOPE, and refuses — loudly, with `AmbiguousBrandError` — rather than handing a
 *    correctly-scoped `withBrand(brandId)` call a brand from the wrong tenant.
 */
const connect = vi.fn<(databaseUrl: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  connect.mockClear();
  vi.unstubAllEnvs();
});

interface FakeRows {
  readonly agencies?: readonly unknown[];
  readonly brands?: readonly unknown[];
  readonly users?: readonly unknown[];
  readonly memberships?: readonly unknown[];
}

/** A handle that answers `select().from(table)` from fixed rows, per table. No SQL, no Postgres. */
function fakeDb(rows: FakeRows): Db {
  const byTable = new Map<unknown, readonly unknown[]>([
    [agencies, rows.agencies ?? []],
    [brands, rows.brands ?? []],
    [users, rows.users ?? []],
    [memberships, rows.memberships ?? []],
  ]);
  return {
    select: () => ({
      from: (table: unknown) => Promise.resolve([...(byTable.get(table) ?? [])]),
    }),
  } as unknown as Db;
}

const agencyA = { id: 'agency-a', clerkOrgId: 'org-a', deletedAt: null };
const agencyB = { id: 'agency-b', clerkOrgId: 'org-b', deletedAt: null };

function brandRow(id: string, agencyId: string, extra: { isTemplate?: boolean } = {}) {
  return {
    id,
    name: `Brand ${id}`,
    status: 'active',
    agencyId,
    isTemplate: extra.isTemplate ?? false,
    deletedAt: null,
  };
}

/** Agency A's brand sorts FIRST in every fixture below: the old resolver would always have won it. */
const brandOfA = brandRow('brand-a', agencyA.id);
const brandOfB = brandRow('brand-b', agencyB.id);
const templateOfA = brandRow('template-a', agencyA.id, { isTemplate: true });

const noActor = (): Promise<ActorScope> => Promise.resolve({ clerkOrgId: null, clerkUserId: null });
const asOrg = (clerkOrgId: string) => (): Promise<ActorScope> =>
  Promise.resolve({ clerkOrgId, clerkUserId: null });
const asUser = (clerkUserId: string) => (): Promise<ActorScope> =>
  Promise.resolve({ clerkOrgId: null, clerkUserId });

describe('resolveLiveBrand with one agency', () => {
  it("returns that agency's first live client workspace, never the parent template", async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [templateOfA, brandOfA] });

    await expect(resolveLiveBrand(db, { actorScope: noActor })).resolves.toEqual({
      id: 'brand-a',
      name: 'Brand brand-a',
      status: 'active',
    });
  });

  it('answers with the id alone for the callers that only scope a query with it', async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA] });

    await expect(resolveLiveBrandId(db, { actorScope: noActor })).resolves.toBe('brand-a');
  });

  it('is not ambiguous when the second agency is soft deleted', async () => {
    const db = fakeDb({
      agencies: [{ ...agencyB, deletedAt: new Date('2026-09-01T00:00:00Z') }, agencyA],
      brands: [brandOfB, brandOfA],
    });

    await expect(resolveLiveBrandId(db, { actorScope: noActor })).resolves.toBe('brand-a');
  });

  it('returns null, rather than a brand, when the one agency has no workspace yet', async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [templateOfA] });

    await expect(resolveLiveBrand(db, { actorScope: noActor })).resolves.toBeNull();
  });

  it('returns null when the database holds no agency at all', async () => {
    await expect(resolveLiveBrand(fakeDb({}), { actorScope: noActor })).resolves.toBeNull();
  });
});

describe('resolveLiveBrand with two agencies and no actor scope', () => {
  it('throws AmbiguousBrandError instead of returning whichever brand sorts first', async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA, brandOfB] });

    const error = await resolveLiveBrand(db, { actorScope: noActor }).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(AmbiguousBrandError);
    expect((error as AmbiguousBrandError).agencyIds).toEqual(['agency-a', 'agency-b']);
    expect((error as Error).message).toMatch(/Refusing to guess/u);
  });

  it('refuses for the id-only caller too, rather than answering null and looking empty', async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA, brandOfB] });

    await expect(resolveLiveBrandId(db, { actorScope: noActor })).rejects.toBeInstanceOf(
      AmbiguousBrandError,
    );
  });

  it('refuses when the actor carries a scope that matches no agency', async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA, brandOfB] });

    await expect(
      resolveLiveBrandId(db, { actorScope: asOrg('org-elsewhere') }),
    ).rejects.toBeInstanceOf(AmbiguousBrandError);
  });
});

describe('resolveLiveBrand with an actor scope', () => {
  it("never returns another agency's brand, even when that brand sorts first", async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA, brandOfB] });

    const brand = await resolveLiveBrand(db, { actorScope: asOrg('org-b') });

    expect(brand?.id).toBe('brand-b');
    expect(brand?.id).not.toBe('brand-a');
  });

  it('resolves the agency from a membership when no organisation is active', async () => {
    const db = fakeDb({
      agencies: [agencyA, agencyB],
      brands: [brandOfA, brandOfB],
      users: [{ id: 'user-1', clerkUserId: 'clerk-1', deletedAt: null }],
      memberships: [{ userId: 'user-1', agencyId: 'agency-b', deletedAt: null }],
    });

    await expect(resolveLiveBrandId(db, { actorScope: asUser('clerk-1') })).resolves.toBe(
      'brand-b',
    );
  });

  it('refuses when the actor belongs to two agencies and has selected neither', async () => {
    const db = fakeDb({
      agencies: [agencyA, agencyB],
      brands: [brandOfA, brandOfB],
      users: [{ id: 'user-1', clerkUserId: 'clerk-1', deletedAt: null }],
      memberships: [
        { userId: 'user-1', agencyId: 'agency-a', deletedAt: null },
        { userId: 'user-1', agencyId: 'agency-b', deletedAt: null },
      ],
    });

    await expect(resolveLiveBrandId(db, { actorScope: asUser('clerk-1') })).rejects.toBeInstanceOf(
      AmbiguousBrandError,
    );
  });

  it("returns null when the actor's own agency has no workspace, rather than borrowing one", async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA] });

    await expect(resolveLiveBrand(db, { actorScope: asOrg('org-b') })).resolves.toBeNull();
  });
});

describe('data-source in demo mode', () => {
  it('serves the overview from the fixtures and constructs no client, with DATABASE_URL set', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const overview = await loadOverview({ connect });

    expect(overview.brand?.name).toBe('Niagara Sleep Solutions');
    expect(overview.counts.personas).toBeGreaterThan(0);
    expect(connect).not.toHaveBeenCalled();
  });

  it('serves the top bar brand and the persona rows without a connection either', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    await expect(currentBrand({ connect })).resolves.toMatchObject({ status: 'active' });
    const rows = await listPersonaRows({ connect });

    expect(rows.length).toBeGreaterThan(0);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('data-source in live mode', () => {
  it('opens a connection from DATABASE_URL and closes it even when the query throws', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = {
      select: () => {
        throw new Error('boom');
      },
    } as unknown as Db;
    const openings: string[] = [];

    await expect(
      currentBrand({
        demoMode: () => false,
        actorScope: noActor,
        connect: (url) => {
          openings.push(url);
          return { db, close };
        },
      }),
    ).rejects.toThrow('boom');

    expect(openings).toEqual(['postgres://user:pw@example.test/db']);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the pool when the resolver refuses a cross-tenant read', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = fakeDb({ agencies: [agencyA, agencyB], brands: [brandOfA, brandOfB] });

    await expect(
      currentBrand({ demoMode: () => false, actorScope: noActor, connect: () => ({ db, close }) }),
    ).rejects.toBeInstanceOf(AmbiguousBrandError);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reads no personas when the workspace has no brand yet', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const close = vi.fn(() => Promise.resolve());
    const db = fakeDb({});

    await expect(
      listPersonaRows({
        demoMode: () => false,
        actorScope: noActor,
        connect: () => ({ db, close }),
      }),
    ).resolves.toEqual([]);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

/**
 * The AGENCY resolver, which `team-source.ts` and `propagation-source.ts` now share instead of each
 * keeping a private `liveAgencyId` that took `rows.find(live)`. That copy could not refuse: with a
 * second tenant inserted before the org switcher exists it returned whichever agency sorted first,
 * and the Team table and the promotion queue were then read with another agency's id.
 */
describe('resolveLiveAgencyId · the one way an agency-scoped read gets its scope', () => {
  it('answers with the only agency there is', async () => {
    const db = fakeDb({ agencies: [agencyA] });

    await expect(resolveLiveAgencyId(db, { actorScope: noActor })).resolves.toBe('agency-a');
  });

  it('answers null when there is no agency yet, so the caller reads nothing at all', async () => {
    await expect(resolveLiveAgencyId(fakeDb({}), { actorScope: noActor })).resolves.toBeNull();
  });

  it('refuses to choose between two agencies rather than returning the first', async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB] });

    await expect(resolveLiveAgencyId(db, { actorScope: noActor })).rejects.toBeInstanceOf(
      AmbiguousBrandError,
    );
  });

  it('is not ambiguous when the second agency is soft deleted', async () => {
    const db = fakeDb({
      agencies: [{ ...agencyB, deletedAt: new Date('2026-09-01T00:00:00Z') }, agencyA],
    });

    await expect(resolveLiveAgencyId(db, { actorScope: noActor })).resolves.toBe('agency-a');
  });

  it("follows the actor's organisation, and never the first row, when two agencies exist", async () => {
    const db = fakeDb({ agencies: [agencyA, agencyB] });

    await expect(resolveLiveAgencyId(db, { actorScope: asOrg('org-b') })).resolves.toBe('agency-b');
  });

  it("follows the actor's membership when the session carries no organisation", async () => {
    const db = fakeDb({
      agencies: [agencyA, agencyB],
      users: [{ id: 'user-1', clerkUserId: 'clerk-1', deletedAt: null }],
      memberships: [{ userId: 'user-1', agencyId: 'agency-b', deletedAt: null }],
    });

    await expect(resolveLiveAgencyId(db, { actorScope: asUser('clerk-1') })).resolves.toBe(
      'agency-b',
    );
  });
});

/**
 * THE SWITCHER. A second brand under one agency is the case the whole switcher exists for, and the
 * case the report hit: it was stored correctly and still never appeared, because the resolver only
 * ever returned the first. These prove the three new pieces — the pure entitlement gate, the
 * resolver's use of it, and the option list — and, above all, that a chosen brand can never be one
 * from another tenant.
 */
const secondBrandOfA = brandRow('brand-a2', agencyA.id);
const requesting = (id: string | null) => (): Promise<string | null> => Promise.resolve(id);

describe('pickActiveBrand (the entitlement gate)', () => {
  it('honours the requested brand when it is one of the options', () => {
    const chosen = pickActiveBrand([brandOfA, secondBrandOfA], 'brand-a2');

    expect(chosen?.id).toBe('brand-a2');
  });

  it('falls back to the first option when the request names no option — a stale or forged cookie', () => {
    const chosen = pickActiveBrand([brandOfA, secondBrandOfA], 'brand-does-not-exist');

    expect(chosen?.id).toBe('brand-a');
  });

  it('falls back to the first option, never another tenant, when the request is another agency’s brand', () => {
    // `brandOfB` belongs to agency B, so it is not in agency A's options and must be ignored.
    const chosen = pickActiveBrand([brandOfA, secondBrandOfA], brandOfB.id);

    expect(chosen?.id).toBe('brand-a');
  });

  it('is the first option when nothing is requested, exactly the pre-switcher behaviour', () => {
    expect(pickActiveBrand([brandOfA, secondBrandOfA], null)?.id).toBe('brand-a');
  });

  it('is null when there are no options at all', () => {
    expect(pickActiveBrand([], 'anything')).toBeNull();
    expect(pickActiveBrand([], null)).toBeNull();
  });
});

describe('resolveLiveBrand honouring the active-brand cookie', () => {
  it('returns the chosen brand of the agency in scope, not merely the first', async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA, secondBrandOfA] });

    await expect(
      resolveLiveBrand(db, { actorScope: asOrg('org-a'), activeBrandId: requesting('brand-a2') }),
    ).resolves.toEqual({ id: 'brand-a2', name: 'Brand brand-a2', status: 'active' });
  });

  it('ignores a cookie that points at another agency’s brand and stays on its own first brand', async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA, secondBrandOfA] });

    await expect(
      resolveLiveBrand(db, { actorScope: asOrg('org-a'), activeBrandId: requesting('brand-b') }),
    ).resolves.toMatchObject({ id: 'brand-a' });
  });
});

describe('loadBrandScope', () => {
  it('lists every live non-template brand of the agency, and marks the chosen one active', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
    const db = fakeDb({ agencies: [agencyA], brands: [templateOfA, brandOfA, secondBrandOfA] });

    const scope = await loadBrandScope({
      demoMode: () => false,
      actorScope: asOrg('org-a'),
      activeBrandId: requesting('brand-a2'),
      connect: () => ({ db, close: () => Promise.resolve() }),
    });

    expect(scope.active?.id).toBe('brand-a2');
    expect(scope.options.map((brand) => brand.id)).toEqual(['brand-a', 'brand-a2']);
  });

  it('serves a single fixture brand in demo mode without a connection', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const scope = await loadBrandScope({ connect });

    expect(scope.options).toHaveLength(1);
    expect(scope.active?.name).toBe('Niagara Sleep Solutions');
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('isBrandSelectable (the write-path entitlement check)', () => {
  it('accepts a live brand of the actor’s own agency', async () => {
    const db = fakeDb({ agencies: [agencyA], brands: [brandOfA, secondBrandOfA] });

    await expect(isBrandSelectable(db, 'brand-a2', { actorScope: asOrg('org-a') })).resolves.toBe(
      true,
    );
  });

  it('rejects another agency’s brand, a template, and an unknown id', async () => {
    const db = fakeDb({
      agencies: [agencyA],
      brands: [brandOfA, templateOfA, brandOfB],
    });
    const deps = { actorScope: asOrg('org-a') };

    await expect(isBrandSelectable(db, 'brand-b', deps)).resolves.toBe(false);
    await expect(isBrandSelectable(db, 'template-a', deps)).resolves.toBe(false);
    await expect(isBrandSelectable(db, 'nope', deps)).resolves.toBe(false);
  });
});
