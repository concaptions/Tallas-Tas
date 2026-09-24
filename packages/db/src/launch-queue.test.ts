import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { listLaunchQueue, transitionBriefLaunch } from './briefs';
import { agencies, brands, creativeBriefs } from './schema';
import { testDb, type PgliteDb } from './testing';

/**
 * The launch queue's two reads and its one write, against real Postgres (PGlite). The status keys
 * are passed in exactly as `@tas/domain`'s launch-queue constants hand them over.
 */
const FILTER_BASE = { readyStatus: 'approved', launchedStatuses: ['launched', 'paused'] };
const NOW = new Date('2026-09-24T12:00:00Z');
const SINCE = new Date('2026-09-17T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

async function twoBrands(db: PgliteDb) {
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (agency === undefined) throw new Error('agency');
  const inserted = await db
    .insert(brands)
    .values([
      { agencyId: agency.id, name: 'Niagara', slug: 'niagara' },
      { agencyId: agency.id, name: 'Gratsi', slug: 'gratsi' },
    ])
    .returning();
  const [mine, other] = inserted;
  if (mine === undefined || other === undefined) throw new Error('brands');
  return { mine: mine.id, other: other.id };
}

interface BriefSeed {
  name: string;
  clientStatus: string;
  internalStatus?: string;
  launchedAt?: Date | null;
  launchPriority?: number | null;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

async function brief(db: PgliteDb, brandId: string, seed: BriefSeed): Promise<string> {
  const [row] = await db
    .insert(creativeBriefs)
    .values({
      brandId,
      name: seed.name,
      clientStatus: seed.clientStatus,
      internalStatus: seed.internalStatus ?? 'approved',
      launchedAt: seed.launchedAt ?? null,
      launchPriority: seed.launchPriority ?? null,
      updatedAt: seed.updatedAt ?? NOW,
      deletedAt: seed.deletedAt ?? null,
    })
    .returning();
  if (row === undefined) throw new Error('brief');
  return row.id;
}

const names = (rows: readonly { name: string }[]) => rows.map((row) => row.name);

describe('listLaunchQueue', () => {
  it('Ready is client-approved and not yet launched, and nothing else', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    await brief(db, mine, { name: 'READY', clientStatus: 'approved' });
    await brief(db, mine, { name: 'PENDING', clientStatus: 'pending_for_approval' });
    await brief(db, mine, { name: 'LIVE', clientStatus: 'launched', launchedAt: daysAgo(1) });
    await brief(db, mine, {
      name: 'APPROVED-BUT-STAMPED',
      clientStatus: 'approved',
      launchedAt: daysAgo(1),
    });
    await brief(db, mine, { name: 'DELETED', clientStatus: 'approved', deletedAt: daysAgo(1) });

    const { ready } = await listLaunchQueue(db, mine, { ...FILTER_BASE, launchedSince: SINCE });

    expect(names(ready)).toEqual(['READY']);
  });

  it('sorts Ready by priority ascending with unset priorities last, then newest edit first', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    await brief(db, mine, {
      name: 'NO-PRIORITY-NEWER',
      clientStatus: 'approved',
      updatedAt: daysAgo(0),
    });
    await brief(db, mine, {
      name: 'NO-PRIORITY-OLDER',
      clientStatus: 'approved',
      updatedAt: daysAgo(3),
    });
    await brief(db, mine, { name: 'PRIORITY-2', clientStatus: 'approved', launchPriority: 2 });
    await brief(db, mine, { name: 'PRIORITY-1', clientStatus: 'approved', launchPriority: 1 });

    const { ready } = await listLaunchQueue(db, mine, { ...FILTER_BASE, launchedSince: SINCE });

    expect(names(ready)).toEqual([
      'PRIORITY-1',
      'PRIORITY-2',
      'NO-PRIORITY-NEWER',
      'NO-PRIORITY-OLDER',
    ]);
  });

  it('Recently Launched is live or paused within the window, most recent launch first', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    await brief(db, mine, { name: 'LIVE-1D', clientStatus: 'launched', launchedAt: daysAgo(1) });
    await brief(db, mine, { name: 'PAUSED-3D', clientStatus: 'paused', launchedAt: daysAgo(3) });
    await brief(db, mine, { name: 'LIVE-6D', clientStatus: 'launched', launchedAt: daysAgo(6) });
    await brief(db, mine, { name: 'LIVE-10D', clientStatus: 'launched', launchedAt: daysAgo(10) });
    await brief(db, mine, { name: 'READY', clientStatus: 'approved' });

    const { recent } = await listLaunchQueue(db, mine, { ...FILTER_BASE, launchedSince: SINCE });

    expect(names(recent)).toEqual(['LIVE-1D', 'PAUSED-3D', 'LIVE-6D']);
  });

  it("never returns another brand's brief in either list", async () => {
    const db = await testDb();
    const { mine, other } = await twoBrands(db);
    await brief(db, other, { name: 'OTHER-READY', clientStatus: 'approved' });
    await brief(db, other, {
      name: 'OTHER-LIVE',
      clientStatus: 'launched',
      launchedAt: daysAgo(1),
    });

    const queue = await listLaunchQueue(db, mine, { ...FILTER_BASE, launchedSince: SINCE });

    expect(queue.ready).toEqual([]);
    expect(queue.recent).toEqual([]);
  });
});

