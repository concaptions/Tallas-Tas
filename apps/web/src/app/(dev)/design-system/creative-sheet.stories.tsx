'use client';

import type { CreativeSheetItemListRow } from '@tas/db';
import { StatusChip } from '@tas/ui';

import {
  CREATIVE_SHEET_COLUMNS,
  QaTicks,
  Tick,
  type SheetItemView,
} from '@/app/app/creative-sheet/creative-sheet-workspace';
import {
  INTERNAL_STATUS_OPTIONS,
  SHEET_LABELS,
  STATUS_OPTIONS,
  WINNING_OPTIONS,
  type SheetStatusView,
} from '@/app/app/creative-sheet/fields';
import { AirtableGrid } from '@/components/views/airtable-grid';

/**
 * The three shapes the Creative Sheet route introduces, mounted as the product mounts them
 * (CLAUDE.md UI governance rule 4): the grid with its generated `font-mono` name, the three select
 * vocabularies as chips, and the tick glyphs the Used and QA columns are drawn with.
 *
 * Nothing is re-drawn here. The columns are the route's own `CREATIVE_SHEET_COLUMNS`, every chip
 * tone comes from the route's `fields.ts` views, and the rows are plain objects in the `@tas/db`
 * row shape so this client module never imports the database package itself (a type import is
 * erased). The three rows are the demo fixtures' first three, restated by hand for that reason.
 */
const AT = new Date('2026-10-01T08:00:00.000Z');

function sampleRow(
  overrides: Partial<CreativeSheetItemListRow> & Pick<CreativeSheetItemListRow, 'id' | 'name'>,
): CreativeSheetItemListRow {
  return {
    brandId: 'ds-brand',
    createdAt: AT,
    updatedAt: AT,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    legacyAirtableId: null,
    templateRowId: null,
    overriddenFields: [],
    customFields: {},
    briefId: null,
    briefName: null,
    briefType: null,
    briefPlatform: [],
    briefFunnel: null,
    briefPerformance: null,
    briefDesignFileUrl: null,
    internalStatus: null,
    status: null,
    qaChecklistDoc: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    clientComments: null,
    used: false,
    deniedRevisionsNeeded: false,
    winning: null,
    spellCheckRequested: false,
    spellingFeedback: null,
    ...overrides,
  };
}

const SAMPLE_ROWS: readonly SheetItemView[] = [
  {
    item: sampleRow({
      id: 'ds-sheet-1',
      name: 'October-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
      briefName: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
      internalStatus: 'approved',
      status: 'pending_for_approval',
      qaVideoEditor: true,
      qaDesigner: true,
      qaStrategist: true,
    }),
    updatedLabel: '2h ago',
    updatedTitle: '1 Oct 2026, 09:30',
  },
  {
    item: sampleRow({
      id: 'ds-sheet-2',
      name: 'October',
      internalStatus: 'sent_to_designer',
    }),
    updatedLabel: '4h ago',
    updatedTitle: '1 Oct 2026, 07:05',
  },
  {
    item: sampleRow({
      id: 'ds-sheet-3',
      name: 'September-RS1-B4-NIGHT RESET BUNDLE-V3',
      briefName: 'RS1-B4-NIGHT RESET BUNDLE-V3',
      internalStatus: 'approved',
      status: 'approved',
      winning: 'average',
      used: true,
      qaDesigner: true,
      qaStrategist: true,
    }),
    updatedLabel: '3d ago',
    updatedTitle: '28 Sep 2026, 16:40',
  },
];

/** The grid: frozen mono name, brief, three chips, one tick and three ticks; a null status dashes. */
export function CreativeSheetGridStory() {
  return (
    <AirtableGrid
      tableKey="creative-sheet-story"
      columns={CREATIVE_SHEET_COLUMNS}
      rows={SAMPLE_ROWS}
      rowId={({ item }) => item.id}
      rowLabel={({ item }) => item.name}
      tableSlot="creative-sheet-story-table"
    />
  );
}

/** The three vocabularies, each under the label the panel gives its select. */
const VOCABULARIES: readonly { title: string; options: readonly SheetStatusView[] }[] = [
  { title: SHEET_LABELS.internalStatus, options: INTERNAL_STATUS_OPTIONS },
  { title: SHEET_LABELS.status, options: STATUS_OPTIONS },
  { title: SHEET_LABELS.winning, options: WINNING_OPTIONS },
];

/** The three vocabularies as chips, in vocabulary order, each with the tone `fields.ts` gives it. */
export function CreativeSheetChipsStory() {
  return (
    <div className="flex flex-col gap-3">
      {VOCABULARIES.map(({ title, options }) => (
        <div key={title} className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">{title}</span>
          <div className="flex flex-wrap items-center gap-2">
            {options.map((option) => (
              <StatusChip key={option.key} tone={option.tone} label={option.label} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The tick glyphs: one Used tick each way, then the QA cell at none, some and all. */
export function CreativeSheetTicksStory() {
  const none = sampleRow({ id: 'ds-ticks-0', name: 'none' });
  const some = sampleRow({ id: 'ds-ticks-1', name: 'some', qaVideoEditor: true, qaDesigner: true });
  const all = sampleRow({
    id: 'ds-ticks-2',
    name: 'all',
    qaVideoEditor: true,
    qaDesigner: true,
    qaStrategist: true,
  });
  return (
    <div className="flex flex-wrap items-center gap-6 text-sm">
      <span className="flex items-center gap-2">
        <Tick on label="Used" />
        <Tick on={false} label="Used" />
        <span className="text-xs text-text3">Used, then not used</span>
      </span>
      <span className="flex items-center gap-3">
        <QaTicks item={none} />
        <QaTicks item={some} />
        <QaTicks item={all} />
        <span className="text-xs text-text3">QA: none, two of three, all three</span>
      </span>
    </div>
  );
}
