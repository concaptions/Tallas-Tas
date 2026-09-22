import {
  createAutoDb,
  demoAiCharacters,
  getAiCharacterById,
  listAiCharacters,
  type AiCharacterListRow,
  type Db,
} from '@tas/db';
import { serverEnv } from '@tas/env';

import { resolveLiveBrandId, type BrandResolverDeps } from './data-source';
import { DEMO_MUTATION_REFUSED, isDemoMode } from './demo-mode';

export interface AiCharacterListResult {
  readonly rows: AiCharacterListRow[];
  readonly source: 'database' | 'demo';
}

export interface AiCharacterResult {
  readonly character: AiCharacterListRow | null;
  readonly source: 'database' | 'demo';
}

interface DbConnection {
  readonly db: Db;
  readonly close: () => Promise<void>;
}

export interface AiCharacterSourceDeps extends BrandResolverDeps {
  readonly demoMode?: () => boolean;
  readonly connect?: (databaseUrl: string) => DbConnection;
}

function neonConnection(databaseUrl: string): DbConnection {
  const db = createAutoDb(databaseUrl);
  return { db, close: () => db.$client.end() };
}

async function withDb<T>(deps: AiCharacterSourceDeps, query: (db: Db) => Promise<T>): Promise<T> {
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

function inDemoMode(deps: AiCharacterSourceDeps): boolean {
  if ((deps.demoMode ?? isDemoMode)()) return true;
  return serverEnv().DATABASE_URL === undefined;
}

export async function loadAiCharacters(
  deps: AiCharacterSourceDeps = {},
): Promise<AiCharacterListResult> {
  if (inDemoMode(deps)) return { rows: demoAiCharacters, source: 'demo' };
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const rows = brandId === null ? [] : await listAiCharacters(db, brandId);
    return { rows, source: 'database' };
  });
}

export async function loadAiCharacter(
  id: string,
  deps: AiCharacterSourceDeps = {},
): Promise<AiCharacterResult> {
  if (inDemoMode(deps)) {
    return { character: demoAiCharacters.find((r) => r.id === id) ?? null, source: 'demo' };
  }
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    const character = brandId === null ? null : await getAiCharacterById(db, brandId, id);
    return { character, source: 'database' };
  });
}

export async function withBrandScope<T>(
  run: (db: Db, brandId: string) => Promise<T>,
  deps: AiCharacterSourceDeps = {},
): Promise<T | null> {
  if (inDemoMode(deps)) throw new Error(DEMO_MUTATION_REFUSED);
  return withDb(deps, async (db) => {
    const brandId = await resolveLiveBrandId(db, deps);
    return brandId === null ? null : run(db, brandId);
  });
}
