import { describe, expect, it } from 'vitest';

import {
  canTransitionInternal,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
} from './creative-status';
import {
  canStartBrief,
  EDITOR_STAGE_KEYS,
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

  it('reads Incoming → Under Editing → Under Review the way the mapping states', () => {
    expect(editorStageOf('sent_to_video_editor')).toBe('incoming');
    expect(editorStageOf('sent_to_designer')).toBe('incoming');
    expect(editorStageOf('video_editing_in_progress')).toBe('under_editing');
    expect(editorStageOf('static_design_in_progress')).toBe('under_editing');
    expect(editorStageOf('videos_revisions')).toBe('under_editing');
    expect(editorStageOf('images_revisions')).toBe('under_editing');
    expect(editorStageOf('ad_submitted')).toBe('under_review');
    expect(editorStageOf('revisions_submitted')).toBe('under_review');
    expect(EDITOR_STAGE_KEYS).toEqual(['incoming', 'under_editing', 'under_review']);
    expect(editorStageLabel('under_review')).toBe('Under Review');
    expect(editorStageTone('incoming')).toBe('info');
    expect(editorStageTone(null)).toBe('mute');
  });

  it('Start acts on Incoming only and lands on the track step the state machine allows', () => {
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
