import { demoBriefs, listLaunchQueue, type Db } from '@tas/db';
import {
  LAUNCHED_CLIENT_STATUSES,
  LAUNCH_READY_CLIENT_STATUS,
  recentlyLaunchedSince,
} from '@tas/domain/state';
import { serverEnv } from '@tas/env';

import { toBriefRow, type BriefRow, type BriefSourceKind } from './briefs-source';
import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { isDemoMode } from './demo-mode';
import { requestConnection, type DbConnection } from './request-db';

/**
 * Where the Ads to Launch page gets its two lists (PRD §11, §13; ticket `ads-to-launch` Phase 2).
 *
 * READY TO LAUNCH: every creative the client has signed off (`LAUNCH_READY_CLIENT_STATUS`) that has
 * not been launched yet, the media buyer's priority first. RECENTLY LAUNCHED: every creative launched
 * — live or paused (`LAUNCHED_CLIENT_STATUSES`) — whose `launched_at` falls inside the last
 * `RECENTLY_LAUNCHED_DAYS`. Paused rows belong here because Resume is the only way back to live and
 * this is the page that draws it. The rules are the domain's; this module owns the demo/live split
 * and the connection, exactly like `briefs-source.ts`.
 *
 * DEMO MODE: the in-repo fixtures narrowed by the same rules, no client constructed. LIVE MODE: the
 * brand-scoped `listLaunchQueue` on the request's shared connection, after the actor's brand is
 * resolved from the session — never from the URL.
 */
export interface AdsToLaunchResult {
  readonly ready: BriefRow[];
  readonly recent: BriefRow[];
  readonly source: BriefSourceKind;
}

/** Seams, for tests only. Production calls `loadAdsToLaunch()` with no argument. */
export interface AdsToLaunchSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
  /** The clock the seven-day window is measured from. */
  readonly now?: () => Date;
}

function inDemoMode(deps: AdsToLaunchSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

async function withDb<T>(deps: AdsToLaunchSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('DATABASE_URL is not configured.');
  }
  const connection = (deps.connect ?? requestConnection)(databaseUrl);
  try {
    return await query(connection.db);
  } finally {
    await connection.close();
  }
}

export async function loadAdsToLaunch(
  deps: AdsToLaunchSourceDeps = {},
): Promise<AdsToLaunchResult> {
  const since = recentlyLaunchedSince((deps.now ?? (() => new Date()))());

  if (inDemoMode(deps)) {
    const rows = demoBriefs.map(toBriefRow);
    return {
      ready: rows.filter(
        (row) => row.clientStatus === LAUNCH_READY_CLIENT_STATUS && row.launchedAt === null,
      ),
      recent: rows.filter(
        (row) =>
          LAUNCHED_CLIENT_STATUSES.includes(row.clientStatus) &&
          row.launchedAt !== null &&
          row.launchedAt >= since,
      ),
      source: 'demo',
    };
  }

  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    if (brandId === null) {
      return { ready: [], recent: [], source: 'database' };
    }
    const queue = await listLaunchQueue(db, brandId, {
      readyStatus: LAUNCH_READY_CLIENT_STATUS,
      launchedStatuses: LAUNCHED_CLIENT_STATUSES,
      launchedSince: since,
    });
    return {
      ready: queue.ready.map(toBriefRow),
      recent: queue.recent.map(toBriefRow),
      source: 'database',
    };
  });
}
