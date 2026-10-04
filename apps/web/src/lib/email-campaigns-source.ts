import {
  demoEmailCampaigns,
  getEmailCampaignById,
  listEmailCampaigns,
  type Db,
  type EmailCampaignListRow,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { inDemoMode, resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED } from './demo-mode';
import { requestConnection } from '@/lib/request-db';
import { loadResolvedColumns, type ResolvedColumnsResult } from './resolved-columns-source';

/**
 * Where the Email Campaigns route gets its rows (Airtable "Email Campaigns Management", audit
 * §2.10). A copy of `products-source.ts`, function for function, because the demo-mode guarantee is
 * the same one and it must not drift between routes.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures
 * from `@tas/db`. No database client is constructed and `DATABASE_URL` is never read — the demo
 * branch returns BEFORE `serverEnv()` is reached.
 *
 * LIVE MODE (Clerk configured): a Neon connection opened per call and closed in a `finally`, the
 * actor's brand resolved by the ONE `resolveLiveBrandId` in `data-source.ts`, then the scoped
 * queries in `@tas/db`. No singleton.
 */
export type EmailCampaignSourceKind = 'database' | 'demo';

export interface EmailCampaignListResult {
  readonly rows: EmailCampaignListRow[];
  readonly source: EmailCampaignSourceKind;
}

export interface EmailCampaignResult {
  readonly emailCampaign: EmailCampaignListRow | null;
  readonly source: EmailCampaignSourceKind;
}

/** An open database handle and the way to close it again. */
export interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

/**
 * Seams, for tests only. Production calls every function with no argument: `demoMode` reads the
 * environment through `@tas/env` and `connect` opens Neon.
 */
export interface EmailCampaignSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

/** Opens a connection, runs `query`, and always closes the pool. Live mode only. */
async function withDb<T>(deps: EmailCampaignSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

const EMAIL_CAMPAIGNS_TABLE_KEY = 'email_campaigns';

/**
 * THE ordered, labelled, visible Email Campaigns columns of the working brand, through the ONE
 * loader every resolver-driven page shares (`lib/resolved-columns-source.ts`).
 */
export async function loadEmailCampaignColumns(
  deps: EmailCampaignSourceDeps = {},
): Promise<ResolvedColumnsResult> {
  return loadResolvedColumns(EMAIL_CAMPAIGNS_TABLE_KEY, {
    ...deps,
    demoMode: () => inDemoMode(deps),
    withDb: (query) => withDb(deps, query),
  });
}

/**
 * Every email campaign of the working brand, newest edit first, each already carrying its due
 * dates, assignee name and linked names. The fixtures are already in that order, so the page never
 * sorts.
 */
export async function loadEmailCampaigns(
  deps: EmailCampaignSourceDeps = {},
): Promise<EmailCampaignListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoEmailCampaigns, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listEmailCampaigns(db, brandId);
    return { rows, source: 'database' };
  });
}

/** One email campaign by id, or null. In demo mode the fixtures are searched; no database is touched. */
export async function loadEmailCampaign(
  id: string,
  deps: EmailCampaignSourceDeps = {},
): Promise<EmailCampaignResult> {
  if (inDemoMode(deps)) {
    return {
      emailCampaign: demoEmailCampaigns.find((row) => row.id === id) ?? null,
      source: 'demo',
    };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const emailCampaign = brandId === null ? null : await getEmailCampaignById(db, brandId, id);
    return { emailCampaign, source: 'database' };
  });
}

/**
 * The write path for the Server Actions: one connection, the actor's brand resolved once, then
 * `run`. Throws in demo mode — a mutation must never reach a database the demo visitor cannot own —
 * and returns null when the workspace has no brand yet. The actions refuse long before this.
 */
export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: EmailCampaignSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
