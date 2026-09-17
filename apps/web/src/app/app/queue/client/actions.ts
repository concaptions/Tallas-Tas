'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { getBriefById, updateBrief } from '@tas/db';
import {
  canTransitionClient,
  clientQueueAction,
  isClientTrackOpen,
  type ClientQueueActionKey,
  type ClientStatusKey,
} from '@tas/domain/state';
import { z } from 'zod';

import { toBriefRow, withBrandScope } from '@/lib/briefs-source';
import { DEMO_WRITE_REFUSAL, isDemoMode } from '@/lib/demo-mode';
import { briefPath, clientQueuePath } from '@/lib/routes';

/**
 * The Client Queue's two mutations — the status half of what PRD §10 gives a client ("Client Status,
 * comments / annotations"; comments are out of scope for this ticket). Both follow the house pattern
 * of `briefs/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup, env read or connection —
 *    the demo deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the submission with zod, which owns the shape: one brief id, and a real one;
 * 3. go through the domain for everything that is a rule — `clientQueueAction` for what the button is
 *    FOR, `isClientTrackOpen` for PRD §9's gate and `canTransitionClient` for the move itself. No rule
 *    is restated here and no status is compared to a literal;
 * 4. write through the scoped `@tas/db` functions, which put `brand_id` on every statement;
 * 5. revalidate both routes and return a typed result. Neither ever throws to the client.
 *
 * THE GATE IS CHECKED AGAINST THE STORED ROW, NOT THE BOARD (CLAUDE.md non-negotiable 6, PRD §9).
 * `client-queue-source.ts` already withholds every brief the internal track has not signed off, so a
 * card for one cannot render — but "a creative appears in the client's interface only when Internal
 * Status = Approved" is a rule about the DATA, not about which cards happen to be on screen. A
 * submission naming a brief that is still in editing must therefore be refused here too, whatever the
 * form claims and however it got a brief id. That is why the current statuses are READ FROM THE
 * DATABASE inside the brand scope and never taken from the submission: a tampered `FormData` cannot
 * talk this action past the gate, and a card the client left open while the brief moved back cannot
 * either. `refuses a move on a brief the internal track has not approved` in `actions.test.ts` pins it.
 *
 * BOTH CONTROLS CAN NOW SUCCEED (D-027). PRD §9's client track is "Pending for Approval → Approved /
 * Revisions Needed → Launched", and `CLIENT_STATUS` carries `revisions_needed` with the edges to match,
 * so Request Revisions moves a creative the client sent back rather than answering "not the next step"
 * from every state. The card draws only the moves `canTransitionClient` allows from the row it shows;
 * this action asks the same question again of the STORED row, because the card is a picture and a
 * submission can arrive without one.
 */

export interface ClientQueueActionSuccess {
  readonly ok: true;
  readonly id: string;
  /** Where the brief now sits on the client track, so the board can react without re-reading. */
  readonly clientStatus: ClientStatusKey;
  /** Changes with every save, so the page can react to two successful saves in a row. */
  readonly savedAt: number;
}

export interface ClientQueueActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type ClientQueueActionResult = ClientQueueActionSuccess | ClientQueueActionFailure;

/** PRD §9's gate, in the one sentence the brief detail page already uses for it. */
const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';

/**
 * What a control submits: the brief it is attached to, and nothing else. The TARGET status is never
 * submitted — it comes from `CLIENT_QUEUE_ACTIONS`, so a tampered form cannot name a status of its
 * own — and the CURRENT statuses are read from the database rather than believed.
 */
const moveSchema = z.object({ id: z.uuid() });

function failure(error: string): ClientQueueActionFailure {
  return { ok: false, error };
}

/** Who is writing. Live mode only: in demo mode both actions have already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Both routes show the client status, so both are stale after a move. */
function revalidateMove(id: string): void {
  revalidatePath(clientQueuePath);
  revalidatePath(briefPath(id));
}

/**
 * The one body both actions share. `key` picks the row out of `CLIENT_QUEUE_ACTIONS`; everything that
 * follows is identical, because "Approve" and "Request Revisions" differ only in the status they aim
 * at and a second copy of this function would be a second place for the gate to rot.
 */
async function moveClientStatus(
  key: ClientQueueActionKey,
  formData: FormData,
): Promise<ClientQueueActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_WRITE_REFUSAL);
  }

  const action = clientQueueAction(key);
  if (action === undefined) {
    return failure('That is not a client action.');
  }

  const parsed = moveSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return failure('This creative could not be identified.');
  }
  const { id } = parsed.data;

  try {
    const actor = await actorId();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const found = await getBriefById(db, brandId, id);
      if (found === null) {
        return failure('That creative is no longer available.');
      }
      const row = toBriefRow(found);

      if (!isClientTrackOpen(row.internalStatus)) {
        return failure(CLIENT_GATE_SHUT);
      }
      if (!canTransitionClient(row.internalStatus, row.clientStatus, action.to)) {
        return failure('That is not the next step on the client track.');
      }

      const saved = await updateBrief(db, brandId, id, { clientStatus: action.to }, actor);
      return saved === null
        ? failure('That creative is no longer available.')
        : { ok: true as const, id: saved.id, clientStatus: action.to, savedAt: Date.now() };
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
    return failure('The client status could not be saved. Try again.');
  }
}

/** The client signs off on one creative of the actor's brand: Pending for Approval → Approved. */
export async function approveCreativeAction(
  _previous: ClientQueueActionResult | null,
  formData: FormData,
): Promise<ClientQueueActionResult> {
  return moveClientStatus('approve', formData);
}

/** The client sends one creative back for changes: Pending for Approval → Revisions Needed (PRD §9). */
export async function requestRevisionsAction(
  _previous: ClientQueueActionResult | null,
  formData: FormData,
): Promise<ClientQueueActionResult> {
  return moveClientStatus('request_revisions', formData);
}
