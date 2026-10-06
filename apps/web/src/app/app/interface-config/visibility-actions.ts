'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { listTeam, resetTabVisibility, upsertTabVisibility, type Db } from '@tas/db';
import { CLIENT_TAB_KEYS, canConfigureInterface, isClientTabKey } from '@tas/domain';
import { z } from 'zod';

import { resolveLiveAgencyId } from '@/lib/data-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { withInterfacePagesScope } from '@/lib/interface-config-pages-source';
import { interfaceConfigPath } from '@/lib/routes';
import { teamPageActorFrom } from '@/lib/team-actor';

/**
 * Server Actions for the Interface Config / Standard Tab Visibility section (Oct 6/7 Agent 4).
 *
 * Three actions, all gated by `canConfigureInterface` (Admin + CSM, Oct 6/7 ruling) and refused
 * before any state is read in demo mode. Each one writes through `withInterfacePagesScope`, which
 * resolves the actor's brand once and runs the write under it. A row id that doesn't belong to the
 * actor's brand simply never resolves.
 *
 * The two toggle / reorder actions upsert `interface_tab_visibility`; the reset action HARD-deletes
 * the brand's row so the client portal falls through to the template default. See
 * `custom-interface-pages.ts` in `@tas/db` for the full write contract.
 */

export interface VisibilityActionSuccess {
  readonly ok: true;
  readonly savedAt: number;
}

export interface VisibilityActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type VisibilityActionResult = VisibilityActionSuccess | VisibilityActionFailure;

const NOT_PERMITTED_REFUSAL =
  'Only an agency Admin or a Client Success Manager can change which pages and tabs the client interface shows.';

function failure(error: string): VisibilityActionFailure {
  return { ok: false, error };
}

function success(): VisibilityActionSuccess {
  return { ok: true, savedAt: Date.now() };
}

async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

async function configRefusal(db: Db, clerkUserId: string): Promise<string | null> {
  const agencyId = await resolveLiveAgencyId(db);
  if (agencyId === null) {
    return 'This workspace has no agency yet.';
  }
  const team = await listTeam(db, agencyId);
  const actor = teamPageActorFrom(team.find((row) => row.clerkUserId === clerkUserId));
  return canConfigureInterface(actor) ? null : NOT_PERMITTED_REFUSAL;
}

const toggleSchema = z.object({
  tabKey: z.enum(CLIENT_TAB_KEYS),
  isVisible: z.boolean(),
});

const reorderSchema = z.object({
  tabKey: z.enum(CLIENT_TAB_KEYS),
  direction: z.enum(['up', 'down']),
});

const resetSchema = z.object({
  tabKey: z.enum(CLIENT_TAB_KEYS),
});

function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Flip the visibility bit on one standard tab for the actor's brand. Upserts — a brand with no row
 * yet (reading the template default) gets its own row written here, after which the admin UI shows
 * the row as "customised" and the client portal reads it instead of the template.
 */
export async function toggleTabVisibilityAction(
  _previous: VisibilityActionResult | null,
  formData: FormData,
): Promise<VisibilityActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
  }
  const raw = {
    tabKey: entry(formData, 'tabKey'),
    isVisible: entry(formData, 'isVisible') === 'true',
  };
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return failure('Could not read the tab change.');
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      await upsertTabVisibility(db, {
        brandId,
        tabKey: parsed.data.tabKey,
        isVisible: parsed.data.isVisible,
        sortOrder: CLIENT_TAB_KEYS.indexOf(parsed.data.tabKey) + 1,
        createdBy: actor,
        updatedBy: actor,
      });
      return { refusal: null };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success();
  } catch {
    return failure('The tab visibility could not be saved. Try again.');
  }
}

/**
 * Move one standard tab up or down by one. The pair swap writes two rows; the admin UI sends one
 * action per button press.
 */
export async function reorderTabAction(
  _previous: VisibilityActionResult | null,
  formData: FormData,
): Promise<VisibilityActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const raw = {
    tabKey: entry(formData, 'tabKey'),
    direction: entry(formData, 'direction'),
  };
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return failure('Could not read the reorder request.');
  const idx = CLIENT_TAB_KEYS.indexOf(parsed.data.tabKey);
  const otherIdx = parsed.data.direction === 'up' ? idx - 1 : idx + 1;
  if (otherIdx < 0 || otherIdx >= CLIENT_TAB_KEYS.length) {
    return failure('This tab cannot move further.');
  }
  const otherKey = CLIENT_TAB_KEYS[otherIdx];
  if (otherKey === undefined || !isClientTabKey(otherKey)) {
    return failure('This tab cannot move further.');
  }
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      await upsertTabVisibility(db, {
        brandId,
        tabKey: parsed.data.tabKey,
        isVisible: true,
        sortOrder: otherIdx + 1,
        createdBy: actor,
        updatedBy: actor,
      });
      await upsertTabVisibility(db, {
        brandId,
        tabKey: otherKey,
        isVisible: true,
        sortOrder: idx + 1,
        createdBy: actor,
        updatedBy: actor,
      });
      return { refusal: null };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success();
  } catch {
    return failure('The tab order could not be saved. Try again.');
  }
}

/** Hard-delete the brand's row for one standard tab, so the client portal falls through to the template default. */
export async function resetTabVisibilityAction(
  _previous: VisibilityActionResult | null,
  formData: FormData,
): Promise<VisibilityActionResult> {
  if (isDemoMode()) return failure(DEMO_WRITE_REFUSAL);
  const raw = { tabKey: entry(formData, 'tabKey') };
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) return failure('Could not read the reset request.');
  try {
    const actor = await actorId();
    if (actor === null) return failure('Your session has expired. Sign in again to save.');
    const outcome = await withInterfacePagesScope(async (db, brandId) => {
      const refusal = await configRefusal(db, actor);
      if (refusal !== null) return { refusal };
      await resetTabVisibility(db, brandId, parsed.data.tabKey);
      return { refusal: null };
    });
    if (outcome === null) return failure('This workspace has no brand yet.');
    if (outcome.refusal !== null) return failure(outcome.refusal);
    revalidatePath(interfaceConfigPath);
    return success();
  } catch {
    return failure('The tab could not be reset. Try again.');
  }
}
