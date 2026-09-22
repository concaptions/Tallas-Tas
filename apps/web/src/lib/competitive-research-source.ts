import {
  createAutoDb,
  demoCompetitiveResearch,
  getCompetitiveResearchById,
  listCompetitiveResearch,
  type CompetitiveResearchListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

export interface CompetitiveResearchListResult {
  readonly rows: CompetitiveResearchListRow[];
  readonly source: 'database' | 'demo';
}

export interface CompetitiveResearchResult {
  readonly entry: CompetitiveResearchListRow | null;
  readonly source: 'database' | 'demo';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface CompetitiveResearchSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(
  deps: CompetitiveResearchSourceDeps,
  query: (db: Db) => Promise<T>,
): Promise<T> {
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

function inDemoMode(deps: CompetitiveResearchSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadCompetitiveResearch(
  deps: CompetitiveResearchSourceDeps = {},
): Promise<CompetitiveResearchListResult> {
  if (inDemoMode(deps)) return { rows: demoCompetitiveResearch, source: 'demo' };
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listCompetitiveResearch(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadCompetitiveResearchEntry(
  id: string,
  deps: CompetitiveResearchSourceDeps = {},
): Promise<CompetitiveResearchResult> {
  if (inDemoMode(deps)) {
    return { entry: demoCompetitiveResearch.find((r) => r.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const entry = brandId === null ? null : await getCompetitiveResearchById(db, brandId, id);
    return { entry, source: 'database' };
  });
}

export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: CompetitiveResearchSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) throw new Error(DEMO_MUTATION_REFUSED);
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
