import type { CreativeSheetItemListRow } from '@tas/db';
import {
  creativeDimensionDisplay,
  creativeTrack,
  normalizeCreativeDimensions,
} from '@tas/domain/creatives';
import {
  BRIEF_QA_CHECK_LABELS,
  canSubmitToClient,
  INTERNAL_GATE_REASON,
  INTERNAL_STATUS,
  internalMoveResetsQa,
  missingQaChecks,
  NOTHING_TO_SUBMIT_REASON,
  qaChecklistFor,
  qaGateReason,
  qaProgressLabel,
  submitToClientRefusal,
  type CreativeTrack,
  type QaCheckView,
} from '@tas/domain/state';

import { currentPosition, statusRefusal, type Position } from './status-guard';

/**
 * The one revision step Request Changes writes — `revisions_needed`, the same for both creative
 * tracks since the Oct 12 consolidation (Ticket 5 / 0067) — derived from the QA-reset rule the
 * action obeys, never typed.
 */
const REVISION_STEP = INTERNAL_STATUS.find((entry) => internalMoveResetsQa(entry.key))?.key ?? null;

/**
 * Focus Mode's pure half (Oct 12 scope 1): which creative is in focus, where prev/next go, the
 * `07 / 23` counter, the QA checklist the type requires, and the three action buttons' states —
 * each asked of the same `status-guard.ts` the Server Actions run, so a button is enabled exactly
 * when the action would succeed, and a disabled one carries the action's own refusal as its hint.
 */

/** The index of the creative in focus: the selected one, else the first; -1 for an empty list. */
export function focusIndex(ids: readonly string[], selectedId: string | null): number {
  if (ids.length === 0) return -1;
  if (selectedId === null) return 0;
  const index = ids.indexOf(selectedId);
  return index === -1 ? 0 : index;
}

/** The neighbour `delta` steps away, clamped to the list — the ends do not wrap. */
export function neighbourIndex(index: number, delta: number, length: number): number {
  if (length === 0) return -1;
  return Math.max(0, Math.min(length - 1, index + delta));
}

/** `07 / 23`: both numbers padded to the total's width, so the counter never jitters. */
export function focusCounter(index: number, total: number): string {
  const width = String(Math.max(total, 1)).length;
  const position = total === 0 ? 0 : index + 1;
  return `${String(position).padStart(width, '0')} / ${String(total).padStart(width, '0')}`;
}

/** The brief's position on both tracks, as every helper below reads it (an unknown type reads as Video). */
function positionOf(item: CreativeSheetItemListRow): Position {
  return currentPosition({
    type: item.briefType ?? 'Video',
    internalStatus: item.internalStatus,
    clientStatus: item.status,
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
  });
}

/**
 * Which gate refused a button (B1.A6): the QA checklist (the popover gets its warn heading and the
 * missing tick in bold), the internal track, nothing left to submit, or the state machine itself.
 */
export type FocusRefusalKind = 'qa' | 'internal' | 'nothing' | 'machine';

export interface FocusButtonState {
  readonly enabled: boolean;
  /** The refusal the action would answer with; the tooltip of a disabled button. */
  readonly hint: string | null;
  /** Which gate the hint comes from; null when the button is enabled. */
  readonly kind: FocusRefusalKind | null;
}

export interface FocusActions {
  readonly requestChanges: FocusButtonState;
  readonly approve: FocusButtonState;
  readonly submitToClient: FocusButtonState;
  /** The internal revision step Request Changes writes, for the button's own wording. */
  readonly revisionStep: string | null;
}

/**
 * The refusal is classified by the sentence the guard returned, not by whether QA happens to be
 * incomplete: at Draft with no ticks, Approve is refused by the machine ("not the next step"), and
 * a QA heading over that sentence would name the wrong gate.
 */
function state(hint: string | null, qaReason: string | null): FocusButtonState {
  if (hint === null) return { enabled: true, hint, kind: null };
  const kind: FocusRefusalKind =
    hint === INTERNAL_GATE_REASON
      ? 'internal'
      : hint === NOTHING_TO_SUBMIT_REASON
        ? 'nothing'
        : hint === qaReason
          ? 'qa'
          : 'machine';
  return { enabled: false, hint, kind };
}

/** The three buttons' states for one creative, from the guard the actions re-run. */
export function focusActions(item: CreativeSheetItemListRow): FocusActions {
  const position = positionOf(item);
  const qaReason = qaGateReason(position.track, position.ticks);
  const requestChanges =
    REVISION_STEP === null
      ? 'This creative is not waiting on an internal review.'
      : (statusRefusal(position, REVISION_STEP, position.client)?.message ?? null);
  const approve = statusRefusal(position, 'approved', position.client)?.message ?? null;
  const submitToClient = submitToClientRefusal(position);
  return {
    requestChanges: state(requestChanges, qaReason),
    approve: state(approve, qaReason),
    submitToClient: state(submitToClient, qaReason),
    revisionStep: REVISION_STEP,
  };
}

