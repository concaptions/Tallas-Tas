import {
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
  type ChipTone,
  type CreativeTrack,
  type InternalStatusKey,
} from './creative-status';

/**
 * The editor's board (Sprint 10, EDIT-01): three columns over the internal status track, so an
 * editor or designer reads "what just landed, what I am on, what is waiting on a reviewer" without
 * learning seven status words. The columns are a VIEW of `internal_status`, never a second column:
 * a brief is in a stage because of the status it carries, and moving it (the Start button, a
 * drag) writes the status through the same transition table every other write obeys.
 *
 * The mapping, both tracks. The left column is the stage KEY; the heading an editor reads is the
 * stage's `label`, which is a separate thing — see `EDITOR_STAGES` below.
 *
 * | Stage key     | Video track                                       | Static track                                       |
 * | ------------- | ------------------------------------------------- | -------------------------------------------------- |
 * | incoming      | sent_to_video_editor                              | sent_to_designer                                   |
 * | under_editing | video_editing_in_progress, videos_revisions       | static_design_in_progress, images_revisions        |
 * | under_review  | ad_submitted, revisions_submitted                 | ad_submitted, revisions_submitted                  |
 * | (off board)   | approved, launched, on_hold                       | approved, launched, on_hold                        |
 *
 * Revisions sit under Editing because the reviewer has handed the work back and the editor holds
 * it again; the two "submitted" states sit under Review because the editor is done and a reviewer
 * holds it. Approved and Launched have left the editor's desk and are not on this board.
 */
/**
 * THE KEY AND THE LABEL ARE TWO DIFFERENT THINGS, and the first stage is why.
 *
 * `key` is data: it is the Kanban `groupValue`, the `?group=editorStage` URL value, the drop
 * handler's branch in `briefs-workspace.tsx` and the `data-stage` attribute a test asserts on.
 * Renaming a key would break a bookmarked board and a saved view, so the keys are frozen.
 *
 * `label` is the only one of the two that reaches a screen, and `incoming` carries the wording the
 * team actually uses for that column: a brief lands there when somebody sent it to the editor or
 * the designer. "Incoming" said where it arrived; "Sent to Editor/Designer" says what happened to
 * it, which is the status the two tracks already store (`sent_to_video_editor` /
 * `sent_to_designer`, `creative-status.ts`). One heading has to cover both tracks — `STAGE_OF`
 * maps both statuses to this one stage — so it names both jobs rather than one.
 */
export const EDITOR_STAGES = [
  { key: 'incoming', label: 'Sent to Editor/Designer', tone: 'info' },
  { key: 'under_editing', label: 'Under Editing', tone: 'warn' },
  { key: 'under_review', label: 'Under Review', tone: 'accent' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type EditorStageKey = (typeof EDITOR_STAGES)[number]['key'];

export const EDITOR_STAGE_KEYS: readonly EditorStageKey[] = EDITOR_STAGES.map((stage) => stage.key);

const STAGE_OF: Readonly<Record<InternalStatusKey, EditorStageKey | null>> = {
  sent_to_video_editor: 'incoming',
  sent_to_designer: 'incoming',
  video_editing_in_progress: 'under_editing',
  static_design_in_progress: 'under_editing',
  videos_revisions: 'under_editing',
  images_revisions: 'under_editing',
  ad_submitted: 'under_review',
  revisions_submitted: 'under_review',
  approved: null,
  launched: null,
};

/** The stage a stored internal status sits in, or null when the brief has left the editor's board. */
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
 * The status Start moves an `incoming` brief to: the track's "in progress" step, the next
 * step after its first in `INTERNAL_VIDEO_STATUS` / `INTERNAL_STATIC_STATUS` — the same transition
 * the status machine allows, so Start never invents a move.
 */
export function startedStatusFor(track: CreativeTrack): InternalStatusKey {
  const ladder = track === 'static' ? INTERNAL_STATIC_STATUS : INTERNAL_VIDEO_STATUS;
  const second = ladder[1];
  return second.key;
}
