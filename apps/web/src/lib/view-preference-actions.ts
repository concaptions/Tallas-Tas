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

/**
 * The view a table opens in when the viewer has saved no preference (and in demo mode, where prefs
 * are not stored). Grid for most tables; a caller passes its own — Briefs opens on Kanban, the
 * media-buyer/strategist board being the primary view (P2B, Talal's LuckyFours approval).
 */
export async function loadViewPreference(
  tableKey: string,
  defaultView: ViewType = 'grid',
): Promise<ViewPreferenceResult> {
  const fallback: ViewPreferenceResult = { viewType: defaultView, kanbanGroupByField: null };
  if (isDemoMode()) return fallback;

  const { userId } = await auth();
  if (!userId) return fallback;

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return fallback;

  // A read that page renders call directly, so it shares the render's request connection (and its
  // once-per-request brand resolution) instead of opening a pool of its own; `after` ends it.
  const { db } = requestConnection(databaseUrl);
  const brandId = await resolveLiveBrandId(db);
  if (!brandId) return fallback;
  const pref = await getViewPreference(db, userId, brandId, tableKey);
  if (!pref) return fallback;
  const vt = pref.viewType as ViewType;
  if (!supportsView(tableKey, vt)) return fallback;
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