/** The popover's heading over a QA refusal (board 1, b1:230). */
export const QA_GATE_HEADING = 'QA checklist incomplete';

/**
 * The first missing required tick's label — the phrase a QA refusal opens with, bolded in the
 * popover (B1.A6); null once the gate is open.
 */
export function focusQaMissingLabel(item: CreativeSheetItemListRow): string | null {
  const { track, ticks } = positionOf(item);
  const [first] = missingQaChecks(track, ticks);
  return first === undefined ? null : BRIEF_QA_CHECK_LABELS[first];
}

/** The QA rows Focus Mode draws: only the ticks this type requires — a video never shows designer QA. */
export function focusQaChecklist(item: CreativeSheetItemListRow): readonly QaCheckView[] {
  const { track, ticks } = positionOf(item);
  return qaChecklistFor(track, ticks).filter((check) => check.required);
}

/** Every QA row for the full-record sidebar: the N/A one included, flagged so it is struck through. */
export function sidebarQaChecklist(item: CreativeSheetItemListRow): readonly QaCheckView[] {
  const { track, ticks } = positionOf(item);
  return qaChecklistFor(track, ticks);
}

/**
 * The track whose ticks the checklist asks for (B4.A3). The sub-label names the TRACK, not the
 * type: an unknown type takes the video track on purpose (the superset gate, `vocabulary.ts`), so
 * "Required on the video track" is true where "type is Video" would not be.
 */
export function focusQaTrack(item: CreativeSheetItemListRow): CreativeTrack {
  return positionOf(item).track;
}

/** The gate box's first line: `1 of 2 required checks complete.` */
export function focusQaProgress(item: CreativeSheetItemListRow): string {
  const { track, ticks } = positionOf(item);
  return qaProgressLabel(track, ticks);
}

/** Whether the QA gate is open: every tick this type requires is set (the second gate). */
export function focusQaGateOpen(item: CreativeSheetItemListRow): boolean {
  const { track, ticks } = positionOf(item);
  return canSubmitToClient(track, ticks);
}

/** The gate box's tone: `ok` once the gate is open, `warn` while a required tick is missing (B4.V1). */
export type FocusQaGateTone = 'ok' | 'warn';

export function qaGateTone(open: boolean): FocusQaGateTone {
  return open ? 'ok' : 'warn';
}

export function focusQaGateTone(item: CreativeSheetItemListRow): FocusQaGateTone {
  return qaGateTone(focusQaGateOpen(item));
}

/**
 * The gate box's second line while the gate is shut. Since decision 3 the QA gate holds Approve
 * (the submission) as well as a client-track resubmission, so both are named (B1.A7).
 */
export const QA_GATE_NOTE =
  'Approve and Submit to Client unlock when every required tick for this type is set.';

/** The gate box's second line once every required tick is set (B4.V2). */
export const QA_GATE_OPEN_NOTE =
  'Every required tick is set. Approve and Submit to Client are unlocked.';

export function focusQaGateNote(item: CreativeSheetItemListRow): string {
  return focusQaGateOpen(item) ? QA_GATE_OPEN_NOTE : QA_GATE_NOTE;
}

/** What the sidebar's N/A tag says for the tick the other track owns. */
export function notApplicableTag(track: 'video' | 'static'): string {
  return `N/A · ${track}`;
}

/**
 * The preview stamp (B1.V16): the type and the first stored ratio (`Video · 9:16`) for a creative
 * on the video track — the types that play — and null for a still, which gets no disc and no
 * stamp. Duration and pixels are not stored, so the board's `0:00 / 0:24 · 1080×1920` has no
 * source yet; the ratio is what the brief knows.
 */
export function previewStamp(
  item: Pick<CreativeSheetItemListRow, 'briefType' | 'dimensions'>,
): string | null {
  if (item.briefType === null || creativeTrack(item.briefType) !== 'video') return null;
  const [ratio] = normalizeCreativeDimensions(item.dimensions);
  return ratio === undefined
    ? item.briefType
    : `${item.briefType} · ${creativeDimensionDisplay(ratio)}`;
}

/**
 * The preview footer's file name (B1.A24): the URL's last path segment, decoded, so
 * `…/TV01-B3-CasualHangouts-V2_cut03.mp4` reads as its basename; the URL itself stays in the
 * `title`. Anything that is not a URL, or a URL with no file segment, is shown as it came.
 */
export function previewFileName(url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return url;
  }
  const last = pathname.split('/').pop();
  if (last === undefined || last === '') return url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
