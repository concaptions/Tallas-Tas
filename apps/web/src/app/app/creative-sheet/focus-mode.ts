import type { CreativeSheetItemListRow } from '@tas/db';
import {
  INTERNAL_STATUS,
  internalMoveResetsQa,
  qaChecklistFor,
  qaProgressLabel,
  submitToClientRefusal,
  type QaCheckView,
} from '@tas/domain/state';

import { currentPosition, statusRefusal } from './status-guard';

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

export interface FocusButtonState {
  readonly enabled: boolean;
  /** The refusal the action would answer with; the tooltip of a disabled button. */
  readonly hint: string | null;
}

export interface FocusActions {
  readonly requestChanges: FocusButtonState;
  readonly approve: FocusButtonState;
  readonly submitToClient: FocusButtonState;
  /** The internal revision step Request Changes writes, for the button's own wording. */
  readonly revisionStep: string | null;
}

function state(hint: string | null): FocusButtonState {
  return { enabled: hint === null, hint };
}

/** The three buttons' states for one creative, from the guard the actions re-run. */
export function focusActions(item: CreativeSheetItemListRow): FocusActions {
  const position = currentPosition({
    type: item.briefType ?? 'Video',
    internalStatus: item.internalStatus,
    clientStatus: item.status,
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
  });
  const requestChanges =
    REVISION_STEP === null
      ? 'This creative is not waiting on an internal review.'
      : (statusRefusal(position, REVISION_STEP, position.client)?.message ?? null);
  const approve = statusRefusal(position, 'approved', position.client)?.message ?? null;
  const submitToClient = submitToClientRefusal(position);
  return {
    requestChanges: state(requestChanges),
    approve: state(approve),
    submitToClient: state(submitToClient),
    revisionStep: REVISION_STEP,
  };
}

/** The QA rows Focus Mode draws: only the ticks this type requires — a video never shows designer QA. */
export function focusQaChecklist(item: CreativeSheetItemListRow): readonly QaCheckView[] {
  const { track, ticks } = currentPosition({
    type: item.briefType ?? 'Video',
    internalStatus: item.internalStatus,
    clientStatus: item.status,
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
  });
  return qaChecklistFor(track, ticks).filter((check) => check.required);
}

/** Every QA row for the full-record sidebar: the N/A one included, flagged so it is struck through. */
export function sidebarQaChecklist(item: CreativeSheetItemListRow): readonly QaCheckView[] {
  const { track, ticks } = currentPosition({
    type: item.briefType ?? 'Video',
    internalStatus: item.internalStatus,
    clientStatus: item.status,
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
  });
  return qaChecklistFor(track, ticks);
}

/** The gate box's first line: `1 of 2 required checks complete.` */
export function focusQaProgress(item: CreativeSheetItemListRow): string {
  const { track, ticks } = currentPosition({
    type: item.briefType ?? 'Video',
    internalStatus: item.internalStatus,
    clientStatus: item.status,
    qaVideoEditor: item.qaVideoEditor,
    qaDesigner: item.qaDesigner,
    qaStrategist: item.qaStrategist,
  });
  return qaProgressLabel(track, ticks);
}

/** The gate box's second line. */
export const QA_GATE_NOTE =
  'Submit to Client unlocks when every required tick for this type is set.';

/** What the sidebar's N/A tag says for the tick the other track owns. */
export function notApplicableTag(track: 'video' | 'static'): string {
  return `N/A · ${track}`;
}
