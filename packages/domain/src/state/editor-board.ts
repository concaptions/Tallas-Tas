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
 * The mapping, both tracks:
 *
 * | Stage         | Video track                                       | Static track                                       |
 * | ------------- | ------------------------------------------------- | -------------------------------------------------- |
 * | (first)       | sent_to_video_editor                              | sent_to_designer                                   |
 * | Under Editing | video_editing_in_progress, videos_revisions       | static_design_in_progress, images_revisions        |
 * | Under Review  | ad_submitted, revisions_submitted                 | ad_submitted, revisions_submitted                  |
 * | (off board)   | approved, launched, on_hold                       | approved, launched, on_hold                        |
 *
 * Revisions sit under Editing because the reviewer has handed the work back and the editor holds
 * it again; the two "submitted" states sit under Review because the editor is done and a reviewer
 * holds it. Approved and Launched have left the editor's desk and are not on this board.
 *
 * THE FIRST STAGE IS NAMED BY TRACK (Sep 28 action item 59). The column used to read "Incoming",
 * which says nothing about who is waiting for it; a video brief has been *Sent to Editor* and a
 * static or design brief *Sent to Designer*. One constant cannot hold two words, so `label` here is
 * the reading for a column that holds BOTH tracks and `editorStageLabelFor` is the reading for one
 * brief. The stored status keys are untouched: `sent_to_video_editor` and `sent_to_designer` are
 * still what the rows carry and what the transition table grades. This is a label, not a state.
 */
export const EDITOR_STAGES = [
  { key: 'incoming', label: 'Sent to Editor / Designer', tone: 'info' },
  { key: 'under_editing', label: 'Under Editing', tone: 'warn' },
  { key: 'under_review', label: 'Under Review', tone: 'accent' },
] as const satisfies readonly { key: string; label: string; tone: ChipTone }[];

export type EditorStageKey = (typeof EDITOR_STAGES)[number]['key'];

/**
 * The stages whose label depends on the brief's track, and the word each track uses. A stage absent
 * from this map reads the same on both tracks — Under Editing and Under Review describe the state
 * of the work, not who holds it — so `editorStageLabelFor` falls through to its single label and a
 * caller never has to ask which kind of stage it is holding.
 */
const PER_TRACK_STAGE_LABELS: Readonly<
  Partial<Record<EditorStageKey, Readonly<Record<CreativeTrack, string>>>>
> = {
  incoming: { video: 'Sent to Editor', static: 'Sent to Designer' },
};

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

/**
 * The stage's track-neutral label: the word a column carries when it holds briefs of both tracks,
 * or when the track is not known. `editorStageLabelFor` is the per-brief reading.
 */
export function editorStageLabel(stage: EditorStageKey): string {
  return EDITOR_STAGES.find((entry) => entry.key === stage)?.label ?? stage;
}

/**
 * The stage's label for ONE brief, read off that brief's track: the first stage says "Sent to
 * Editor" for a video brief and "Sent to Designer" for a static or design one (action item 59).
 * Every other stage answers its single label, so this is safe to call for any stage.
 */
export function editorStageLabelFor(stage: EditorStageKey, track: CreativeTrack): string {
  return PER_TRACK_STAGE_LABELS[stage]?.[track] ?? editorStageLabel(stage);
}

/**
 * The label a board column carries, given the tracks of the briefs sitting in it. A column holding
 * one track reads that track's word; a mixed column — and an empty one, which has no track to read
 * — falls back to the neutral label rather than picking one of the two and lying about the other.
 */
export function editorStageColumnLabel(
  stage: EditorStageKey,
  tracks: readonly CreativeTrack[],
): string {
  const distinct = [...new Set(tracks)];
  const only = distinct.length === 1 ? distinct[0] : undefined;
  return only === undefined ? editorStageLabel(stage) : editorStageLabelFor(stage, only);
}

export function editorStageTone(stage: EditorStageKey | null): ChipTone {
  if (stage === null) return 'mute';
  return EDITOR_STAGES.find((entry) => entry.key === stage)?.tone ?? 'mute';
}

/** Whether a brief is in Incoming — the one stage the Start button acts on. */
export function canStartBrief(internalStatus: string): boolean {
  return editorStageOf(internalStatus) === 'incoming';
}

/**
 * The status Start moves an Incoming brief to: the track's "in progress" step, which is the next
 * step after its first in `INTERNAL_VIDEO_STATUS` / `INTERNAL_STATIC_STATUS` — the same transition
 * the status machine allows, so Start never invents a move.
 */
export function startedStatusFor(track: CreativeTrack): InternalStatusKey {
  const ladder = track === 'static' ? INTERNAL_STATIC_STATUS : INTERNAL_VIDEO_STATUS;
  const second = ladder[1];
  return second.key;
}
