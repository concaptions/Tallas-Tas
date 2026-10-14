import { loadBriefStats, type BriefStats, type Db } from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { requestConnection } from './request-db';

/**
 * The Creative Sheet stats tab's data source (Ticket 12). In demo mode nothing is read: fixtures
 * carry no activity-log rows and no submissions, so every panel renders its empty state. In live
 * mode one Neon connection answers the whole page's queries through `loadBriefStats`.
 */
export interface BriefStatsSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly now?: () => Date;
}

const EMPTY_STATS: BriefStats = {
  kpi: {
    inFlight: 0,
    approvedThisWeek: 0,
    avgRevisionHours: null,
    qaPassRatePct: null,
  },
  perEditor: [],
  weeklyOutput: [
    { day: 'Mon', count: 0 },
    { day: 'Tue', count: 0 },
    { day: 'Wed', count: 0 },
    { day: 'Thu', count: 0 },
    { day: 'Fri', count: 0 },
    { day: 'Sat', count: 0 },
    { day: 'Sun', count: 0 },
  ],
  turnaround: [],
};

async function withDb<T>(deps: BriefStatsSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = requestConnection(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

export async function loadBriefStatsForWorkspace(
  deps: BriefStatsSourceDeps = {},
): Promise<BriefStats> {
  if (inDemoMode(deps)) {
    return EMPTY_STATS;
  }
  const now = (deps.now ?? (() => new Date()))();
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) return EMPTY_STATS;
    return loadBriefStats(db, brandId, now);
  });
}
