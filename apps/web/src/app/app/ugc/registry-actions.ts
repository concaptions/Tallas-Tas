'use server';

import { revalidatePath } from 'next/cache';
import {
  addRegistryCreatorToBrand,
  findRegistryCreatorByNormalizedIg,
  insertRegistryCreator,
  listRegistryCreatorBrandHistory,
  listRegistryCreators,
  type Db,
  type RegistryBrandHistoryRow,
  type RegistryCreatorListRow,
} from '@tas/db';
import { normalizeInstagramUsername } from '@tas/domain/creators';
import type { CreatorAgeBracket, CreatorPlatform } from '@tas/db/schema';

import { isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/ugc-source';
import { requestConnection } from '@/lib/request-db';
import { serverEnv } from '@tas/env';

export interface RegistryActionSuccess {
  readonly ok: true;
}

export interface RegistryActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type RegistryActionResult = RegistryActionSuccess | RegistryActionFailure;

async function withGlobalDb<T>(run: (db: Db) => Promise<T>): Promise<T> {
  const databaseUrl = serverEnv().DATABASE_URL;
  if (databaseUrl === undefined) throw new Error('DATABASE_URL is not configured.');
  const { db, close } = requestConnection(databaseUrl);
  try {
    return await run(db);
  } finally {
    await close();
  }
}

export async function listRegistryCreatorsAction(): Promise<RegistryCreatorListRow[]> {
  if (isDemoMode()) return [];
  return withGlobalDb((db) => listRegistryCreators(db));
}

export async function getRegistryCreatorHistoryAction(
  registryCreatorId: string,
): Promise<RegistryBrandHistoryRow[]> {
  if (isDemoMode()) return [];
  return withGlobalDb((db) => listRegistryCreatorBrandHistory(db, registryCreatorId));
}

export async function addCreatorToRegistryAction(data: {
  name: string;
  instagramUsername?: string | null;
  profilePicUrl?: string | null;
  creatorLink?: string | null;
  platform?: string[];
  ageBracket?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  shippingLocation?: string | null;
  tags?: string[];
  notes?: string | null;
}): Promise<{ ok: true; id: string } | RegistryActionFailure> {
  if (isDemoMode()) return { ok: false, error: 'Demo mode — cannot create registry entries.' };

  const normalizedIg = normalizeInstagramUsername(data.instagramUsername);

  return withGlobalDb(async (db) => {
    if (normalizedIg) {
      const existing = await findRegistryCreatorByNormalizedIg(db, normalizedIg);
      if (existing) return { ok: true as const, id: existing.id };
    }

    const result = await insertRegistryCreator(db, {
      name: data.name,
      instagramUsername: data.instagramUsername ?? null,
      profilePicUrl: data.profilePicUrl ?? null,
      creatorLink: data.creatorLink ?? null,
      platform: (data.platform ?? []) as CreatorPlatform[],
      ageBracket: (data.ageBracket ?? null) as CreatorAgeBracket | null,
      gender: data.gender ?? null,
      ethnicity: data.ethnicity ?? null,
      shippingLocation: data.shippingLocation ?? null,
      tags: data.tags ?? [],
      notes: data.notes ?? null,
      normalizedInstagram: normalizedIg,
    });
    return { ok: true as const, id: result.id };
  });
}

export async function addRegistryCreatorToBrandAction(
  registryCreatorId: string,
): Promise<{ ok: true; creatorId: string; alreadyExisted: boolean } | RegistryActionFailure> {
  if (isDemoMode()) return { ok: false, error: 'Demo mode — cannot add creators to a brand.' };

  const result = await withBrandScope(async (db, brandId) => {
    return addRegistryCreatorToBrand(db, registryCreatorId, brandId);
  });

  if (result === null) return { ok: false, error: 'No brand resolved.' };

  revalidatePath('/app/ugc');
  return { ok: true, creatorId: result.id, alreadyExisted: result.alreadyExisted };
}
