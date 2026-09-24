import {
  demoCampaigns,
  getCampaignById,
  listCampaigns,
  type CampaignOffer,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';
import { requestConnection } from '@/lib/request-db';

export type CampaignSourceKind = 'database' | 'demo';

export interface CampaignListResult {
  readonly rows: CampaignOffer[];
  readonly source: CampaignSourceKind;
}

export interface CampaignResult {
  readonly campaign: CampaignOffer | null;
  readonly source: CampaignSourceKind;
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface CampaignSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  return requestConnection(databaseUrl);
}

async function withDb<T>(deps: CampaignSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: CampaignSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) {
    return true;
  }
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCampaigns(deps: CampaignSourceDeps = {}): Promise<CampaignListResult> {
  if (inDemoMode(deps)) {
    return { rows: demoCampaigns, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCampaigns(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCampaign(
  id: string,
  deps: CampaignSourceDeps = {},
): Promise<CampaignResult> {
  if (inDemoMode(deps)) {
    return { campaign: demoCampaigns.find((row) => row.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const campaign = brandId === null ? null : await getCampaignById(db, brandId, id);
    return { campaign, source: 'database' };
  });
}

export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: CampaignSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) {
    throw new Error(DEMO_MUTATION_REFUSED);
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
