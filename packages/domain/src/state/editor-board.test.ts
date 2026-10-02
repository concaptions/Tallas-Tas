import { describe, expect, it } from 'vitest';

import {
  canTransitionInternal,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
} from './creative-status';
import {
  canStartBrief,
  EDITOR_STAGE_KEYS,
  editorStageColumnLabel,
  editorStageLabel,
  editorStageLabelFor,
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

  it('reads first → Under Editing → Under Review the way the mapping states', () => {
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
});

/**
 * Action item 59: the first column is named for whoever is waiting on the brief, and that depends
 * on the track. The stored keys must not move — the board is a view of `internal_status` — so these
 * assertions pin the WORDS against the unchanged keys.
 */
describe('the first stage is named by track (action item 59)', () => {
  it('reads "Sent to Editor" on the video track and "Sent to Designer" on the static one', () => {
    expect(editorStageLabelFor('incoming', 'video')).toBe('Sent to Editor');
    expect(editorStageLabelFor('incoming', 'static')).toBe('Sent to Designer');
  });

  it('leaves the stages that do not vary by track reading the same on both', () => {
    for (const track of ['video', 'static'] as const) {
      expect(editorStageLabelFor('under_editing', track)).toBe('Under Editing');
      expect(editorStageLabelFor('under_review', track)).toBe('Under Review');
    }
  });

  it('never renames a stored status: both first-stage keys still map to the first stage', () => {
    expect(editorStageOf('sent_to_video_editor')).toBe('incoming');
    expect(editorStageOf('sent_to_designer')).toBe('incoming');
    expect(EDITOR_STAGE_KEYS[0]).toBe('incoming');
  });

  it('labels a column by the one track in it, and says both when it holds both', () => {
    expect(editorStageColumnLabel('incoming', ['video'])).toBe('Sent to Editor');
    expect(editorStageColumnLabel('incoming', ['static', 'static'])).toBe('Sent to Designer');
    expect(editorStageColumnLabel('incoming', ['video', 'static'])).toBe(
      'Sent to Editor / Designer',
    );
  });

  it('falls back to the neutral label for an empty column, which has no track to read', () => {
    expect(editorStageColumnLabel('incoming', [])).toBe('Sent to Editor / Designer');
    expect(editorStageColumnLabel('incoming', [])).toBe(editorStageLabel('incoming'));
    expect(editorStageColumnLabel('under_editing', [])).toBe('Under Editing');
  });
});

describe('the Start button', () => {
  it('acts on the first stage only and lands on the track step the state machine allows', () => {
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
