'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertActivity, softDeleteCopy, updateCopy, updateCopyStatus } from '@tas/db';
import {
  isCopyStatus,
  normalizeClientApprovalStatus,
  type ClientApprovalStatusKey,
  type CopyStatusKey,
} from '@tas/domain/state';
import { z } from 'zod';

import type { BulkDeleteResult, BulkStatusResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { clientStatusRequiresNote } from '@/lib/client-status-vocabulary';
import { withBrandScope } from '@/lib/copy-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { copywritingPath } from '@/lib/routes';

/**
 * The Copywriting grid's bulk writes (Ticket 8, PRD §5.11), shaped exactly like the Creative
 * Sheet's `review-actions.ts`: refuse in DEMO MODE before anything else, zod over the id list, the
 * session, then the brand scope — so an id another brand owns simply never resolves, and the
 * returned ids are the honest outcome. Delete is a SOFT delete through `softDeleteCopy` (never
 * `DELETE FROM`), logged per row in the activity log under the `copywriting` entity. An id that
 * resolves nothing writes nothing: a pending "New copy" row the select-all caught before the
 * refresh simply drops out of the result, which is the supported case, not an error.
 *
 * The status move carries copy's TWO bulk-movable tracks (lead's Ticket 8 answer 5): `status` runs
 * the same `updateCopyStatus` write the Oct 5 dropdown dispatches, and `clientApprovalStatus` runs
 * the same normalised trio the single-row `updateCopyClientApproval` action writes — each value
 * checked against its own vocabulary first (`isCopyStatus` / `normalizeClientApprovalStatus`, the
 * legacy four-value spelling stored as its mapped key). The `status` track keeps its one domain
 * rule: `revisions_needed` and `disapproved` must carry a reason (`clientStatusRequiresNote`, the
 * Oct 6 Talal ruling the single-row dropdown enforces too), and a bulk move has no per-row reason
 * to give, so those keys are refused here and set one copy at a time. The client-approval track has
 * no such rule on its single-row action, so the bulk move is exactly as strict — no stricter.
 * Neither action ever throws to the client.
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one copy first.';
const UNKNOWN_TRACK = 'That is not a status track.';
const UNKNOWN_STATUS = 'That is not a status on this track.';
const NOTE_REQUIRED =
  'Revisions Needed and Disapproved need a short reason — set them one copy at a time.';
const GONE = 'That copy is no longer available.';

/** The activity log's entity name for a copy row (Ticket 8 ruling: parity with the briefs). */
const COPY_ENTITY = 'copywriting';

const idList = z.array(z.string().trim().min(1)).min(1);

/** The two tracks a bulk move may touch: the copy status and the client-facing approval. */
const trackField = z.enum(['status', 'clientApprovalStatus']);

/** The validated move, discriminated by track so each branch holds its own key type. */
type ValidatedMove =
  | { readonly track: 'status'; readonly value: CopyStatusKey }
  | { readonly track: 'clientApprovalStatus'; readonly value: ClientApprovalStatusKey };

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
 * Delete (n): a SOFT delete of the brand's live rows among the selection. Linked copy types and
 * campaigns keep their junction reference and simply resolve no copy any more (the lead's Ticket 8
 * ruling); nothing cascades and nothing is erased, and a copy keeps the Copy # it was given.
 */
export async function deleteCopyAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const deleted = await softDeleteCopy(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          COPY_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(copywritingPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The copy could not be deleted. Try again.' };
  }
}

/**
 * Change status over a selection, one row at a time through the track's own existing writer, so a
 * bulk move is exactly as strict as a single one. An id that resolves nothing — the other brand's,
 * a row deleted since the page loaded, or the pending "New copy" row's provisional id — is
 * reported, never silently written.
 */
export async function bulkMoveCopyAction(
  ids: readonly string[],
  field: string,
  value: string,
): Promise<BulkStatusResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  const parsedTrack = trackField.safeParse(field);
  if (!parsedTrack.success) return { ok: false, error: UNKNOWN_TRACK };
  let move: ValidatedMove;
  if (parsedTrack.data === 'status') {
    if (!isCopyStatus(value)) return { ok: false, error: UNKNOWN_STATUS };
    // The track's one domain rule, re-run on the server (a withheld option is a hint): a
    // note-required status cannot be set in bulk because there is no per-row reason to store.
    if (clientStatusRequiresNote('copywriting', value)) {
      return { ok: false, error: NOTE_REQUIRED };
    }
    move = { track: 'status', value };
  } else {
    const normalised = normalizeClientApprovalStatus(value);
    if (normalised === null) return { ok: false, error: UNKNOWN_STATUS };
    move = { track: 'clientApprovalStatus', value: normalised };
  }
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const moved: string[] = [];
      const refused: { id: string; name: string; reason: string }[] = [];
      for (const id of parsedIds.data) {
        const row =
          move.track === 'status'
            ? await updateCopyStatus(db, brandId, id, move.value, null, actor.id)
            : // The same trio the single-row `updateCopyClientApproval` action writes: the status,
              // the (absent) note, and the server-clock timestamp travel together.
              await updateCopy(
                db,
                brandId,
                id,
                {
                  clientApprovalStatus: move.value,
                  clientApprovalNote: null,
                  clientApprovalStatusUpdatedAt: new Date(),
                },
                actor.id,
              );
        if (row === null) refused.push({ id, name: id, reason: GONE });
        else moved.push(row.id);
      }
      return { ok: true as const, moved, refused };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(copywritingPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The copy could not be saved. Try again.' };
  }
}
