'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { insertActivity, softDeleteAngles, updateAngle } from '@tas/db';
import { angleStatuses } from '@tas/db/schema';
import { z } from 'zod';

import type { BulkDeleteResult, BulkStatusResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { withBrandScope } from '@/lib/angles-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { anglesPath } from '@/lib/routes';

/**
 * The Angles grid's bulk writes (Ticket 8, PRD §5.6), shaped exactly like the Creative Sheet's
 * `review-actions.ts`: refuse in DEMO MODE before anything else, zod over the id list, the session,
 * then the brand scope — so an id another brand owns simply never resolves, and the returned ids
 * are the honest outcome. Delete is a SOFT delete through `softDeleteAngles` (never `DELETE FROM`),
 * logged per row in the activity log under the `angle` entity; the status move runs the same
 * `updateAngle` the panel's save uses, once per row, with the value checked against the
 * `angleStatuses` vocabulary first. Neither ever throws to the client.
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one angle first.';
const UNKNOWN_TRACK = 'That is not a status track.';
const UNKNOWN_STATUS = 'That is not one of the angle statuses.';
const GONE = 'That angle is no longer available.';

/** The activity log's entity name for an angle row (Ticket 8 ruling: parity with the briefs). */
const ANGLE_ENTITY = 'angle';

const idList = z.array(z.string().trim().min(1)).min(1);

/** The one track this table carries: the approval Status from migration 0039. */
const trackField = z.literal('status');

/** A status KEY of the shared vocabulary; anything else is a tampered submission. */
const statusKey = z.enum(angleStatuses.map((entry) => entry.key));

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
 * Delete (n): a SOFT delete of the brand's live rows among the selection. Linked concepts and
 * creatives keep their `angle_id` / junction reference and simply resolve no angle name any more
 * (the lead's Ticket 8 ruling); nothing cascades and nothing is erased.
 */
export async function deleteAnglesAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const deleted = await softDeleteAngles(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          ANGLE_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(anglesPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The angles could not be deleted. Try again.' };
  }
}

/**
 * Change status over a selection: the same one-row `updateAngle` patch the panel's save makes, run
 * per row, so a bulk move is exactly as strict as a single one. An id that resolves nothing — the
 * other brand's, or a row deleted since the page loaded — is reported, never silently written.
 */
export async function bulkMoveAnglesAction(
  ids: readonly string[],
  field: string,
  value: string,
): Promise<BulkStatusResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  if (!trackField.safeParse(field).success) return { ok: false, error: UNKNOWN_TRACK };
  const parsedValue = statusKey.safeParse(value);
  if (!parsedValue.success) return { ok: false, error: UNKNOWN_STATUS };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const moved: string[] = [];
      const refused: { id: string; name: string; reason: string }[] = [];
      for (const id of parsedIds.data) {
        const row = await updateAngle(db, brandId, id, { status: parsedValue.data }, actor.id);
        if (row === null) refused.push({ id, name: id, reason: GONE });
        else moved.push(row.id);
      }
      return { ok: true as const, moved, refused };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(anglesPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The angles could not be saved. Try again.' };
  }
}
