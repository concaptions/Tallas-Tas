'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  insertActivity,
  softDeleteCreators,
  updateCreator,
  updateCreatorClientStatus,
} from '@tas/db';
import { isCreatorInternalStatus, isCreatorStatus } from '@tas/domain/state';
import { z } from 'zod';

import type { BulkDeleteResult, BulkStatusResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { clientStatusRequiresNote } from '@/lib/client-status-vocabulary';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { ugcPath } from '@/lib/routes';
import { withBrandScope } from '@/lib/ugc-source';

/**
 * The UGC creators grid's bulk writes (Ticket 8, PRD §5.8), shaped exactly like the Creative
 * Sheet's `review-actions.ts`: refuse in DEMO MODE before anything else, zod over the id list, the
 * session, then the brand scope — so an id another brand owns simply never resolves, and the
 * returned ids are the honest outcome. Delete is a SOFT delete through `softDeleteCreators` (never
 * `DELETE FROM`), logged per row in the activity log under the `creator` entity.
 *
 * The status move carries the creator's TWO bulk-movable tracks (lead's Ticket 8 answer 5):
 * `internalCreatorStatus` runs the same `updateCreator` patch the panel's save makes, and
 * `clientStatus` runs the same `updateCreatorClientStatus` trio the Oct 5 dropdown dispatches —
 * each value checked against its own vocabulary first (`isCreatorInternalStatus` /
 * `isCreatorStatus`). The client track keeps its one domain rule: `revisions_needed` and
 * `disapproved` must carry a reason (`clientStatusRequiresNote`, the Oct 6 Talal ruling), and a
 * bulk move has no per-row reason to give, so those keys are refused here and set one creator at a
 * time. Neither action ever throws to the client.
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one creator first.';
const UNKNOWN_TRACK = 'That is not a status track.';
const UNKNOWN_STATUS = 'That is not a status on this track.';
const NOTE_REQUIRED =
  'Revisions Needed and Disapproved need a short reason — set them one creator at a time.';
const GONE = 'That creator is no longer available.';

/** The activity log's entity name for a creator row (Ticket 8 ruling: parity with the briefs). */
const CREATOR_ENTITY = 'creator';

const idList = z.array(z.string().trim().min(1)).min(1);

/** The two tracks a bulk move may touch: the internal review and the client-facing track. */
const trackField = z.enum(['internalCreatorStatus', 'clientStatus']);

interface Actor {
  readonly id: string;
  readonly name: string | null;
}

/** Who is writing: the Clerk id and the display name the activity log stores. */
async function writer(): Promise<Actor | null> {
  const { userId } = await auth();
  if (userId === null) return null;
  const { fullName } = await currentActor();
  return { id: userId, name: fullName };
}

/**
 * Delete (n): a SOFT delete of the brand's live rows among the selection. Linked collaborations
 * and concepts keep their `creator_id` / junction reference and simply resolve no creator name any
 * more (the lead's Ticket 8 ruling); nothing cascades and nothing is erased.
 */
export async function deleteCreatorsAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const deleted = await softDeleteCreators(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          CREATOR_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(ugcPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The creators could not be deleted. Try again.' };
  }
}

/**
 * Change status over a selection, one row at a time through the track's own existing writer, so a
 * bulk move is exactly as strict as a single one. An id that resolves nothing — the other brand's,
 * or a row deleted since the page loaded — is reported, never silently written.
 */
export async function bulkMoveCreatorsAction(
  ids: readonly string[],
  field: string,
  value: string,
): Promise<BulkStatusResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  const parsedTrack = trackField.safeParse(field);
  if (!parsedTrack.success) return { ok: false, error: UNKNOWN_TRACK };
  const track = parsedTrack.data;
  if (track === 'internalCreatorStatus') {
    if (!isCreatorInternalStatus(value)) return { ok: false, error: UNKNOWN_STATUS };
  } else {
    if (!isCreatorStatus(value)) return { ok: false, error: UNKNOWN_STATUS };
    // The client track's one domain rule, re-run on the server (a disabled option is a hint):
    // a note-required status cannot be set in bulk because there is no per-row reason to store.
    if (clientStatusRequiresNote('creators', value)) {
      return { ok: false, error: NOTE_REQUIRED };
    }
  }
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const moved: string[] = [];
      const refused: { id: string; name: string; reason: string }[] = [];
      for (const id of parsedIds.data) {
        const row =
          track === 'internalCreatorStatus'
            ? await updateCreator(db, brandId, id, { internalCreatorStatus: value }, actor.id)
            : await updateCreatorClientStatus(db, brandId, id, value, null, actor.id);
        if (row === null) refused.push({ id, name: id, reason: GONE });
        else moved.push(row.id);
      }
      return { ok: true as const, moved, refused };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(ugcPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The creators could not be saved. Try again.' };
  }
}
