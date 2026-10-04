import {
  EDITOR_STAGES,
  editorStageOf,
  editorStageTone,
  type ChipTone,
  type EditorStageKey,
} from '@tas/domain/state';

/**
 * The pipeline summary the Creative Design page shows above its view switcher (AI-48).
 *
 * A PURE function of the briefs already on the page, so the summary costs no extra query and cannot
 * disagree with the rows underneath it: the page loads every brief it would count. The buckets are
 * the editor board's three stages — `EDITOR_STAGES` in `@tas/domain/state` owns their words, their
 * order and their tones — plus one for the briefs that have left the board, because a count that
 * silently dropped the approved and launched ones would not add up to the number in the header.
 *
 * It is deliberately NOT `buildPipeline` from `lib/dashboard-source.ts`. That one answers the
 * Overview's question ("what is waiting on whom, per role") and returns cards that link away to a
 * filtered table; this one answers the briefs page's own question ("where is the work on this
 * board") and must bucket by stage, which the status-keyed metric cards cannot do — a stage covers
 * several statuses.
 */
export const OFF_BOARD_KEY = 'off_board';

export const OFF_BOARD_LABEL = 'Off the board';

export interface BriefPipelineStage {
  readonly key: EditorStageKey | typeof OFF_BOARD_KEY;
  readonly label: string;
  readonly tone: ChipTone;
  readonly count: number;
}

export interface BriefPipeline {
  /** The three editor stages in their own order, then the off-board bucket. Always all four. */
  readonly stages: readonly BriefPipelineStage[];
  /** Every brief counted, so the four buckets can be checked to add up to the list above them. */
  readonly total: number;
}

/** The one field of a brief this summary reads. Structural, so a row or a view both satisfy it. */
export interface PipelineBrief {
  readonly internalStatus: string;
}

/**
 * The four buckets for a set of briefs, always all four and always in `EDITOR_STAGES` order.
 *
 * An empty set yields four zeroes rather than an empty list, so the summary keeps its shape while a
 * search narrows the page to nothing. A status this build cannot place — a key written by a newer
 * build, or the non-linear `on_hold` branch that is deliberately in neither ladder — counts as off
 * the board, which is where `editorStageOf` already puts it.
 */
export function buildBriefPipeline(briefs: readonly PipelineBrief[]): BriefPipeline {
  const counts = new Map<string, number>();
  for (const brief of briefs) {
    const key = editorStageOf(brief.internalStatus) ?? OFF_BOARD_KEY;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const stages: BriefPipelineStage[] = EDITOR_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    tone: editorStageTone(stage.key),
    count: counts.get(stage.key) ?? 0,
  }));
  stages.push({
    key: OFF_BOARD_KEY,
    label: OFF_BOARD_LABEL,
    // `editorStageTone(null)` is the muted tone: off the board is not a state anyone is waiting on.
    tone: editorStageTone(null),
    count: counts.get(OFF_BOARD_KEY) ?? 0,
  });
  return { stages, total: briefs.length };
}
