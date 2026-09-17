import { agencies, brands, memberships, users, type Db } from '@tas/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AmbiguousBrandError,
  currentBrand,
  listPersonaRows,
  loadOverview,
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
