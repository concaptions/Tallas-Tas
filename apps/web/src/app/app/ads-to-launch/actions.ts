'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getBriefById, transitionBriefLaunch } from '@tas/db';
import {
  launchQueueAction,
  launchTransition,
  type ClientStatusKey,
  type LaunchQueueActionKey,
} from '@tas/domain/state';
import { z } from 'zod';

import { toBriefRow, withBrandScope } from '@/lib/briefs-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import {
  adsToLaunchPath,
  appPath,
  briefPath,
  clientQueuePath,
  internalQueuePath,
} from '@/lib/routes';

/**
 * The media buyer's three launch-queue moves (PRD §9, §11): Mark as Launched, Pause, Resume. Same
 * house pattern as the Client Queue's actions (`queue/client/actions.ts`):
 *
 * 1. refuse in DEMO MODE before any validation, actor lookup or connection;
 * 2. zod owns the submission's shape — one brief id and nothing else. The TARGET status is never
 *    submitted; it comes from `LAUNCH_QUEUE_ACTIONS`, so a tampered form cannot name one;
 * 3. every rule is the domain's: `launchTransition` answers whether the move is legal from the
 *    STORED statuses (read inside the brand scope, never believed from the page) and what both
 *    tracks become — Launch moves the internal track to Launched too (PRD §9);
 * 4. the write is `transitionBriefLaunch`, a compare-and-set scoped by `withBrand`: it applies only
 *    while the brief still holds the statuses just validated, so a double click, a second tab or a
 *    stale board moves a creative at most once, and another brand's brief can never move;
 * 5. revalidate every route that shows these statuses and return a typed result. Never throws.
 */

export interface LaunchActionSuccess {
  readonly ok: true;
  readonly id: string;
  readonly clientStatus: ClientStatusKey;
  /** Changes with every save, so the row can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface LaunchActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type LaunchActionResult = LaunchActionSuccess | LaunchActionFailure;

const moveSchema = z.object({ id: z.uuid() });

function failure(error: string): LaunchActionFailure {
  return { ok: false, error };
}

/** The status shows on the launch queue, the brief, both queues and the Overview tiles. */
function revalidateMove(id: string): void {
  revalidatePath(adsToLaunchPath);
  revalidatePath(briefPath(id));
  revalidatePath(internalQueuePath);
  revalidatePath(clientQueuePath);
  revalidatePath(appPath);
}

async function moveLaunchStatus(
  key: LaunchQueueActionKey,
  formData: FormData,
): Promise<LaunchActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
  }

  const action = launchQueueAction(key);
  if (action === undefined) {
    return failure('That is not a launch action.');
  }

  const parsed = moveSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return failure('This creative could not be identified.');
  }
  const { id } = parsed.data;

  try {
    const { userId: actor } = await auth();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const found = await getBriefById(db, brandId, id);
      if (found === null) {
        return failure('That creative is no longer available.');
      }
      const row = toBriefRow(found);
      const next = launchTransition(action, row.track, row.internalStatus, row.clientStatus);
      if (next === null) {
        return failure('That is not the next step for this creative.');
      }

      const saved = await transitionBriefLaunch(
        db,
        brandId,
        id,
        {
          // The RAW stored values: the compare-and-set must match the row exactly as it is stored,
          // not as `toBriefRow` narrowed it for display.
          fromClientStatus: found.clientStatus,
          fromInternalStatus: found.internalStatus,
          clientStatus: next.clientStatus,
          internalStatus: next.internalStatus,
          ...(action.key === 'launch' ? { launchedAt: new Date() } : {}),
        },
        actor,
      );
      if (saved === null) {
        return failure('This creative changed while you were looking at it. Reload and try again.');
      }
      return {
        ok: true as const,
        id: saved.id,
        clientStatus: next.clientStatus,
        savedAt: Date.now(),
      };
    });

    if (outcome === null) {
      return failure('This workspace has no brand yet.');
    }
    if (!outcome.ok) {
      return outcome;
    }
    revalidateMove(outcome.id);
    return outcome;
  } catch {
    return failure('The launch status could not be saved. Try again.');
  }
}

/** The ad is live: client Approved → Launched, and the internal track to Launched (PRD §9). */
export async function markAsLaunchedAction(
  _previous: LaunchActionResult | null,
  formData: FormData,
): Promise<LaunchActionResult> {
  return moveLaunchStatus('launch', formData);
}

/** The live ad was switched off: Launched → Paused, client track only. */
export async function markAsPausedAction(
  _previous: LaunchActionResult | null,
  formData: FormData,
): Promise<LaunchActionResult> {
  return moveLaunchStatus('pause', formData);
}

/** The paused ad is live again: Paused → Launched. */
export async function resumeLaunchedAction(
  _previous: LaunchActionResult | null,
  formData: FormData,
): Promise<LaunchActionResult> {
  return moveLaunchStatus('resume', formData);
}
