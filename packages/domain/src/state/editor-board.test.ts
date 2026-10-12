import { describe, expect, it } from 'vitest';

import { INTERNAL_STATUS, canTransitionInternal } from './creative-status';
import {
  EDITOR_STAGE_KEYS,
  EDITOR_STAGES,
  EDITOR_STARTED_STATUS,
  canStartBrief,
  editorStageLabel,
  editorStageMoveTarget,
  editorStageOf,
  editorStageTone,
} from './editor-board';

describe('editor board stages', () => {
  it('maps every internal status to a stage or off the board', () => {
    for (const entry of INTERNAL_STATUS) {
      const stage = editorStageOf(entry.key);
      if (entry.key === 'approved' || entry.key === 'draft') {
        expect(stage, entry.key).toBeNull();
      } else {
        expect(stage, entry.key).not.toBeNull();
        expect(EDITOR_STAGE_KEYS).toContain(stage);
      }
    }
    // The retired keys (0067) are off the board like any unknown value.
    for (const retired of ['on_hold', 'launched', 'sent_to_video_editor', 'videos_revisions']) {
      expect(editorStageOf(retired), retired).toBeNull();
    }
    expect(editorStageOf('nonsense')).toBeNull();
  });

  it('reads the three stages in order, by key, the way the mapping states', () => {
    expect(editorStageOf('sent_to_editor_or_designer')).toBe('incoming');
    expect(editorStageOf('under_editing_or_designing')).toBe('under_editing');
    expect(editorStageOf('revisions_needed')).toBe('under_editing');
    expect(editorStageOf('ad_submitted')).toBe('under_review');
    expect(editorStageOf('revisions_submitted')).toBe('under_review');
    expect(EDITOR_STAGE_KEYS).toEqual(['incoming', 'under_editing', 'under_review']);
    expect(editorStageTone('incoming')).toBe('info');
    expect(editorStageTone(null)).toBe('mute');
  });

  /**
   * AI-59. The wording an editor reads and the stored value are two things: the heading says
   * "Sent to Editor/Designer", the key stays `incoming` because it is the Kanban group value, the
   * `?group=editorStage` URL value and the `data-stage` attribute. Both halves are asserted here
   * so a future rename cannot quietly take the key with it.
   */
  it('labels the first stage "Sent to Editor/Designer" while its key stays incoming', () => {
    expect(editorStageLabel('incoming')).toBe('Sent to Editor/Designer');
    expect(editorStageLabel('under_editing')).toBe('Under Editing');
    expect(editorStageLabel('under_review')).toBe('Under Review');
    expect(EDITOR_STAGES[0].key).toBe('incoming');
    expect(editorStageOf('sent_to_editor_or_designer')).toBe('incoming');
    // No label is a status key, and no key is a label: the two vocabularies never cross.
    for (const stage of EDITOR_STAGES) {
      expect(stage.label).not.toBe(stage.key);
    }
  });

  it('Start acts on the incoming stage only and lands on the step the state machine allows', () => {
    expect(canStartBrief('sent_to_editor_or_designer')).toBe(true);
    expect(canStartBrief('under_editing_or_designing')).toBe(false);
    expect(canStartBrief('draft')).toBe(false);
    expect(EDITOR_STARTED_STATUS).toBe('under_editing_or_designing');
    expect(canTransitionInternal('sent_to_editor_or_designer', EDITOR_STARTED_STATUS)).toBe(true);
    expect(editorStageOf(EDITOR_STARTED_STATUS)).toBe('under_editing');
  });

  describe('a drop between the columns', () => {
    it('Incoming → Under Editing is Start, for a video and a static brief alike', () => {
      expect(editorStageMoveTarget('sent_to_editor_or_designer', 'under_editing')).toBe(
        'under_editing_or_designing',
      );
    });

    it('Under Editing → Under Review submits, or resubmits after revisions', () => {
      expect(editorStageMoveTarget('under_editing_or_designing', 'under_review')).toBe(
        'ad_submitted',
      );
      expect(editorStageMoveTarget('revisions_needed', 'under_review')).toBe('revisions_submitted');
    });

    it('refuses a backwards drop, a skipped column, the same column and a brief off the board', () => {
      // Backwards.
      expect(editorStageMoveTarget('ad_submitted', 'under_editing')).toBeNull();
      expect(editorStageMoveTarget('under_editing_or_designing', 'incoming')).toBeNull();
      // Skipping Under Editing.
      expect(editorStageMoveTarget('sent_to_editor_or_designer', 'under_review')).toBeNull();
      // The same column.
      expect(editorStageMoveTarget('sent_to_editor_or_designer', 'incoming')).toBeNull();
      expect(editorStageMoveTarget('revisions_needed', 'under_editing')).toBeNull();
      // Off the board, and not a status at all.
      expect(editorStageMoveTarget('draft', 'under_editing')).toBeNull();
      expect(editorStageMoveTarget('approved', 'under_editing')).toBeNull();
      expect(editorStageMoveTarget('launched', 'under_review')).toBeNull();
      expect(editorStageMoveTarget('on_hold', 'under_review')).toBeNull();
      expect(editorStageMoveTarget('nonsense', 'under_editing')).toBeNull();
    });

    it('only ever returns a status the transition table allows from the current one', () => {
      for (const entry of INTERNAL_STATUS) {
        for (const stage of EDITOR_STAGE_KEYS) {
          const next = editorStageMoveTarget(entry.key, stage);
          if (next !== null) {
            expect(canTransitionInternal(entry.key, next), `${entry.key} → ${stage}`).toBe(true);
            expect(editorStageOf(next)).toBe(stage);
          }
        }
      }
    });
  });
});
