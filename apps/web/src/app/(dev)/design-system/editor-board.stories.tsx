'use client';

import { useMemo } from 'react';
import { EDITOR_STAGES, editorStageTone } from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

import {
  editorBoardItems,
  offBoardLabel,
  type EditorBoardBrief,
  type EditorBoardSheetRow,
} from '@/app/app/creative-sheet/editor-board';
import { kanbanColumnsFor } from '@/app/app/creative-sheet/fields';
import { KanbanBoard } from '@/components/views';

/**
 * The editor's board (Sprint 10; UI governance rule 4), as the Creative Sheet mounts it under
 * "Editing stage" since 2026-10-09: the three stage chips in mapping order, and the cards built by
 * the route's own `editorBoardItems` over fixture-shaped briefs and sheet rows — a card is a brief,
 * its subtitle the sheet rows linked to it, Start on the Incoming one — followed by the off-board
 * line. The chips' tones are `editorStageTone`, never a local colour; the board is the shared
 * `KanbanBoard`; the columns are `kanbanColumnsFor('editorStage')`.
 */
export function EditorStageChipsStory() {
  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="editor-stage-chips">
      {EDITOR_STAGES.map((stage) => (
        <StatusChip key={stage.key} tone={editorStageTone(stage.key)} label={stage.label} />
      ))}
      <StatusChip tone={editorStageTone(null)} label="Off the editor board" />
    </div>
  );
}

const BRIEFS: readonly EditorBoardBrief[] = [
  {
    id: 'incoming-1',
    name: 'TAS-TC1-B1-90 Minutes-Carousel-V1',
    internalStatus: 'sent_to_designer',
    type: 'Carousel',
    priority: 'Video Average',
    assignee: null,
  },
  {
    id: 'editing-1',
    name: 'TAS-TS1-B2-Not Your Age-Green Screen-V1',
    internalStatus: 'static_design_in_progress',
    type: 'Static',
    priority: 'Static Average',
    assignee: 'Rhiannon Okafor',
  },
  {
    id: 'review-1',
    name: 'TAS-TM1-B1-Daylight-Problem/Solution-V2',
    internalStatus: 'ad_submitted',
    type: 'Motion Image',
    priority: 'Video High',
    assignee: 'Dorian Vance',
  },
  {
    id: 'approved-1',
    name: 'TAS-TV1-B1-Your Body Clock Is Not Broken-V2',
    internalStatus: 'approved',
    type: 'Video',
    priority: 'Video High',
    assignee: 'Dorian Vance',
  },
];

const SHEET_ROWS: readonly EditorBoardSheetRow[] = [
  { id: 'row-1', name: 'September-TAS-TM1-B1-Daylight-Problem/Solution-V2', briefId: 'review-1' },
  { id: 'row-2', name: 'October-TAS-TS1-B2-Not Your Age-Green Screen-V1', briefId: 'editing-1' },
];

const COLUMNS = kanbanColumnsFor('editorStage');
const COLUMN_LABELS = Object.fromEntries(COLUMNS.map((column) => [column.key, column.label]));

export function EditorBoardStory() {
  const board = useMemo(
    () =>
      editorBoardItems(BRIEFS, SHEET_ROWS, false, () => {
        /* story */
      }),
    [],
  );
  return (
    <div className="flex flex-col gap-2">
      <KanbanBoard
        items={board.items}
        columns={COLUMNS.map((column) => column.key)}
        columnLabels={COLUMN_LABELS}
        onMove={() => {
          /* story */
        }}
        demo={false}
      />
      <p className="text-xs text-text3" data-slot="story-brief-off-board">
        {offBoardLabel(board.offBoardBriefs, board.unlinkedSheetRows)}
      </p>
    </div>
  );
}
