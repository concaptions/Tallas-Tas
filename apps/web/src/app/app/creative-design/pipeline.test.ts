import { demoBriefs } from '@tas/db';
import { EDITOR_STAGES } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { buildBriefPipeline, OFF_BOARD_KEY, OFF_BOARD_LABEL } from './pipeline';

function briefs(...statuses: readonly string[]): readonly { readonly internalStatus: string }[] {
  return statuses.map((internalStatus) => ({ internalStatus }));
}

describe('buildBriefPipeline', () => {
  it('is the three editor stages in their own order, then the off-board bucket', () => {
    const { stages } = buildBriefPipeline([]);

    expect(stages.map((stage) => stage.key)).toEqual([
      ...EDITOR_STAGES.map((stage) => stage.key),
      OFF_BOARD_KEY,
    ]);
    expect(stages.map((stage) => stage.label)).toEqual([
      ...EDITOR_STAGES.map((stage) => stage.label),
      OFF_BOARD_LABEL,
    ]);
  });

  it('keeps all four buckets at zero for an empty page rather than returning nothing', () => {
    const pipeline = buildBriefPipeline([]);

    expect(pipeline.stages.map((stage) => stage.count)).toEqual([0, 0, 0, 0]);
    expect(pipeline.total).toBe(0);
  });

  it('counts each brief into the stage its stored status sits in', () => {
    const { stages } = buildBriefPipeline(
      briefs(
        'sent_to_video_editor',
        'sent_to_designer',
        'video_editing_in_progress',
        'images_revisions',
        'ad_submitted',
      ),
    );

    expect(stages.map((stage) => [stage.key, stage.count])).toEqual([
      ['incoming', 2],
      ['under_editing', 2],
      ['under_review', 1],
      [OFF_BOARD_KEY, 0],
    ]);
  });

  it('counts approved, launched and on hold as off the board, never as a stage', () => {
    const { stages } = buildBriefPipeline(briefs('approved', 'launched', 'on_hold'));

    expect(stages.find((stage) => stage.key === OFF_BOARD_KEY)?.count).toBe(3);
    for (const stage of EDITOR_STAGES) {
      expect(stages.find((entry) => entry.key === stage.key)?.count).toBe(0);
    }
  });

  it('counts a status this build cannot place as off the board rather than dropping it', () => {
    const pipeline = buildBriefPipeline(briefs('sent_to_nobody', ''));

    expect(pipeline.stages.find((stage) => stage.key === OFF_BOARD_KEY)?.count).toBe(2);
    expect(pipeline.total).toBe(2);
  });

  it('adds up: the four buckets are every brief handed in, never more and never fewer', () => {
    const pipeline = buildBriefPipeline(demoBriefs);

    expect(pipeline.stages.reduce((sum, stage) => sum + stage.count, 0)).toBe(demoBriefs.length);
    expect(pipeline.total).toBe(demoBriefs.length);
  });

  it('takes every tone from EDITOR_STAGES, so the summary and the board cannot disagree', () => {
    const { stages } = buildBriefPipeline([]);

    expect(stages.map((stage) => stage.tone)).toEqual([
      ...EDITOR_STAGES.map((stage) => stage.tone),
      'mute',
    ]);
  });
});
