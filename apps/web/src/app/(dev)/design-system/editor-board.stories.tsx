'use client';

import { EDITOR_STAGES, editorStageLabelFor, editorStageTone } from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

import { KanbanBoard } from '@/components/views';

/**
 * The editor's board (Sprint 10; UI governance rule 4): the three stage chips in mapping order, and
 * a board with one card per stage, the first-column one carrying the Start action. The chips' tones
 * are `editorStageTone`, never a local colour; the board is the shared `KanbanBoard`.
 *
 * The first stage is named by track (action item 59), so it is shown THREE times: the neutral
 * reading a mixed column carries, and the two per-brief readings `editorStageLabelFor` produces —
 * because a reading that renders nowhere on this page is a reading nobody can review.
 */
export function EditorStageChipsStory() {
  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="editor-stage-chips">
      {EDITOR_STAGES.map((stage) => (
        <StatusChip key={stage.key} tone={editorStageTone(stage.key)} label={stage.label} />
      ))}
      <StatusChip
        tone={editorStageTone('incoming')}
        label={editorStageLabelFor('incoming', 'video')}
      />
      <StatusChip
        tone={editorStageTone('incoming')}
        label={editorStageLabelFor('incoming', 'static')}
      />
      <StatusChip tone={editorStageTone(null)} label="Off the editor board" />
    </div>
  );
}

export function EditorBoardStory() {
  return (
    <KanbanBoard
      items={[
        {
          id: 'incoming-1',
          name: 'TAS-TC1-B1-90 Minutes-Carousel-V1',
          groupValue: 'incoming',
          subtitle: 'B1-90 Minutes-Problem/Solution',
          accentTone: editorStageTone('incoming'),
          assignee: null,
          action: {
            label: 'Start',
            slot: 'story-brief-start',
            onAction: () => {
              /* story */
            },
          },
        },
        {
          id: 'editing-1',
          name: 'TAS-TS1-B2-Not Your Age-Green Screen-V1',
          groupValue: 'under_editing',
          accentTone: editorStageTone('under_editing'),
          assignee: 'Rhiannon Okafor',
        },
        {
          id: 'review-1',
          name: 'TAS-TM1-B1-Daylight-Problem/Solution-V2',
          groupValue: 'under_review',
          accentTone: editorStageTone('under_review'),
          assignee: 'Dorian Vance',
        },
      ]}
      columns={EDITOR_STAGES.map((stage) => stage.key)}
      columnLabels={Object.fromEntries(EDITOR_STAGES.map((stage) => [stage.key, stage.label]))}
      onMove={() => {
        /* story */
      }}
      demo={false}
    />
  );
}