describe('transitionBriefLaunch', () => {
  const launch = {
    fromClientStatus: 'approved',
    fromInternalStatus: 'approved',
    clientStatus: 'launched',
    internalStatus: 'launched',
    launchedAt: NOW,
  };

  it('launches on both tracks and stamps launched_at', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    const id = await brief(db, mine, { name: 'READY', clientStatus: 'approved' });

    const saved = await transitionBriefLaunch(db, mine, id, launch, 'user_buyer');

    expect(saved?.clientStatus).toBe('launched');
    expect(saved?.internalStatus).toBe('launched');
    expect(saved?.launchedAt?.toISOString()).toBe(NOW.toISOString());
    expect(saved?.updatedBy).toBe('user_buyer');
  });

  it('applies at most once: a second identical move finds nothing in the from-status', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    const id = await brief(db, mine, { name: 'READY', clientStatus: 'approved' });

    await transitionBriefLaunch(db, mine, id, launch, 'user_buyer');
    const again = await transitionBriefLaunch(db, mine, id, launch, 'user_buyer');

    expect(again).toBeNull();
  });

  it('refuses a move whose from-status no longer holds, and leaves the row alone', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    const id = await brief(db, mine, { name: 'PENDING', clientStatus: 'pending_for_approval' });

    expect(await transitionBriefLaunch(db, mine, id, launch, 'user_buyer')).toBeNull();
    const [row] = await db.select().from(creativeBriefs).where(eq(creativeBriefs.id, id));
    expect(row?.clientStatus).toBe('pending_for_approval');
    expect(row?.launchedAt).toBeNull();
  });

  it("cannot move another brand's brief, even with the right statuses", async () => {
    const db = await testDb();
    const { mine, other } = await twoBrands(db);
    const theirs = await brief(db, other, { name: 'OTHER-READY', clientStatus: 'approved' });

    expect(await transitionBriefLaunch(db, mine, theirs, launch, 'user_buyer')).toBeNull();
    const [row] = await db.select().from(creativeBriefs).where(eq(creativeBriefs.id, theirs));
    expect(row?.clientStatus).toBe('approved');
  });

  it('pauses without touching launched_at, keeping the moment the ad first went live', async () => {
    const db = await testDb();
    const { mine } = await twoBrands(db);
    const firstLaunch = daysAgo(2);
    const id = await brief(db, mine, {
      name: 'LIVE',
      clientStatus: 'launched',
      internalStatus: 'launched',
      launchedAt: firstLaunch,
    });

    const saved = await transitionBriefLaunch(
      db,
      mine,
      id,
      {
        fromClientStatus: 'launched',
        fromInternalStatus: 'launched',
        clientStatus: 'paused',
        internalStatus: 'launched',
      },
      'user_buyer',
    );

    expect(saved?.clientStatus).toBe('paused');
    expect(saved?.launchedAt?.toISOString()).toBe(firstLaunch.toISOString());
  });
});
