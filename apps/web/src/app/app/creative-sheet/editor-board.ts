import type { CreativeSheetItemListRow } from '@tas/db';
import { creativeTrack } from '@tas/domain/creatives';
import { canStartBrief, type InternalStatusKey } from '@tas/domain/state';
import { DEMO_WRITE_HINT } from '@tas/ui';

import {
  briefStageView,
  creativeTypeLabel,
  internalStatusView,
  priorityView,
} from '@/app/app/creative-design/fields';
import type { KanbanItem } from '@/components/views';
import { briefPath } from '@/lib/routes';

/**
 * The editor's board as a grouping of the Creative Sheet's Kanban view (Sep 28 rule: Kanban only
 * where the lanes ARE the briefs workflow; re-homed from the retired Creative Design list on
 * 2026-10-09). The columns are `EDITOR_STAGES`, the status source is
 * `creative_briefs.internal_status` read through `editorStageOf`, and A CARD IS A BRIEF — its id is
 * the brief id, its subtitle the sheet rows linked to it — so a brief with no sheet row yet is on
 * the board exactly as it was before. `creative_sheet_items.internal_status` is never read here.
 *
 * Pure, so the `/design-system` story and the test render the same cards the page does; the only
 * callback is Start's, handed in by the workspace.
 */

/** What the board reads from a brief: `BriefRow`'s identity, status, type and the two card lines. */
export interface EditorBoardBrief {
  readonly id: string;
  readonly name: string;
  readonly internalStatus: InternalStatusKey;
  readonly type: string;
  readonly priority: string | null;
  readonly assignee: string | null;
}

/** What the board reads from a sheet row: which brief it links to, and the generated name. */
export type EditorBoardSheetRow = Pick<CreativeSheetItemListRow, 'id' | 'name' | 'briefId'>;

export interface EditorBoardItems {
  readonly items: readonly KanbanItem[];
  /** Briefs whose stage is null — approved, launched, on hold — and so not on the board. */
  readonly offBoardBriefs: number;
  /** Sheet rows with `brief_id = null`: no brief, so no card to sit under. */
  readonly unlinkedSheetRows: number;
}

/** The subtitle of a brief no sheet row links to yet. */
export const NO_SHEET_ROW = 'No sheet row yet';

export const START_LABEL = 'Start';

/** The names of the sheet rows linked to each brief, in the order the sheet lists them. */
function sheetNamesByBrief(rows: readonly EditorBoardSheetRow[]): ReadonlyMap<string, string[]> {
  const names = new Map<string, string[]>();
  for (const row of rows) {
    const list = names.get(row.briefId) ?? [];
    list.push(row.name);
    names.set(row.briefId, list);
  }
  return names;
}

export function editorBoardItems(
  briefs: readonly EditorBoardBrief[],
  sheetRows: readonly EditorBoardSheetRow[],
  demo: boolean,
  onStart: (briefId: string) => void,
): EditorBoardItems {
  const linked = sheetNamesByBrief(sheetRows);
  const items: KanbanItem[] = [];
  let offBoardBriefs = 0;

  for (const brief of briefs) {
    const stage = briefStageView(brief.internalStatus);
    if (stage === null) {
      offBoardBriefs += 1;
      continue;
    }
    const status = internalStatusView(creativeTrack(brief.type), brief.internalStatus);
    const priority = priorityView(brief.priority);
    const names = linked.get(brief.id) ?? [];
    items.push({
      id: brief.id,
      name: brief.name,
      groupValue: stage.key,
      subtitle: names.length === 0 ? NO_SHEET_ROW : names.join(', '),
      chipLabel: status.label,
      chipTone: status.tone,
      accentTone: stage.tone,
      assignee: brief.assignee,
      badges: [
        ...(priority === null ? [] : [{ label: priority.label, tone: priority.tone }]),
        { label: creativeTypeLabel(brief.type), tone: 'mute' },
      ],
      href: briefPath(brief.id),
      ...(canStartBrief(brief.internalStatus)
        ? {
            action: {
              label: START_LABEL,
              slot: 'brief-start',
              disabled: demo,
              hint: DEMO_WRITE_HINT,
              onAction: () => {
                onStart(brief.id);
              },
            },
          }
        : {}),
    });
  }

  return {
    items,
    offBoardBriefs,
    // Every sheet row is a brief since the single-source cutover, so none is unlinked. Kept so
    // the footer line keeps its shape.
    unlinkedSheetRows: 0,
  };
}

/** The one line under the board that accounts for what is not on it. Singular at one. */
export function offBoardLabel(offBoardBriefs: number, unlinkedSheetRows: number): string {
  const briefs = `${String(offBoardBriefs)} ${offBoardBriefs === 1 ? 'creative' : 'creatives'} off the board (approved, launched or on hold)`;
  const rows = `${String(unlinkedSheetRows)} sheet ${unlinkedSheetRows === 1 ? 'row' : 'rows'} with no creative`;
  return `${briefs} · ${rows}`;
}
