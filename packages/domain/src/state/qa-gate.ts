import {
  CLIENT_STATUS,
  INTERNAL_STATUS,
  chipTone,
  isClientTrackOpen,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
} from './creative-status';

/**
 * The QA gate on the client track (Oct 12 client sync, scopes 4 and 5).
 *
 * `isClientTrackOpen` is the FIRST gate: the client track exists only once internal status reaches
 * Approved. The QA checklist is the SECOND, additive gate: every tick the brief's type requires
 * must be set before the creative goes in front of the client. Both must pass; neither replaces
 * the other. Everything here is pure and vocabulary-driven — the two gates compose in
 * `submitToClientRefusal`, the Server Actions re-run it before any write, and a disabled button is
 * only ever a hint of what the action will refuse.
 *
 * WHICH TICKS A TYPE REQUIRES is decided by the brief's TRACK (`creativeTrack(type)` in
 * `@tas/domain/creatives`), never by branching on a type string: the video track is graded by the
 * video editor, the static track by the designer, and the strategist signs every creative off.
 * A brief with no track (an unknown type) needs only the strategist's tick.
 *
 * QA IS INVALIDATED by any move into a revision state — a creative sent back for changes is no
 * longer the creative that was QA'd. The invalidating keys are DERIVED from the vocabularies, not
 * hand-listed: the internal list's `warn`-toned entry (`revisions_needed`, one entry for both
 * tracks since the Oct 12 consolidation) and the client track's (`revisions_needed`). The reset
 * lands in the same write as the status.
 */

export const BRIEF_QA_CHECKS = ['qaVideoEditor', 'qaDesigner', 'qaStrategist'] as const;

export type BriefQaCheckKey = (typeof BRIEF_QA_CHECKS)[number];

/** The checklist's own wording for each tick, as the sheet, the brief page and Focus Mode read it. */
export const BRIEF_QA_CHECK_LABELS: Readonly<Record<BriefQaCheckKey, string>> = {
  qaVideoEditor: 'Video Editor QA',
  qaDesigner: 'Graphic Designer QA',
  qaStrategist: 'Creative Strategist QA',
};

/** The three stored ticks, in the shape `creative_briefs` holds them. */
export type BriefQaTicks = Readonly<Record<BriefQaCheckKey, boolean>>;

/** The track-specific tick, then the strategist's; an unknown track asks for the strategist only. */
export function requiredQaChecks(track: CreativeTrack | null): readonly BriefQaCheckKey[] {
  const typeCheck: readonly BriefQaCheckKey[] =
    track === 'video' ? ['qaVideoEditor'] : track === 'static' ? ['qaDesigner'] : [];
  return [...typeCheck, 'qaStrategist'];
}

/** One row of a checklist as a view renders it: the tick, its label, and whether this type needs it. */
export interface QaCheckView {
  readonly key: BriefQaCheckKey;
  readonly label: string;
  readonly required: boolean;
  readonly checked: boolean;
}

/** Every tick in checklist order, flagged required or not for this track; a full-record view shows all three. */
export function qaChecklistFor(
  track: CreativeTrack | null,
  ticks: BriefQaTicks,
): readonly QaCheckView[] {
  const required = requiredQaChecks(track);
  return BRIEF_QA_CHECKS.map((key) => ({
    key,
    label: BRIEF_QA_CHECK_LABELS[key],
    required: required.includes(key),
    checked: ticks[key],
  }));
}

/** The required ticks that are still unset, in checklist order; empty when the gate is open. */
export function missingQaChecks(
  track: CreativeTrack | null,
  ticks: BriefQaTicks,
): readonly BriefQaCheckKey[] {
  return requiredQaChecks(track).filter((key) => !ticks[key]);
}

/** Second gate on the client track: every QA tick this brief's type requires is set. */
export function canSubmitToClient(track: CreativeTrack | null, ticks: BriefQaTicks): boolean {
  return missingQaChecks(track, ticks).length === 0;
}

/** The sentence a disabled Submit to Client carries, naming the FIRST missing tick; null when none. */
export function qaGateReason(track: CreativeTrack | null, ticks: BriefQaTicks): string | null {
  const [first] = missingQaChecks(track, ticks);
  if (first === undefined) return null;
  return `${BRIEF_QA_CHECK_LABELS[first]} must be ticked before this brief can go to the client.`;
}

/** `n of m required checks complete`, the gate box's first line. */
export function qaProgressLabel(track: CreativeTrack | null, ticks: BriefQaTicks): string {
  const required = requiredQaChecks(track);
  const done = required.length - missingQaChecks(track, ticks).length;
  return `${String(done)} of ${String(required.length)} required checks complete.`;
}

