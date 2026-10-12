'use client';

import { useState } from 'react';
import type { CreativeSheetItemListRow } from '@tas/db';
import { Button, StatusChip } from '@tas/ui';

import { CreativeSheetPanel } from '@/app/app/creative-sheet/creative-sheet-panel';
import { DimensionsField } from '@/app/app/creative-sheet/dimensions-field';
import { FocusModeView } from '@/app/app/creative-sheet/focus-mode-view';
import {
  CREATIVE_SHEET_RENDERERS,
  QaTicks,
  Tick,
  type SheetItemView,
  type SheetLookups,
} from '@/app/app/creative-sheet/creative-sheet-workspace';
import {
  INTERNAL_STATUS_OPTIONS,
  SHEET_LABELS,
  STATUS_OPTIONS,
  type SheetStatusView,
} from '@/app/app/creative-sheet/fields';
import { RowContextMenu, SelectionBar } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { toggleAllSelected, toggleSelected } from '@/components/views/airtable-grid-logic';
import { gridColumnsFrom, type ResolvedColumnView } from '@/components/views/resolved-columns';

/**
 * The three shapes the Creative Sheet route introduces, mounted as the product mounts them
 * (CLAUDE.md UI governance rule 4): the grid with its generated `font-mono` name, the three select
 * vocabularies as chips, and the tick glyphs the QA columns are drawn with.
 *
 * Nothing is re-drawn here. The columns are joined from the route's own registry, every chip
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
    legacyAirtableId: null,
    briefId: overrides.id,
    briefName: null,
    briefType: null,
    briefPlatform: [],
    briefFunnel: null,
    briefPerformance: null,
    briefDesignFileUrl: null,
    internalStatus: 'sent_to_video_editor',
    status: 'pending_for_approval',
    qaChecklistDoc: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    spellCheckRequested: false,
    spellingFeedback: null,
    dimensions: [],
    detail: {
      conceptId: null,
      angleId: null,
      productId: null,
      collectionId: null,
      batch: null,
      source: 'TAS',
      version: 1,
      briefNumber: null,
      nameMode: 'manual',
      priority: null,
      assignee: null,
      dueDate: null,
      briefToDesign: null,
      scriptContent: null,
      adContent: null,
      elementsTested: null,
      inspiration: null,
      offer: null,
      language: null,
      inspoLinks: [],
      inspirationImage: null,
      designFile: null,
      scriptAndBriefBreakdown: null,
      clientStatusNote: null,
      clientStatusUpdatedAt: null,
      launchedAt: null,
      createdBy: null,
      updatedBy: null,
    },
    ...overrides,
  };
}

/** A row with no brief resolves every lookup to nothing — the em dash, the ordinary case. */
const NO_LOOKUPS: SheetLookups = {
  concept: null,
  performance: null,
  internalProduct: null,
  angle: null,
  conceptsFromAngle: null,
  elementsWeAreTesting: null,
  designFiles: [],
  designLinkUrl: null,
  platform: null,
  funnel: null,
  type: null,
  proposedCopy: null,
  creativeModule: null,
};

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
    // The thirteen Creative Name lookups, as `buildSheetItems` resolves them for a linked brief
    // (GRATSI-MATCH, 2026-10-04): read-only echoes, the Proposed Copy titles in the mono face.
    comments: [],
    lookups: {
      ...NO_LOOKUPS,
      performance: 'Winning',
      internalProduct: 'Night Reset Bundle',
      angle: 'Your Body Clock Is Not Broken',
      conceptsFromAngle: 'B1-Your Body Clock Is Not Broken-Sleep Science',
      elementsWeAreTesting: 'Hook: circadian framing',
      designFiles: ['r2://design/tv1-b1-v2.mp4'],
      designLinkUrl: 'https://drive.example.test/tv1-b1-v2',
      platform: 'Meta, TikTok',
      funnel: 'TOF',
      type: 'Video',
      proposedCopy: 'Copy #1, Copy #3',
      creativeModule: 'Problem/Solution',
    },
    createdLabel: '12d ago',
    createdTitle: '19 Sep 2026, 10:00',
    updatedLabel: '2h ago',
    updatedTitle: '1 Oct 2026, 09:30',
  },
  {
    comments: [],
    item: sampleRow({
      id: 'ds-sheet-2',
      // Airtable's formula leaves the separator when there is no brief to concatenate.
      name: 'October-',
      internalStatus: 'sent_to_designer',
    }),
    lookups: NO_LOOKUPS,
    createdLabel: '4h ago',
    createdTitle: '1 Oct 2026, 07:05',
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
      qaDesigner: true,
      qaStrategist: true,
    }),
    comments: [],
    lookups: {
      ...NO_LOOKUPS,
      performance: 'High Potential to Iterate',
      internalProduct: 'Night Reset Bundle',
      funnel: 'BOF',
      type: 'Static',
    },
    createdLabel: '2w ago',
    createdTitle: '15 Sep 2026, 08:00',
    updatedLabel: '3d ago',
    updatedTitle: '28 Sep 2026, 16:40',
  },
];

