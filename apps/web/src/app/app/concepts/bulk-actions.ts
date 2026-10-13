'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import {
  CONCEPT_CLIENT_STATUS_DEFAULT,
  CONCEPT_INTERNAL_STATUS_DEFAULT,
  getConceptById,
  insertActivity,
  softDeleteConcepts,
  updateConcept,
  updateConceptClientStatus,
} from '@tas/db';
import {
  isInternalStatusKey,
  type ClientStatusKey,
  type InternalStatusKey,
} from '@tas/domain/state';
import { z } from 'zod';

import type { BulkDeleteResult, BulkStatusResult } from '@/components/views';
import { currentActor } from '@/lib/actor';
import { withBrandScope } from '@/lib/concepts-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefsPath, conceptPath, conceptsPath } from '@/lib/routes';

import { clientMoveRefusal, internalMoveRefusal, isClientStatus } from './status-guard';

/**
 * The Concepts grid's bulk writes (Ticket 8, PRD §5.7 and §9), shaped exactly like the Creative
 * Sheet's `review-actions.ts`: refuse in DEMO MODE before anything else, zod over the id list, the
 * session, then the brand scope — so an id another brand owns simply never resolves, and the
 * returned ids are the honest outcome. Delete is a SOFT delete through `softDeleteConcepts` (never
 * `DELETE FROM`), logged per row in the activity log under the `concept` entity; briefs and copy
 * keep their nullable `concept_id` (non-negotiable 5) and simply resolve no concept name any more.
 *
 * The bulk Change status carries BOTH tracks (non-negotiable 4), and the CLIENT track re-runs the
 * SAME gate the detail form's save runs — `clientMoveRefusal` from `./status-guard`, per row, on the
 * row's stored internal status — so a selection the bar let through is still refused row by row
 * where the machine says no, with the gate's own reason. Neither action ever throws to the client.
 */

const SESSION_EXPIRED = 'Your session has expired. Sign in again to save.';
const NO_BRAND = 'This workspace has no brand yet.';
const NOTHING_SELECTED = 'Select at least one concept first.';
const UNKNOWN_TRACK = 'That is not a status track.';
const UNKNOWN_INTERNAL = 'That is not a status on the internal track.';
const UNKNOWN_CLIENT = 'That is not a status on the client track.';
const GONE = 'That concept is no longer available.';

/** The activity log's entity name for a concept row (Ticket 8 ruling: parity with the briefs). */
const CONCEPT_ENTITY = 'concept';

const idList = z.array(z.string().trim().min(1)).min(1);

/** The two tracks this table carries (non-negotiable 4): the team's and the client's. */
const trackField = z.enum(['internalStatus', 'clientStatus']);

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

/** The validated move, discriminated by track so each branch holds its own key type. */
type ValidatedMove =
  | { readonly track: 'internalStatus'; readonly value: InternalStatusKey }
  | { readonly track: 'clientStatus'; readonly value: ClientStatusKey };

/**
 * Delete (n): a SOFT delete of the brand's live rows among the selection. Linked creatives and copy
 * keep their nullable `concept_id` (the lead's Ticket 8 ruling, non-negotiable 5) and simply resolve
 * no concept name any more; nothing cascades and nothing is erased.
 */
export async function deleteConceptsAction(ids: readonly string[]): Promise<BulkDeleteResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return { ok: false, error: NOTHING_SELECTED };
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const deleted = await softDeleteConcepts(db, brandId, parsed.data, actor.id);
      for (const id of deleted) {
        await insertActivity(
          db,
          brandId,
          CONCEPT_ENTITY,
          id,
          [{ field: 'deletedAt', oldValue: null, newValue: new Date().toISOString() }],
          actor,
        );
      }
      return { ok: true as const, deleted };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(conceptsPath);
    for (const id of outcome.deleted) {
      revalidatePath(conceptPath(id));
    }
    // The briefs list resolves concept names, exactly as `updateConceptAction` revalidates it.
    revalidatePath(briefsPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The concepts could not be deleted. Try again.' };
  }
}

/**
 * Change status over a selection, on either track. Each row is loaded and asked the SAME questions
 * the detail form's save asks — `internalMoveRefusal` on the internal track, `clientMoveRefusal`
 * (the gate plus "is that the next step?") on the client track, both against the row's STORED
 * statuses — so a bulk move is exactly as strict as a single one, and a refused row is reported with
 * the gate's own reason rather than silently written or silently skipped.
 */
export async function bulkMoveConceptsAction(
  ids: readonly string[],
  field: string,
  value: string,
): Promise<BulkStatusResult> {
  if (isDemoMode()) return { ok: false, error: DEMO_WRITE_REFUSAL };
  const parsedIds = idList.safeParse(ids);
  if (!parsedIds.success) return { ok: false, error: NOTHING_SELECTED };
  const parsedTrack = trackField.safeParse(field);
  if (!parsedTrack.success) return { ok: false, error: UNKNOWN_TRACK };
  const move: ValidatedMove | null =
    parsedTrack.data === 'internalStatus'
      ? isInternalStatusKey(value)
        ? { track: 'internalStatus', value }
        : null
      : isClientStatus(value)
        ? { track: 'clientStatus', value }
        : null;
  if (move === null) {
    return {
      ok: false,
      error: parsedTrack.data === 'internalStatus' ? UNKNOWN_INTERNAL : UNKNOWN_CLIENT,
    };
  }
  try {
    const actor = await writer();
    if (actor === null) return { ok: false, error: SESSION_EXPIRED };
    const outcome = await withBrandScope(async (db, brandId) => {
      const moved: string[] = [];
      const refused: { id: string; name: string; reason: string }[] = [];
      for (const id of parsedIds.data) {
        const row = await getConceptById(db, brandId, id);
        if (row === null) {
          refused.push({ id, name: id, reason: GONE });
          continue;
        }
        // The row's stored strings are `text`; narrow them against the machine before asking it.
        const wasInternal: InternalStatusKey = isInternalStatusKey(row.internalStatus)
          ? row.internalStatus
          : CONCEPT_INTERNAL_STATUS_DEFAULT;
        const wasClient: ClientStatusKey = isClientStatus(row.clientStatus)
          ? row.clientStatus
          : CONCEPT_CLIENT_STATUS_DEFAULT;
        if (move.track === 'internalStatus') {
          const refusal = internalMoveRefusal(wasInternal, move.value);
          if (refusal !== null) {
            refused.push({ id, name: row.name, reason: refusal.message });
            continue;
          }
          const saved = await updateConcept(
            db,
            brandId,
            id,
            { internalStatus: move.value },
            actor.id,
          );
          if (saved === null) refused.push({ id, name: row.name, reason: GONE });
          else moved.push(saved.id);
        } else {
          const refusal = clientMoveRefusal(wasInternal, wasClient, move.value);
          if (refusal !== null) {
            refused.push({ id, name: row.name, reason: refusal.message });
            continue;
          }
          const saved = await updateConceptClientStatus(
            db,
            brandId,
            id,
            move.value,
            null,
            actor.id,
          );
          if (saved === null) refused.push({ id, name: row.name, reason: GONE });
          else moved.push(saved.id);
        }
      }
      return { ok: true as const, moved, refused };
    });
    if (outcome === null) return { ok: false, error: NO_BRAND };
    revalidatePath(conceptsPath);
    return outcome;
  } catch {
    return { ok: false, error: 'The concepts could not be saved. Try again.' };
  }
}
