import { canTransitionInternal, type ChipTone, type InternalStatusKey } from './creative-status';

/**
 * The editor's board (Sprint 10, EDIT-01): three columns over the internal status track, so an
 * editor or designer reads "what just landed, what I am on, what is waiting on a reviewer" without
 * learning seven status words. The columns are a VIEW of `internal_status`, never a second column:
 * a brief is in a stage because of the status it carries, and moving it (the Start button, a
 * drag) writes the status through the same transition table every other write obeys.
 *
 * The mapping over the ONE internal list (Oct 12 consolidation, `./creative-status`). The left
 * column is the stage KEY; the heading an editor reads is the stage's `label` — see `EDITOR_STAGES`.
 *
 * | Stage key     | Internal statuses                                   |
 * | ------------- | --------------------------------------------------- |
 * | incoming      | sent_to_editor_or_designer                          |
 * | under_editing | under_editing_or_designing, revisions_needed        |
 * | under_review  | ad_submitted, revisions_submitted                   |
 * | (off board)   | draft (not handed over yet), approved (signed off)  |
 *
 * Revisions sit under Editing because the reviewer has handed the work back and the editor holds
 * it again; the two "submitted" states sit under Review because the editor is done and a reviewer
 * holds it. A draft has not reached the editor's desk and an approved brief has left it.
 */
/**
 * THE KEY AND THE LABEL ARE TWO DIFFERENT THINGS, and the first stage is why.
 *
 * `key` is data: it is the Kanban `groupValue`, the `?group=editorStage` URL value, the drop
 * handler's branch and the `data-stage` attribute a test asserts on. Renaming a key would break a
 * bookmarked board and a saved view, so the keys are frozen.
 *
 * `label` is the only one of the two that reaches a screen, and `incoming` carries the wording the
 * team actually uses for that column — which since Oct 12 is also the status word itself
 * (`sent_to_editor_or_designer`).
 */
export const EDITOR_STAGES = [
  { key: 'incoming', label: 'Sent to Editor/Designer', tone: 'info' },
  { key: 'under_editing', label: 'Under Editing', tone: 'warn' },
  { key: 'under_review', label: 'Under Review', tone: 'accent' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type EditorStageKey = (typeof EDITOR_STAGES)[number]['key'];

export const EDITOR_STAGE_KEYS: readonly EditorStageKey[] = EDITOR_STAGES.map((stage) => stage.key);

const STAGE_OF: Readonly<Record<InternalStatusKey, EditorStageKey | null>> = {
  draft: null,
  sent_to_editor_or_designer: 'incoming',
  under_editing_or_designing: 'under_editing',
  revisions_needed: 'under_editing',
  ad_submitted: 'under_review',
  revisions_submitted: 'under_review',
  approved: null,
};

/** The stage a stored internal status sits in, or null when the brief is not on the editor's board. */
export function editorStageOf(internalStatus: string): EditorStageKey | null {
  return (STAGE_OF as Readonly<Record<string, EditorStageKey | null>>)[internalStatus] ?? null;
}

export function editorStageLabel(stage: EditorStageKey): string {
  return EDITOR_STAGES.find((entry) => entry.key === stage)?.label ?? stage;
}

export function editorStageTone(stage: EditorStageKey | null): ChipTone {
  if (stage === null) return 'mute';
  return EDITOR_STAGES.find((entry) => entry.key === stage)?.tone ?? 'mute';
}

/** Whether a brief is in the `incoming` stage — the one stage the Start button acts on. */
export function canStartBrief(internalStatus: string): boolean {
  return editorStageOf(internalStatus) === 'incoming';
}

/**
 * The status Start moves an `incoming` brief to: the working step, the one transition the machine
 * allows out of `sent_to_editor_or_designer` — so Start never invents a move. One value for both
 * tracks since Oct 12.
 */
export const EDITOR_STARTED_STATUS: InternalStatusKey = 'under_editing_or_designing';

/**
 * The internal status a card drop between the editor's columns writes, or `null` when the drop is
 * not a move the machine allows (re-homed from the retired Creative Design list, 2026-10-09).
 *
 * Only two drops mean anything: Incoming → Under Editing is Start, and Under Editing → Under
 * Review is a submission — the revision resubmission when the brief was under revisions, the first
 * submission otherwise. Everything else (backwards, a skipped column, the same column, a brief that
 * is off the board) is `null`, so the caller ignores it rather than writing. The target is then
 * checked against `canTransitionInternal`, so this never invents a move the transition table refuses.
 */
export function editorStageMoveTarget(from: string, to: EditorStageKey): InternalStatusKey | null {
  const stage = editorStageOf(from);
  const next: InternalStatusKey | null =
    to === 'under_editing' && stage === 'incoming'
      ? EDITOR_STARTED_STATUS
      : to === 'under_review' && stage === 'under_editing'
        ? from === 'revisions_needed'
          ? 'revisions_submitted'
          : 'ad_submitted'
        : null;
  if (next === null) return null;
  return canTransitionInternal(from, next) ? next : null;
}