/** What the first gate says when it is shut, so every control words it the same way. */
export const INTERNAL_GATE_REASON = 'Internal approval first: the client track opens at Approved.';

/** What Submit to Client says when there is nothing left to send. */
export const NOTHING_TO_SUBMIT_REASON = 'This creative is already with the client.';

/**
 * The client-track move "Submit to Client" performs from a position, or null when there is none:
 * a creative the client sent back (`revisions_needed`) goes back as `revisions_submitted`, the
 * track's own word for a resubmission. Every other client status is already in front of the
 * client or decided by them — `client_status` is NOT NULL and starts at `pending_for_approval`,
 * so a creative is in the client's queue the moment internal status opens the gate.
 */
export function clientSubmissionTarget(client: ClientStatusKey): ClientStatusKey | null {
  return client === 'revisions_needed' ? 'revisions_submitted' : null;
}

export interface SubmitToClientPosition {
  readonly track: CreativeTrack | null;
  /** The stored internal status — any string, so a row this build has no row for still answers. */
  readonly internal: string;
  readonly client: ClientStatusKey;
  readonly ticks: BriefQaTicks;
}

/**
 * Why Submit to Client is refused from this position, or null when it may run. The two gates in
 * order — the internal track first, then QA — and finally whether there is a move left to make.
 * The Server Action asks this before it writes; a button asks it to decide its tooltip.
 */
export function submitToClientRefusal(position: SubmitToClientPosition): string | null {
  if (!isClientTrackOpen(position.internal)) return INTERNAL_GATE_REASON;
  const qa = qaGateReason(position.track, position.ticks);
  if (qa !== null) return qa;
  if (clientSubmissionTarget(position.client) === null) return NOTHING_TO_SUBMIT_REASON;
  return null;
}

/**
 * The moves that put a creative in front of the client, and so the moves the QA gate guards:
 * the internal step that OPENS the track (`approved`), and a client-track resubmission
 * (`revisions_needed` → `revisions_submitted` or back to `pending_for_approval`). Every other
 * move — editing steps, revisions, the client's own decisions, launch — is not a submission.
 */
export function internalMoveNeedsQa(from: string, to: string): boolean {
  return to === 'approved' && from !== 'approved';
}

export function clientMoveNeedsQa(from: ClientStatusKey, to: ClientStatusKey): boolean {
  return (
    from === 'revisions_needed' && (to === 'revisions_submitted' || to === 'pending_for_approval')
  );
}

/** The `warn`-toned step of the internal list: the revision state, derived, never typed. */
export const QA_INVALIDATING_INTERNAL: readonly InternalStatusKey[] = INTERNAL_STATUS.filter(
  (entry) => chipTone(entry.label) === 'warn',
).map((entry) => entry.key);

/** The client track's revision state, derived the same way. */
export const QA_INVALIDATING_CLIENT: readonly ClientStatusKey[] = CLIENT_STATUS.filter(
  (entry) => chipTone(entry.label) === 'warn',
).map((entry) => entry.key);

/** The three ticks cleared, as a patch; spread into the same statement as the status. */
export const QA_RESET: BriefQaTicks = {
  qaVideoEditor: false,
  qaDesigner: false,
  qaStrategist: false,
};

export function internalMoveResetsQa(to: string): boolean {
  return (QA_INVALIDATING_INTERNAL as readonly string[]).includes(to);
}

export function clientMoveResetsQa(to: string): boolean {
  return (QA_INVALIDATING_CLIENT as readonly string[]).includes(to);
}

/**
 * The QA columns a status write must carry: the reset when either track moves INTO a revision
 * state, nothing otherwise. Standing still on a revision state (a save that changes other fields)
 * is not a move, so the ticks a reviewer set since are kept.
 */
export function qaResetFor(move: {
  readonly internalFrom?: string | null;
  readonly internalTo?: string | null;
  readonly clientFrom?: string | null;
  readonly clientTo?: string | null;
}): Partial<BriefQaTicks> {
  const internalMoved =
    typeof move.internalTo === 'string' &&
    move.internalTo !== move.internalFrom &&
    internalMoveResetsQa(move.internalTo);
  const clientMoved =
    typeof move.clientTo === 'string' &&
    move.clientTo !== move.clientFrom &&
    clientMoveResetsQa(move.clientTo);
  return internalMoved || clientMoved ? { ...QA_RESET } : {};
}
