import { describe, expect, it } from 'vitest';

import {
  canTransitionInternal,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
} from './creative-status';
import {
  canStartBrief,
  EDITOR_STAGE_KEYS,
  EDITOR_STAGES,
  editorStageLabel,
  editorStageOf,
  editorStageTone,
  startedStatusFor,
} from './editor-board';

describe('editor board stages', () => {
  it('maps every internal status of both tracks to a stage or off the board', () => {
    for (const entry of [...INTERNAL_VIDEO_STATUS, ...INTERNAL_STATIC_STATUS]) {
      const stage = editorStageOf(entry.key);
      if (entry.key === 'approved' || entry.key === 'launched') {
        expect(stage, entry.key).toBeNull();
      } else {
        expect(stage, entry.key).not.toBeNull();
        expect(EDITOR_STAGE_KEYS).toContain(stage);
      }
    }
    expect(editorStageOf('on_hold')).toBeNull();
    expect(editorStageOf('nonsense')).toBeNull();
  });

  it('reads the three stages in order, by key, the way the mapping states', () => {
    expect(editorStageOf('sent_to_video_editor')).toBe('incoming');
    expect(editorStageOf('sent_to_designer')).toBe('incoming');
    expect(editorStageOf('video_editing_in_progress')).toBe('under_editing');
    expect(editorStageOf('static_design_in_progress')).toBe('under_editing');
    expect(editorStageOf('videos_revisions')).toBe('under_editing');
    expect(editorStageOf('images_revisions')).toBe('under_editing');
    expect(editorStageOf('ad_submitted')).toBe('under_review');
    expect(editorStageOf('revisions_submitted')).toBe('under_review');
    expect(EDITOR_STAGE_KEYS).toEqual(['incoming', 'under_editing', 'under_review']);
    expect(editorStageTone('incoming')).toBe('info');
    expect(editorStageTone(null)).toBe('mute');
  });

  /**
   * AI-59. The wording an editor reads changed and the stored value did not: the heading says
   * "Sent to Editor/Designer", the key stays `incoming` because it is the Kanban group value, the
   * `?group=editorStage` URL value and the `data-stage` attribute. Both halves are asserted here
   * so a future rename cannot quietly take the key with it.
   */
  it('labels the first stage "Sent to Editor/Designer" while its key stays incoming', () => {
    expect(editorStageLabel('incoming')).toBe('Sent to Editor/Designer');
    expect(editorStageLabel('under_editing')).toBe('Under Editing');
    expect(editorStageLabel('under_review')).toBe('Under Review');
    expect(EDITOR_STAGES[0].key).toBe('incoming');
    expect(editorStageOf('sent_to_video_editor')).toBe('incoming');
    expect(editorStageOf('sent_to_designer')).toBe('incoming');
    // No label is a status key, and no key is a label: the two vocabularies never cross.
    for (const stage of EDITOR_STAGES) {
      expect(stage.label).not.toBe(stage.key);
    }
  });

  it('Start acts on the incoming stage only and lands on the step the state machine allows', () => {
    expect(canStartBrief('sent_to_video_editor')).toBe(true);
    expect(canStartBrief('video_editing_in_progress')).toBe(false);
    expect(startedStatusFor('video')).toBe('video_editing_in_progress');
    expect(startedStatusFor('static')).toBe('static_design_in_progress');
    expect(canTransitionInternal('video', 'sent_to_video_editor', startedStatusFor('video'))).toBe(
      true,
    );
    expect(canTransitionInternal('static', 'sent_to_designer', startedStatusFor('static'))).toBe(
      true,
    );
    expect(editorStageOf(startedStatusFor('video'))).toBe('under_editing');
  });
});
