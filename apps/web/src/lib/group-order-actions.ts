'use server';

import { auth } from '@clerk/nextjs/server';
import {
  clearGroupOrder,
  getGroupOrder,
  resolveUserIdByClerk,
  saveGroupOrder,
  type GroupOrderEntry,
} from '@tas/db';
import { serverEnv } from '@tas/env';
import { z } from 'zod';

import { inDemoMode, resolveLiveBrandId } from './data-source';
import { DEMO_WRITE_REFUSAL } from './demo-mode';
import { loadViewerRole } from './data-source';
import { requestConnection } from '@/lib/request-db';

/**
 * Server actions for per-user group ordering (Phase B5 commit 2). All actions run in `withBrand`
 * (via `resolveLiveBrandId`) scope and resolve the Clerk user id → `users.id` uuid before touching
 * `user_group_orders`. In demo mode the actions refuse: ordering is a preference, not business
 * data, but the DAO FKs point at `users` + `brands`, so a demo visitor with no `users` row simply
 * has nothing to write and keeps order in-browser instead (the UI uses `useState` fallback).
 *
 * ROLE GATE — the brand roles allowed to SAVE their OWN ordering are the internal roles that
 * actively steer the queue: `admin`, `strategist`, `csm`, `media_buyer`. Video editors and
 * designers READ the grid but the Oct 10 scope doc keeps their view flat; clients are refused
 * absolutely (clients never see internal groupings). `designer`/`video_editor` fall through the
 * same refusal — their own order is still kept in `localStorage` by the UI; it just doesn't hit
 * the DB. See `docs/designs/client-interface-config-2026-10-10.md`.
 */

const ALLOWED_ROLES = ['admin', 'strategist', 'csm', 'media_buyer'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export interface GroupOrderActionSuccess {
  readonly ok: true;
}

export interface GroupOrderActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type GroupOrderActionResult = GroupOrderActionSuccess | GroupOrderActionFailure;

const groupOrderEntrySchema = z.object({
  value: z.string(),
  position: z.number().int().nonnegative(),
  pinned: z.boolean(),
});

const scopeSchema = z.object({
  tableKey: z.string().min(1),
  fieldKey: z.string().min(1),
  viewId: z.uuid().nullable(),
});

const saveSchema = scopeSchema.extend({
  order: z.array(groupOrderEntrySchema).max(500),
});

function isAllowedRole(role: string | null): role is AllowedRole {
  return role !== null && (ALLOWED_ROLES as readonly string[]).includes(role);
}

/** Load the viewer's saved order for one scope, or `null` when nothing is stored (or demo). */
export async function getGroupOrderAction(input: {
  readonly tableKey: string;
  readonly fieldKey: string;
  readonly viewId: string | null;
}): Promise<GroupOrderEntry[] | null> {
  if (inDemoMode()) return null;
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return null;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return null;

  const { db, close } = requestConnection(databaseUrl);
  try {
    const [brandId, userId] = await Promise.all([
      resolveLiveBrandId(db),
      resolveUserIdByClerk(db, clerkUserId),
    ]);
    if (brandId === null || userId === null) return null;
    return await getGroupOrder({
      db,
      userId,
      brandId,
      viewId: parsed.data.viewId,
      tableKey: parsed.data.tableKey,
      fieldKey: parsed.data.fieldKey,
    });
  } finally {
    await close();
  }
}

/** Save the viewer's order for one scope. Role-gated to the internal queue-steering roles. */
export async function saveGroupOrderAction(input: {
  readonly tableKey: string;
  readonly fieldKey: string;
  readonly viewId: string | null;
  readonly order: readonly GroupOrderEntry[];
}): Promise<GroupOrderActionResult> {
  if (inDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid group order.' };

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: 'Sign in to save group order.' };

  const role = await loadViewerRole();
  if (!isAllowedRole(role)) {
    return { ok: false, error: 'Your role cannot change the group order.' };
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return { ok: false, error: 'No database is configured.' };

  const { db, close } = requestConnection(databaseUrl);
  try {
    const [brandId, userId] = await Promise.all([
      resolveLiveBrandId(db),
      resolveUserIdByClerk(db, clerkUserId),
    ]);
    if (brandId === null) return { ok: false, error: 'No active brand.' };
    if (userId === null) return { ok: false, error: 'User row not provisioned yet.' };
    await saveGroupOrder({
      db,
      userId,
      brandId,
      viewId: parsed.data.viewId,
      tableKey: parsed.data.tableKey,
      fieldKey: parsed.data.fieldKey,
      order: parsed.data.order,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save the group order. Try again.' };
  } finally {
    await close();
  }
}

/** Clear the viewer's saved order for one scope. Role-gated the same way as save. */
export async function clearGroupOrderAction(input: {
  readonly tableKey: string;
  readonly fieldKey: string;
  readonly viewId: string | null;
}): Promise<GroupOrderActionResult> {
  if (inDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };

  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid scope.' };

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { ok: false, error: 'Sign in to reset group order.' };

  const role = await loadViewerRole();
  if (!isAllowedRole(role)) {
    return { ok: false, error: 'Your role cannot change the group order.' };
  }

  const databaseUrl = serverEnv().DATABASE_URL;
  if (!databaseUrl) return { ok: false, error: 'No database is configured.' };

  const { db, close } = requestConnection(databaseUrl);
  try {
    const [brandId, userId] = await Promise.all([
      resolveLiveBrandId(db),
      resolveUserIdByClerk(db, clerkUserId),
    ]);
    if (brandId === null) return { ok: false, error: 'No active brand.' };
    if (userId === null) return { ok: false, error: 'User row not provisioned yet.' };
    await clearGroupOrder({
      db,
      userId,
      brandId,
      viewId: parsed.data.viewId,
      tableKey: parsed.data.tableKey,
      fieldKey: parsed.data.fieldKey,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reset the group order. Try again.' };
  } finally {
    await close();
  }
}
