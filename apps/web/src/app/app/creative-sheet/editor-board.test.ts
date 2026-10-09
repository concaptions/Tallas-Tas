import { DEMO_WRITE_HINT } from '@tas/ui';
import { describe, expect, it, vi } from 'vitest';

import { briefStageView, internalStatusView } from '@/app/app/creative-design/fields';
import { briefPath } from '@/lib/routes';

import {
  editorBoardItems,
  NO_SHEET_ROW,
  offBoardLabel,
  type EditorBoardBrief,
  type EditorBoardSheetRow,
} from './editor-board';

const INCOMING: EditorBoardBrief = {
  id: '77777777-7777-4777-8777-000000000006',
  name: 'TC1-B1-90 Minutes-Problem/Solution-V1',
  internalStatus: 'sent_to_video_editor',
  type: 'Video',
  priority: 'Video Average',
  assignee: 'Imogen Bardsley',
};

const EDITING: EditorBoardBrief = {
  id: '77777777-7777-4777-8777-000000000002',
  name: 'TS1-B2-Not Your Age-Green Screen-V1',
  internalStatus: 'static_design_in_progress',
  type: 'Static',
  priority: null,
  assignee: 'Rhiannon Okafor',
};

const REVIEW: EditorBoardBrief = {
  id: '77777777-7777-4777-8777-000000000003',
  name: 'TM1-B1-Daylight-Problem/Solution-V2',
  internalStatus: 'ad_submitted',
  type: 'Motion Image',
  priority: 'Video High',
  assignee: 'Dorian Vance',
};

const APPROVED: EditorBoardBrief = { ...REVIEW, id: 'approved-1', internalStatus: 'approved' };
const LAUNCHED: EditorBoardBrief = { ...REVIEW, id: 'launched-1', internalStatus: 'launched' };

const SHEET_ROWS: readonly EditorBoardSheetRow[] = [
  { id: 'row-1', name: 'September-TM1-B1-Daylight-Problem/Solution-V2', briefId: REVIEW.id },
  { id: 'row-2', name: 'October-TM1-B1-Daylight-Problem/Solution-V2', briefId: REVIEW.id },
  { id: 'row-4', name: 'October-approved', briefId: APPROVED.id },
];

describe('editorBoardItems', () => {
  it('makes one card per brief on the board, keyed by the BRIEF id, grouped by its stage', () => {
    const { items } = editorBoardItems([INCOMING, EDITING, REVIEW], SHEET_ROWS, false, vi.fn());

    expect(items.map((item) => item.id)).toEqual([INCOMING.id, EDITING.id, REVIEW.id]);
    expect(items.map((item) => item.groupValue)).toEqual([
      'incoming',
      'under_editing',
      'under_review',
    ]);
    expect(items.map((item) => item.href)).toEqual([
      briefPath(INCOMING.id),
      briefPath(EDITING.id),
      briefPath(REVIEW.id),
    ]);
  });

  it('subtitles a card with its linked sheet rows, or says there is none yet', () => {
    const { items } = editorBoardItems([INCOMING, REVIEW], SHEET_ROWS, false, vi.fn());

    expect(items[0]?.subtitle).toBe(NO_SHEET_ROW);
    expect(items[1]?.subtitle).toBe(
      'September-TM1-B1-Daylight-Problem/Solution-V2, October-TM1-B1-Daylight-Problem/Solution-V2',
    );
  });

  it('counts the creatives that are off the board and the sheet rows with no creative', () => {
    const result = editorBoardItems(
      [INCOMING, APPROVED, LAUNCHED, REVIEW],
      SHEET_ROWS,
      false,
      vi.fn(),
    );

    expect(result.items).toHaveLength(2);
    expect(result.offBoardBriefs).toBe(2);
    // Since the single-source cutover every sheet row is a brief, so this is always zero.
    expect(result.unlinkedSheetRows).toBe(0);
  });

  it('puts Start on the Incoming card only, disabled with the hint in demo mode', () => {
    const onStart = vi.fn();
    const { items } = editorBoardItems([INCOMING, EDITING, REVIEW], [], false, onStart);

    expect(items[1]?.action).toBeUndefined();
    expect(items[2]?.action).toBeUndefined();
    const start = items[0]?.action;
    expect(start?.label).toBe('Start');
    expect(start?.slot).toBe('brief-start');
    expect(start?.disabled).toBe(false);
    start?.onAction();
    expect(onStart).toHaveBeenCalledWith(INCOMING.id);

    const demo = editorBoardItems([INCOMING], [], true, vi.fn());
    expect(demo.items[0]?.action?.disabled).toBe(true);
    expect(demo.items[0]?.action?.hint).toBe(DEMO_WRITE_HINT);
  });

  it('reads the chip from the internal status and the stripe from the stage, never a local colour', () => {
    const { items } = editorBoardItems([INCOMING, EDITING, REVIEW], [], false, vi.fn());

    for (const [index, brief] of [INCOMING, EDITING, REVIEW].entries()) {
      const stage = briefStageView(brief.internalStatus);
      const status = internalStatusView(
        brief.type === 'Static' ? 'static' : 'video',
        brief.internalStatus,
      );
      expect(items[index]?.accentTone).toBe(stage?.tone);
      expect(items[index]?.chipLabel).toBe(status.label);
      expect(items[index]?.chipTone).toBe(status.tone);
    }
    expect(items[0]?.chipLabel).toBe('Sent to Video Editor');
    expect(items[0]?.assignee).toBe('Imogen Bardsley');
    expect(items[0]?.badges?.map((badge) => badge.label)).toEqual(['Video Average', 'Video']);
    expect(items[1]?.badges?.map((badge) => badge.label)).toEqual(['Static']);
  });
});

describe('offBoardLabel', () => {
  it('counts both, singular at one', () => {
    expect(offBoardLabel(4, 1)).toBe(
      '4 creatives off the board (approved, launched or on hold) · 1 sheet row with no creative',
    );
    expect(offBoardLabel(1, 0)).toBe(
      '1 creative off the board (approved, launched or on hold) · 0 sheet rows with no creative',
    );
  });
});
