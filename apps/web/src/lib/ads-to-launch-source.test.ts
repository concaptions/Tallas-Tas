import { agencies, brands, creativeBriefs, type Db } from '@tas/db';
import { testDb, type PgliteDb } from '@tas/db/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAdsToLaunch } from './ads-to-launch-source';
import type { ActorScope } from './data-source';

/**
 * The launch queue's loader, end to end: demo mode opens no connection; live mode resolves the
 * actor's brand from the SESSION (here the `actorScope` seam), then reads through the scoped
 * `listLaunchQueue` against real Postgres (PGlite) — so brand scoping, the seven-day window and the
 * sort order are proven on the path the page actually runs.
 */
const NOW = new Date('2026-09-24T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const neverConnect = vi.fn<(url: string) => never>(() => {
  throw new Error('the demo branch opened a database connection');
});

afterEach(() => {
  neverConnect.mockClear();
  vi.unstubAllEnvs();
});

async function workspace() {
  const db = await testDb();
  const [agency] = await db
    .insert(agencies)
    .values({ name: 'TAS', slug: 'tas', clerkOrgId: 'org_tas' })
    .returning();
  if (agency === undefined) throw new Error('agency');
  const [mine, other] = await db
    .insert(brands)
    .values([
      { agencyId: agency.id, name: 'Niagara', slug: 'niagara' },
      { agencyId: agency.id, name: 'Gratsi', slug: 'gratsi' },
    ])
    .returning();
  if (mine === undefined || other === undefined) throw new Error('brands');
  return { db, mine: mine.id, other: other.id };
}

async function brief(
  db: PgliteDb,
  brandId: string,
  name: string,
  values: { clientStatus: string; launchedAt?: Date; launchPriority?: number; updatedAt?: Date },
) {
  await db.insert(creativeBriefs).values({
    brandId,
    name,
    internalStatus: values.clientStatus === 'approved' ? 'approved' : 'launched',
    clientStatus: values.clientStatus,
    launchedAt: values.launchedAt ?? null,
    launchPriority: values.launchPriority ?? null,
    updatedAt: values.updatedAt ?? NOW,
  });
}

function live(db: PgliteDb, activeBrandId: string) {
  vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');
  const asTas = (): Promise<ActorScope> =>
    Promise.resolve({ clerkOrgId: 'org_tas', clerkUserId: null });
  return {
    demoMode: () => false,
    actorScope: asTas,
    activeBrandId: () => Promise.resolve(activeBrandId),
    now: () => NOW,
    connect: () => ({ db: db as unknown as Db, close: () => Promise.resolve() }),
  };
}

const names = (rows: readonly { name: string }[]) => rows.map((row) => row.name);

describe('loadAdsToLaunch in demo mode', () => {
  it('serves the client-approved fixture and constructs no client', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@example.test/db');

    const queue = await loadAdsToLaunch({
      demoMode: () => true,
      connect: neverConnect,
      now: () => NOW,
    });

    expect(queue.source).toBe('demo');
    expect(queue.ready.length).toBeGreaterThan(0);
    expect(queue.ready.every((row) => row.clientStatus === 'approved')).toBe(true);
    expect(neverConnect).not.toHaveBeenCalled();
  });
});

describe('loadAdsToLaunch in live mode', () => {
  it('Ready is the active brand’s client-approved, unlaunched creatives, priority first', async () => {
    const { db, mine, other } = await workspace();
    await brief(db, mine, 'UNPRIORITISED', { clientStatus: 'approved' });
    await brief(db, mine, 'P1', { clientStatus: 'approved', launchPriority: 1 });
    await brief(db, mine, 'PENDING', { clientStatus: 'pending_for_approval' });
    await brief(db, other, 'OTHER-BRAND', { clientStatus: 'approved', launchPriority: 1 });

    const queue = await loadAdsToLaunch(live(db, mine));

    expect(queue.source).toBe('database');
    expect(names(queue.ready)).toEqual(['P1', 'UNPRIORITISED']);
  });

  it('Recently Launched is live or paused within seven days, newest launch first, this brand only', async () => {
    const { db, mine, other } = await workspace();
    await brief(db, mine, 'LIVE-1D', { clientStatus: 'launched', launchedAt: daysAgo(1) });
    await brief(db, mine, 'PAUSED-2D', { clientStatus: 'paused', launchedAt: daysAgo(2) });
    await brief(db, mine, 'LIVE-9D', { clientStatus: 'launched', launchedAt: daysAgo(9) });
    await brief(db, other, 'OTHER-LIVE', { clientStatus: 'launched', launchedAt: daysAgo(1) });

    const queue = await loadAdsToLaunch(live(db, mine));

    expect(names(queue.recent)).toEqual(['LIVE-1D', 'PAUSED-2D']);
  });

  it('Paused lists every paused ad at any age — a 30-day-old one is here, not in Recently Launched', async () => {
    const { db, mine, other } = await workspace();
    await brief(db, mine, 'PAUSED-2D', { clientStatus: 'paused', launchedAt: daysAgo(2) });
    await brief(db, mine, 'PAUSED-30D', { clientStatus: 'paused', launchedAt: daysAgo(30) });
    await brief(db, mine, 'LIVE-1D', { clientStatus: 'launched', launchedAt: daysAgo(1) });
    await brief(db, other, 'OTHER-PAUSED', { clientStatus: 'paused', launchedAt: daysAgo(1) });

    const queue = await loadAdsToLaunch(live(db, mine));

    expect(names(queue.paused)).toEqual(['PAUSED-2D', 'PAUSED-30D']);
    expect(names(queue.recent)).not.toContain('PAUSED-30D');
  });

  it('switching the active brand switches the queue, never mixing the two', async () => {
    const { db, mine, other } = await workspace();
    await brief(db, mine, 'MINE', { clientStatus: 'approved' });
    await brief(db, other, 'THEIRS', { clientStatus: 'approved' });

    expect(names((await loadAdsToLaunch(live(db, mine))).ready)).toEqual(['MINE']);
    expect(names((await loadAdsToLaunch(live(db, other))).ready)).toEqual(['THEIRS']);
  });
});