interface CreativeSheetGridStoryProps {
  /** The template's master set, read from the seed by the server page that mounts this. */
  readonly columns: readonly ResolvedColumnView[];
}

/** The grid: frozen mono name, brief, three chips, one tick and three ticks; a null status dashes. */
export function CreativeSheetGridStory({ columns }: CreativeSheetGridStoryProps) {
  /*
   * Joined HERE, not handed over ready-made. This module is `'use client'`, so it cannot read the
   * seed itself — `parentColumnsFor` lives beside the brand resolver and reaching it from a client
   * module drags `next/headers` and the database package into the browser graph, which is what broke
   * the dev-server compile when this story first tried it. And the join cannot happen on the server
   * either, because a column carries `render` functions and functions do not cross that boundary.
   * So the server passes plain column DATA and the client draws it — which is exactly what the real
   * page does.
   */
  const storyColumns = gridColumnsFrom(columns, CREATIVE_SHEET_RENDERERS, {
    freezeFirst: true,
    frozenMinWidth: 260,
  }).columns;
  return (
    <AirtableGrid
      tableKey="creative-sheet-story"
      columns={storyColumns}
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

/** The tick glyphs: one spell-check tick each way, then the QA cell at none, some and all. */
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
        <Tick on label="Click for AI Spell Checker Again" />
        <Tick on={false} label="Click for AI Spell Checker Again" />
        <span className="text-xs text-text3">Requested, then not requested</span>
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

/**
 * The Dimensions field (migration 0059, Oct 7 cleanup): the stored ratios as removable chips plus
 * one Select that adds a ratio and saves on the pick. Three states — a row with two §8 ratios, a
 * row carrying an imported legacy placement name (shown and stored as its ratio), and a row that
 * cannot be edited yet. This module is 'use client', so the stories own the state themselves.
 */
export function CreativeSheetDimensionsStory() {
  const [ratios, setRatios] = useState<readonly string[]>(['4:5', '9:16']);
  const [legacy, setLegacy] = useState<readonly string[]>(['IG Story / Reel']);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-card border border-line bg-surface p-4">
        <DimensionsField
          value={ratios}
          onChange={setRatios}
          disabled={false}
          saveState={{ status: 'idle' }}
        />
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <DimensionsField
          value={legacy}
          onChange={setLegacy}
          disabled={false}
          saveState={{ status: 'saved' }}
        />
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <DimensionsField
          value={[]}
          onChange={() => undefined}
          disabled
          saveState={{ status: 'idle' }}
        />
      </div>
    </div>
  );
}

/* ── Oct 12 client sync: Focus Mode, the Brief row sidebar, multi-select ─────────────────────── */

/** A video brief at Ad Submitted with one of its two required ticks set: the gated state the boards document. */
function focusSample(): SheetItemView {
  const base = SAMPLE_ROWS[0];
  if (base === undefined) throw new Error('SAMPLE_ROWS is empty');
  return {
    ...base,
    item: sampleRow({
      id: 'ds-focus-1',
      name: 'October-TV01-B3-CasualHangouts-V2',
      briefName: 'TV01-B3-CasualHangouts-V2',
      briefType: 'Video',
      briefFunnel: 'TOF',
      internalStatus: 'ad_submitted',
      status: 'pending_for_approval',
      qaStrategist: true,
      detail: {
        ...sampleRow({ id: 'x', name: 'x' }).detail,
        batch: 'B3',
        version: 2,
        assignee: 'Sarah K.',
        dueDate: new Date('2026-10-18T00:00:00.000Z'),
        scriptContent:
          'Hook — “What if date night didn’t need a reservation?”\nOpen on a cosy kitchen, two people unpacking a shipment. Natural light, candles lit.',
        briefToDesign: 'Warm, intimate kitchen. Dissolves only, no hard cuts.',
        elementsTested: 'Problem-first open against the comfort-led V1.',
        offer: 'First box ships free.',
        inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
      },
    }),
    lookups: {
      ...NO_LOOKUPS,
      concept: 'Casual Hangouts',
      angle: 'Casual date night dinner at home',
    },
    comments: [
      {
        id: 'c1',
        authorName: 'Sarah K.',
        body: 'Love the hook. Can we take the pour shot 2× slower?',
        at: '10 Oct 2026, 15:42',
        ago: '2d ago',
      },
      {
        id: 'c2',
        authorName: 'Mia D.',
        body: 'Music confirmed and cleared. Targeting client send by 18 Oct.',
        at: '11 Oct 2026, 09:15',
        ago: '1d ago',
      },
    ],
  };
}

/**
 * Focus Mode (scope 1): the bar with prev/next and the three review buttons, the type-filtered
 * QA checklist with the gate box, the content cards and the Feedback thread. Demo mode, so every
 * write is withheld with its reason — including Submit to Client, gated on the internal track.
 */
export function FocusModeStory() {
  const [focused, setFocused] = useState<string | null>('ds-focus-1');
  const items = [focusSample(), ...SAMPLE_ROWS];
  return <FocusModeView items={items} focusedId={focused} onFocus={setFocused} demo />;
}

/** The Brief row sidebar (scope 2): a Sheet from the right, six sections, the N/A tick struck through. */
export function BriefSidebarStory() {
  const [open, setOpen] = useState(false);
  const sample = focusSample();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        data-slot="brief-sidebar-story-open"
      >
        Open the sidebar
      </Button>
      {open ? (
        <CreativeSheetPanel
          item={sample.item}
          lookups={sample.lookups}
          demo
          onClose={() => {
            setOpen(false);
          }}
          onSaved={() => undefined}
          onFocusMode={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** Multi-select (scope 3): the checkbox column with the header's indeterminate state, and the action bar. */
export function MultiSelectStory({ columns }: CreativeSheetGridStoryProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(['ds-sheet-1']));
  const [menu, setMenu] = useState<{ x: number; y: number; name: string } | null>(null);
  const storyColumns = gridColumnsFrom(columns, CREATIVE_SHEET_RENDERERS, {
    freezeFirst: true,
    frozenMinWidth: 260,
  }).columns;
  return (
    <div className="relative flex flex-col gap-3">
      <AirtableGrid
        tableKey="creative-sheet-multiselect-story"
        columns={storyColumns}
        rows={SAMPLE_ROWS}
        rowId={({ item }) => item.id}
        rowLabel={({ item }) => item.name}
        selection={{
          selected,
          onToggle: (id) => {
            setSelected((current) => toggleSelected(current, id));
          },
          onToggleAll: (ids) => {
            setSelected((current) => toggleAllSelected(current, ids));
          },
        }}
        onRowContextMenu={({ item }, position) => {
          setMenu({ ...position, name: item.name });
        }}
        tableSlot="creative-sheet-multiselect-story-table"
      />
      <p className="text-xs text-text3">
        Tick rows, or right-click one for the menu. The bar below is the real component, pinned to
        the viewport while a row is selected.
      </p>
      {menu === null ? null : (
        <RowContextMenu
          position={menu}
          label={menu.name}
          onClose={() => {
            setMenu(null);
          }}
          items={[
            { label: 'Duplicate', shortcut: '⌘D', onSelect: () => undefined },
            { label: 'Open in Focus Mode', onSelect: () => undefined },
            { label: 'Copy link', onSelect: () => undefined },
            { label: 'Delete', tone: 'bad', divider: true, onSelect: () => undefined },
          ]}
        />
      )}
      <SelectionBar
        count={selected.size}
        noun="creative"
        onClear={() => {
          setSelected(new Set());
        }}
        actions={[
          { label: `Duplicate (${String(selected.size)})`, onSelect: () => undefined },
          { label: 'Change status', onSelect: () => undefined },
          { label: `Delete (${String(selected.size)})`, tone: 'bad', onSelect: () => undefined },
        ]}
      />
    </div>
  );
}
