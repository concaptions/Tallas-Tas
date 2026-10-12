import { BRIEF_CLIENT_STATUS_DEFAULT } from '@tas/db/schema';
import { creativeTrack } from '@tas/domain/creatives';
import {
  CLIENT_STATUS,
  canSubmitToClient,
  canTransitionClient,
  canTransitionInternal,
  clientMoveNeedsQa,
  internalMoveNeedsQa,
  internalStatusFor,
  isClientTrackOpen,
  ON_HOLD,
  qaGateReason,
  qaResetFor,
  type BriefQaTicks,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
  type InternalStatusOrHoldKey,
} from '@tas/domain/state';

/**
 * The status machine as the Creative Sheet's Server Actions ask it (pure, so a test can ask it
 * too). Since the single-source cutover a sheet row IS a brief, so this narrows the brief's stored
 * strings against its own ladder and asks the domain three things before any write: is the
 * internal move legal, is the client gate open, is the client move legal — and, since the Oct 12
 * client sync, a fourth: does the move put the creative in front of the client, and if so, is every
 * QA tick its type requires set (`canSubmitToClient`, the second gate). The QA reset a move into a
 * revision state carries comes from the same module, so every writer lands it in the same patch.
 */

export const NOT_NEXT_INTERNAL = 'That is not the next step on the internal track.';
export const NOT_NEXT_CLIENT = 'That is not the next step on the client track.';
export const CLIENT_GATE_SHUT = 'The client track opens once internal status reaches Approved.';

export interface StatusRefusal {
  readonly field: 'internalStatus' | 'status';
  readonly message: string;
}

export interface Position {
  readonly track: CreativeTrack;
  readonly internal: InternalStatusOrHoldKey;
  readonly client: ClientStatusKey;
  readonly ticks: BriefQaTicks;
}

export function isInternalStatusOf(
  track: CreativeTrack,
  value: string,
): value is InternalStatusKey {
  return internalStatusFor(track).some((entry) => entry.key === value);
}

export function isInternalOrHold(
  track: CreativeTrack,
  value: string,
): value is InternalStatusOrHoldKey {
  return value === ON_HOLD.key || isInternalStatusOf(track, value);
}

export function isClientStatus(value: string): value is ClientStatusKey {
  return CLIENT_STATUS.some((entry) => entry.key === value);
}

/** The brief's three ticks, in the shape the gate reads. */
export function ticksOf(brief: BriefQaTicks): BriefQaTicks {
  return {
    qaVideoEditor: brief.qaVideoEditor,
    qaDesigner: brief.qaDesigner,
    qaStrategist: brief.qaStrategist,
  };
}

/**
 * The brief's current position on both tracks, narrowed the way the brief page narrows them: a
 * stored value outside this brief's ladder reads as the ladder's first step, so a save never
 * silently moves a creative it only meant to edit.
 */
export function currentPosition(
  brief: {
    readonly type: string;
    readonly internalStatus: string;
    readonly clientStatus: string;
  } & BriefQaTicks,
): Position {
  const track = creativeTrack(brief.type);
  const [first] = internalStatusFor(track);
  if (first === undefined) throw new Error(`the ${track} internal track is empty`);
  return {
    track,
    internal: isInternalOrHold(track, brief.internalStatus) ? brief.internalStatus : first.key,
    client: isClientStatus(brief.clientStatus) ? brief.clientStatus : BRIEF_CLIENT_STATUS_DEFAULT,
    ticks: ticksOf(brief),
  };
}

/**
 * Why the two moves a save or a drop asks for are refused, or null. Standing still is always
 * allowed; any actual move has to be the track's next step; no client move is legal while the
 * gate is shut (or the creative is on hold); and a move that puts the creative in front of the
 * client — internal → Approved, or a client resubmission — needs every required QA tick, read
 * from `ticks` (the ticks THIS write stores, when the save carries them, else the row's).
 */
export function statusRefusal(
  position: Position,
  internalNext: InternalStatusOrHoldKey,
  clientNext: ClientStatusKey,
  ticks: BriefQaTicks = position.ticks,
): StatusRefusal | null {
  if (
    internalNext !== position.internal &&
    !canTransitionInternal(position.track, position.internal, internalNext)
  ) {
    return { field: 'internalStatus', message: NOT_NEXT_INTERNAL };
  }
  if (
    internalNext !== ON_HOLD.key &&
    internalMoveNeedsQa(position.internal, internalNext) &&
    !canSubmitToClient(position.track, ticks)
  ) {
    return { field: 'internalStatus', message: qaGateReason(position.track, ticks) ?? '' };
  }
  if (clientNext === position.client) {
    return null;
  }
  if (internalNext === ON_HOLD.key) {
    return { field: 'status', message: CLIENT_GATE_SHUT };
  }
  if (clientNext !== BRIEF_CLIENT_STATUS_DEFAULT && !isClientTrackOpen(internalNext)) {
    return { field: 'status', message: CLIENT_GATE_SHUT };
  }
  if (!canTransitionClient(internalNext, position.client, clientNext)) {
    return { field: 'status', message: NOT_NEXT_CLIENT };
  }
  if (clientMoveNeedsQa(position.client, clientNext) && !canSubmitToClient(position.track, ticks)) {
    return { field: 'status', message: qaGateReason(position.track, ticks) ?? '' };
  }
  return null;
}

/**
 * The status columns one write stores for a legal pair of moves: both keys, the client stamp when
 * the client track moved, and the QA reset when either track moved into a revision state — in the
 * same patch, never a second statement.
 */
export function statusPatch(
  position: Position,
  internalNext: InternalStatusOrHoldKey,
  clientNext: ClientStatusKey,
): {
  readonly internalStatus: InternalStatusOrHoldKey;
  readonly clientStatus: ClientStatusKey;
  readonly clientStatusUpdatedAt?: Date;
} & Partial<BriefQaTicks> {
  return {
    internalStatus: internalNext,
    clientStatus: clientNext,
    ...(clientNext === position.client ? {} : { clientStatusUpdatedAt: new Date() }),
    ...qaResetFor({
      internalFrom: position.internal,
      internalTo: internalNext,
      clientFrom: position.client,
      clientTo: clientNext,
    }),
  };
}
