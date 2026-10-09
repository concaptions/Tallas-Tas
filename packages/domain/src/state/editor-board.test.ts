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
  editorStageMoveTarget,
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

  describe('a drop between the columns', () => {
    it('Incoming → Under Editing is Start on both tracks', () => {
      expect(editorStageMoveTarget('sent_to_video_editor', 'video', 'under_editing')).toBe(
        'video_editing_in_progress',
      );
      expect(editorStageMoveTarget('sent_to_designer', 'static', 'under_editing')).toBe(
        'static_design_in_progress',
      );
    });

    it('Under Editing → Under Review submits, or resubmits after revisions', () => {
      expect(editorStageMoveTarget('video_editing_in_progress', 'video', 'under_review')).toBe(
        'ad_submitted',
      );
      expect(editorStageMoveTarget('static_design_in_progress', 'static', 'under_review')).toBe(
        'ad_submitted',
      );
      expect(editorStageMoveTarget('videos_revisions', 'video', 'under_review')).toBe(
        'revisions_submitted',
      );
      expect(editorStageMoveTarget('images_revisions', 'static', 'under_review')).toBe(
        'revisions_submitted',
      );
    });

    it('refuses a backwards drop, a skipped column, the same column and a brief off the board', () => {
      // Backwards.
      expect(editorStageMoveTarget('ad_submitted', 'video', 'under_editing')).toBeNull();
      expect(editorStageMoveTarget('video_editing_in_progress', 'video', 'incoming')).toBeNull();
      // Skipping Under Editing.
      expect(editorStageMoveTarget('sent_to_video_editor', 'video', 'under_review')).toBeNull();
      // The same column.
      expect(editorStageMoveTarget('sent_to_designer', 'static', 'incoming')).toBeNull();
      expect(editorStageMoveTarget('videos_revisions', 'video', 'under_editing')).toBeNull();
      // Off the board, and not a status at all.
      expect(editorStageMoveTarget('approved', 'video', 'under_editing')).toBeNull();
      expect(editorStageMoveTarget('launched', 'static', 'under_review')).toBeNull();
      expect(editorStageMoveTarget('on_hold', 'video', 'under_review')).toBeNull();
      expect(editorStageMoveTarget('nonsense', 'video', 'under_editing')).toBeNull();
      // A status from the other track is not on this ladder.
      expect(editorStageMoveTarget('sent_to_designer', 'video', 'under_editing')).toBeNull();
    });

    it('only ever returns a status the transition table allows from the current one', () => {
      const tracks = ['video', 'static'] as const;
      for (const track of tracks) {
        for (const entry of track === 'video' ? INTERNAL_VIDEO_STATUS : INTERNAL_STATIC_STATUS) {
          for (const stage of EDITOR_STAGE_KEYS) {
            const next = editorStageMoveTarget(entry.key, track, stage);
            if (next !== null) {
              expect(canTransitionInternal(track, entry.key, next), `${entry.key} → ${stage}`).toBe(
                true,
              );
              expect(editorStageOf(next)).toBe(stage);
            }
          }
        }
      }
    });
  });
});
