'use server';

import { auth } from '@clerk/nextjs/server';
import { createAutoDb, getViewPreference, saveViewPreference } from '@tas/db';
import { supportsView, type ViewType } from '@tas/domain';
import { serverEnv } from '@tas/env';

import { isDemoMode } from './demo-mode';
import { resolveLiveBrandId } from './data-source';
import { requestConnection } from './request-db';

export interface ViewPreferenceResult {
  readonly viewType: ViewType;
  readonly kanbanGroupByField: string | null;
}

const DEFAULT_PREFERENCE: ViewPreferenceResult = {
  viewType: 'grid',
  kanbanGroupByField: null,
};

export async function loadViewPreference(tableKey: string): Promise<ViewPreferenceResult> {
  if (isDemoMode()) return DEFAULT_PREFERENCE;

  const { userId } = await auth();
  if (!userId) return DEFAULT_PREFERENCE;

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return DEFAULT_PREFERENCE;

  // A read that page renders call directly, so it shares the render's request connection (and its
  // once-per-request brand resolution) instead of opening a pool of its own; `after` ends it.
  const { db } = requestConnection(databaseUrl);
  const brandId = await resolveLiveBrandId(db);
  if (!brandId) return DEFAULT_PREFERENCE;
  const pref = await getViewPreference(db, userId, brandId, tableKey);
  if (!pref) return DEFAULT_PREFERENCE;
  const vt = pref.viewType as ViewType;
  if (!supportsView(tableKey, vt)) return DEFAULT_PREFERENCE;
  return { viewType: vt, kanbanGroupByField: pref.kanbanGroupByField };
}

export interface SaveViewPreferenceInput {
  readonly tableKey: string;
  readonly viewType: string;
  readonly kanbanGroupByField: string | null;
}

export async function saveViewPreferenceAction(
  input: SaveViewPreferenceInput,
): Promise<{ ok: boolean }> {
  if (isDemoMode()) return { ok: true };

  const { userId } = await auth();
  if (!userId) return { ok: false };

  const vt = input.viewType as ViewType;
  if (!supportsView(input.tableKey, vt)) return { ok: false };

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return { ok: false };

  const db = createAutoDb(databaseUrl);
  try {
    const brandId = await resolveLiveBrandId(db);
    if (!brandId) return { ok: false };
    await saveViewPreference(db, userId, brandId, input.tableKey, vt, input.kanbanGroupByField);
    return { ok: true };
  } finally {
    await db.$client.end();
  }
}
