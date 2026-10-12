import {
  insertActivity,
  updateBrief,
  updateBriefClientStatus,
  type BriefListRow,
  type Db,
} from '@tas/db';
import { diffFields } from '@tas/domain';
import { qaResetFor } from '@tas/domain/state';

import { currentPosition, isClientStatus, isInternalOrHold, statusRefusal } from './status-guard';

/**
 * ONE track move on ONE brief, as a Kanban drop and the multi-select "Change status" both ask for
 * it (Oct 12 scope 3): the machine's checks through `status-guard.ts`, the write through the brief's
 * own `@tas/db` writer, the QA reset in the same statement, and the activity row beside it. A
 * server-only module (it writes), shared by the two Server Actions so a bulk move can never be
 * laxer than a single one.
 */

/** The activity log's entity for a brief, and the columns a track move can change on it. */
export const BRIEF_ENTITY = 'creative_brief';
const MOVE_FIELDS = [
  'internalStatus',
  'clientStatus',
  'qaVideoEditor',
  'qaDesigner',
  'qaStrategist',
] as const;

export const UNKNOWN_COLUMN = 'That column is not a status this sheet knows.';
export const GONE = 'That creative is no longer available.';

export type MoveOutcome =
  { readonly ok: true; readonly id: string } | { readonly ok: false; readonly error: string };

export async function moveBriefTrack(
  db: Db,
  brandId: string,
  current: BriefListRow,
  field: 'internalStatus' | 'status',
  value: string,
  actor: { readonly id: string; readonly name: string | null },
): Promise<MoveOutcome> {
  const position = currentPosition(current);

  if (field === 'internalStatus') {
    if (!isInternalOrHold(position.track, value)) return { ok: false, error: UNKNOWN_COLUMN };
    const refusal = statusRefusal(position, value, position.client);
    if (refusal !== null) return { ok: false, error: refusal.message };
    const patch = {
      internalStatus: value,
      ...qaResetFor({ internalFrom: position.internal, internalTo: value }),
    };
    const saved = await updateBrief(db, brandId, current.id, patch, actor.id);
    if (saved === null) return { ok: false, error: GONE };
    await insertActivity(
      db,
      brandId,
      BRIEF_ENTITY,
      saved.id,
      diffFields(current, patch, MOVE_FIELDS),
      actor,
    );
    return { ok: true, id: saved.id };
  }

  if (!isClientStatus(value)) return { ok: false, error: UNKNOWN_COLUMN };
  const refusal = statusRefusal(position, position.internal, value);
  if (refusal !== null) return { ok: false, error: refusal.message };
  // The QA reset rides the status statement (Oct 12 scope 5): no window between the two.
  const reset = qaResetFor({ clientFrom: position.client, clientTo: value });
  const saved = await updateBriefClientStatus(
    db,
    brandId,
    current.id,
    value,
    null,
    actor.id,
    reset,
  );
  if (saved === null) return { ok: false, error: GONE };
  await insertActivity(
    db,
    brandId,
    BRIEF_ENTITY,
    saved.id,
    diffFields(current, { clientStatus: value, ...reset }, MOVE_FIELDS),
    actor,
  );
  return { ok: true, id: saved.id };
}
