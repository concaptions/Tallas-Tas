'use client';

import { useState, type ReactNode } from 'react';
import type { CreativeSheetItemListRow } from '@tas/db';
import {
  Button,
  Checkbox,
  cn,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  StatusChip,
} from '@tas/ui';
import { Captions, Check, Copy, Link, Lock, LockOpen, RefreshCw, Trash, X } from '@tas/ui/icons';

import { CreativeSheetPanel } from '@/app/app/creative-sheet/creative-sheet-panel';
import { DimensionsField } from '@/app/app/creative-sheet/dimensions-field';
import {
  focusActions,
  focusQaGateNote,
  focusQaGateOpen,
  focusQaMissingLabel,
  focusQaProgress,
  QA_GATE_HEADING,
  type FocusButtonState,
} from '@/app/app/creative-sheet/focus-mode';
import { FocusModeView } from '@/app/app/creative-sheet/focus-mode-view';
import { QaGateBox } from '@/app/app/creative-sheet/qa-gate-box';
import {
  CREATIVE_SHEET_RENDERERS,
  QaTicks,
  Tick,
  type SheetItemView,
  type SheetLookups,
} from '@/app/app/creative-sheet/creative-sheet-workspace';
import {
  INTERNAL_STATUS_OPTIONS,
  internalStatusView,
  SHEET_LABELS,
  STATUS_OPTIONS,
  statusView,
  type SheetStatusView,
} from '@/app/app/creative-sheet/fields';
import {
  duplicateShortcut,
  RowContextMenu,
  SelectionBar,
  SelectionDeleteConfirm,
  SelectionStatusPicker,
  type SelectionStatusTrack,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { toggleAllSelected, toggleSelected } from '@/components/views/airtable-grid-logic';
import { gridColumnsFrom, type ResolvedColumnView } from '@/components/views/resolved-columns';

import { POPOVER_OPEN_CLASS } from './primitives.stories';

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
    internalStatus: 'sent_to_editor_or_designer',
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
      inspiration: null,
      offer: null,
      language: null,
      briefText: null,
      music: null,
      voiceoverType: null,
      voiceoverScript: null,
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
      internalStatus: 'sent_to_editor_or_designer',
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

/**
 * The three gate positions boards 1, 4 and 5 document, as fixtures the pure `focus-mode.ts`
 * helpers read (B4.A19): a video brief at Ad Submitted with the editor's tick missing, a static
 * brief at Ad Submitted with the strategist's tick missing, and a creative the client sent back
 * with every required tick set — the one position where Submit to Client is live (decision 3).
 */
export type FocusFixtureKind = 'video-gated' | 'static-gated' | 'open';

export const FOCUS_FIXTURE_IDS: Readonly<Record<FocusFixtureKind, string>> = {
  'video-gated': 'ds-focus-1',
  'static-gated': 'ds-focus-2',
  open: 'ds-focus-3',
};

export function focusFixture(kind: FocusFixtureKind): SheetItemView {
  const base = SAMPLE_ROWS[0];
  if (base === undefined) throw new Error('SAMPLE_ROWS is empty');
  const detail = {
    ...sampleRow({ id: 'x', name: 'x' }).detail,
    batch: 'B3',
    version: 2,
    assignee: 'Sarah K.',
    dueDate: new Date('2026-10-18T00:00:00.000Z'),
    scriptContent:
      'Hook — “What if date night didn’t need a reservation?”\nOpen on a cosy kitchen, two people unpacking a shipment. Natural light, candles lit.',
    briefToDesign: 'Warm, intimate kitchen. Dissolves only, no hard cuts.',
    offer: 'First box ships free.',
    inspoLinks: ['https://www.youtube.com/watch?v=nm1TxQj9IsQ'],
  };
  const lookups: SheetLookups = {
    ...NO_LOOKUPS,
    concept: 'Casual Hangouts',
    angle: 'Casual date night dinner at home',
  };
  // The stamps are what `buildSheetItems` writes with `formatCommentStamp` (B1.A21).
  const comments = [
    {
      id: 'c1',
      authorName: 'Sarah K.',
      body: 'Love the hook. Can we take the pour shot 2× slower?',
      at: '10 Oct, 3:42 PM',
      ago: '2d ago',
    },
    {
      id: 'c2',
      authorName: 'Mia D.',
      body: 'Music confirmed and cleared. Targeting client send by 18 Oct.',
      at: '11 Oct, 9:15 AM',
      ago: '1d ago',
    },
  ];
  const item =
    kind === 'video-gated'
      ? sampleRow({
          id: FOCUS_FIXTURE_IDS[kind],
          name: 'October-TV01-B3-CasualHangouts-V2',
          briefName: 'TV01-B3-CasualHangouts-V2',
          briefType: 'Video',
          briefFunnel: 'TOF',
          internalStatus: 'ad_submitted',
          status: 'pending_for_approval',
          qaStrategist: true,
          dimensions: ['9:16'],
          detail,
        })
      : kind === 'static-gated'
        ? sampleRow({
            id: FOCUS_FIXTURE_IDS[kind],
            name: 'October-TS02-B3-CasualHangouts-V1',
            briefName: 'TS02-B3-CasualHangouts-V1',
            briefType: 'Static',
            briefFunnel: 'Retargeting',
            internalStatus: 'ad_submitted',
            status: 'pending_for_approval',
            qaDesigner: true,
            dimensions: ['4:5'],
            detail: {
              ...detail,
              version: 1,
              scriptContent: null,
              adContent: 'Date night, delivered.',
            },
          })
        : sampleRow({
            id: FOCUS_FIXTURE_IDS[kind],
            name: 'October-TV04-B2-NightReset-V1',
            briefName: 'TV04-B2-NightReset-V1',
            briefType: 'Video',
            briefFunnel: 'All Funnels',
            internalStatus: 'approved',
            status: 'revisions_needed',
            qaVideoEditor: true,
            qaDesigner: true,
            qaStrategist: true,
            dimensions: ['9:16', '1:1'],
            detail: { ...detail, version: 1, batch: 'B2' },
          });
  return { ...base, item, lookups, comments };
}

/**
 * Focus Mode (scope 1): the bar with prev/next and the three review buttons, the type-filtered
 * QA checklist with the gate box, the content cards and the Feedback thread. Demo mode, but a
 * gate refusal beats the demo hint (B4.V13), so what renders is the truth of each position: on
 * the first creative Approve is held with the QA sentence under its warn heading and Submit with
 * the internal gate; the next creative is the static twin; the third has every tick set, so the
 * gate box turns ok and Submit draws the open padlock. Prev / next walks the three.
 */
export function FocusModeStory() {
  const [focused, setFocused] = useState<string | null>(FOCUS_FIXTURE_IDS['video-gated']);
  const items = [
    focusFixture('video-gated'),
    focusFixture('static-gated'),
    focusFixture('open'),
    ...SAMPLE_ROWS,
  ];
  return <FocusModeView items={items} focusedId={focused} onFocus={setFocused} demo />;
}

/**
 * One review button as Focus Mode draws it, from the pure `focusActions` state: enabled as the
 * action would be, or held with the guard's own sentence in the popover — the QA refusal with
 * its heading and the missing tick in bold. The story's click does nothing; what it shows is
 * what the guard decided. `forced` holds the popover open for the reader (`POPOVER_OPEN_CLASS`).
 */
function GateButton({
  label,
  icon,
  state,
  variant,
  slot,
  missingLabel,
  forced,
  className,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly state: FocusButtonState;
  readonly variant: 'outline' | 'default' | 'success';
  readonly slot: string;
  readonly missingLabel: string | null;
  readonly forced: boolean;
  readonly className?: string;
}) {
  const disabled = !state.enabled;
  const hint = state.hint ?? '';
  const qaGated = state.kind === 'qa';
  return (
    <DisabledWrite
      active={disabled}
      hint={hint}
      popover
      heading={qaGated ? QA_GATE_HEADING : undefined}
      hintEmphasis={qaGated ? (missingLabel ?? undefined) : undefined}
      className={forced ? POPOVER_OPEN_CLASS : undefined}
    >
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={disabled}
        onClick={() => undefined}
        data-slot={slot}
        className={cn('text-xs', disabled && disabledWriteClassName, className)}
      >
        {icon}
        {label}
      </Button>
    </DisabledWrite>
  );
}

/**
 * The gate box and the three review buttons for the three fixtures side by side (B4.A19): both
 * box tones, the popover with its heading open on the QA-gated button, the internal-gate sentence
 * on Submit, and — on the creative the client sent back — Approve enabled in the `success`
 * variant and Submit to Client live with the open padlock. One popover per card is held open:
 * the QA-gated one where there is one, else the first held button; the others open on hover.
 */
export function QaGateBoxStory() {
  const kinds: readonly FocusFixtureKind[] = ['video-gated', 'static-gated', 'open'];
  return (
    <div className="flex flex-col gap-4" data-slot="qa-gate-box-story">
      {kinds.map((kind) => {
        const { item } = focusFixture(kind);
        const actions = focusActions(item);
        const missingLabel = focusQaMissingLabel(item);
        const internal = internalStatusView(item.internalStatus);
        const client = statusView(item.status);
        const ordered = [
          { key: 'request', state: actions.requestChanges },
          { key: 'approve', state: actions.approve },
          { key: 'submit', state: actions.submitToClient },
        ] as const;
        const forcedKey =
          ordered.find(({ state }) => state.kind === 'qa')?.key ??
          ordered.find(({ state }) => !state.enabled)?.key ??
          null;
        return (
          <div
            key={kind}
            data-slot="qa-gate-box-fixture"
            data-fixture={kind}
            className="flex flex-wrap items-start gap-5 rounded-card border border-line bg-surface p-4"
          >
            <div className="w-[300px] shrink-0">
              <span className="block truncate font-mono text-[13px] font-medium tracking-[-.01em] text-text">
                {item.briefName ?? item.name}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {item.briefType === null ? null : <StatusChip tone="mute" label={item.briefType} />}
                {internal === null ? null : (
                  <StatusChip tone={internal.tone} label={internal.label} />
                )}
                {client === null ? null : <StatusChip tone={client.tone} label={client.label} />}
              </span>
              <QaGateBox
                progress={focusQaProgress(item)}
                open={focusQaGateOpen(item)}
                note={focusQaGateNote(item)}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pb-24">
              <GateButton
                label="Request Changes"
                icon={<X aria-hidden="true" className="size-3.5" strokeWidth={2} />}
                state={actions.requestChanges}
                variant="outline"
                slot="story-request-changes"
                missingLabel={missingLabel}
                forced={forcedKey === 'request'}
                className="border-bad/45 bg-bad/10 text-bad hover:bg-bad/15 hover:text-bad"
              />
              <GateButton
                label="Approve"
                icon={<Check aria-hidden="true" className="size-3.5" strokeWidth={2.4} />}
                state={actions.approve}
                variant="success"
                slot="story-approve"
                missingLabel={missingLabel}
                forced={forcedKey === 'approve'}
              />
              <GateButton
                label="Submit to Client"
                icon={
                  actions.submitToClient.enabled ? (
                    <LockOpen aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  ) : (
                    <Lock aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  )
                }
                state={actions.submitToClient}
                variant="default"
                slot="story-submit"
                missingLabel={missingLabel}
                forced={forcedKey === 'submit'}
                className="font-semibold"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The Brief row sidebar (scope 2): a Sheet from the right, six sections, the N/A tick struck through. */
export function BriefSidebarStory() {
  const [open, setOpen] = useState(false);
  const sample = focusFixture('video-gated');
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

/** The bulk Change-status picker's two tracks, as the workspace offers them. */
const STORY_STATUS_TRACKS: readonly SelectionStatusTrack[] = [
  { key: 'internalStatus', label: SHEET_LABELS.internalStatus, options: INTERNAL_STATUS_OPTIONS },
  { key: 'status', label: SHEET_LABELS.status, options: STATUS_OPTIONS },
];

const STORY_DELETE_DETAIL = 'They leave the sheet, the queues and the portal; nothing is erased.';

/**
 * Multi-select (scope 3, B3.V29): the checkbox column with the header's indeterminate state, the
 * right-click menu with its lucide glyphs and the row it belongs to washed `surface3`, and the
 * action bar — the real component, pinned to the viewport while a row is ticked — with the
 * picker, the delete confirm and the notice wired as the workspace wires them: Duplicate clears
 * the selection and leaves "n copies created." under the bar (B3.A29), Change status opens the
 * picker inline, Delete asks once. The demo switch holds every action with the demo hint. The
 * two inline pieces are also mounted below the grid so they can be reviewed without a click.
 */
export function MultiSelectStory({ columns }: CreativeSheetGridStoryProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(['ds-sheet-1']));
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [demo, setDemo] = useState(false);
  const [picker, setPicker] = useState<{ track: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const storyColumns = gridColumnsFrom(columns, CREATIVE_SHEET_RENDERERS, {
    freezeFirst: true,
    frozenMinWidth: 260,
  }).columns;
  const count = selected.size;
  const hint = demo ? DEMO_WRITE_HINT : '';
  const clear = () => {
    setSelected(new Set());
    setPicker(null);
    setConfirmDelete(false);
  };
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
        contextRowId={menu?.id ?? null}
        onRowContextMenu={({ item }, position) => {
          setMenu({ ...position, id: item.id, name: item.name });
        }}
        tableSlot="creative-sheet-multiselect-story-table"
      />
      <div className="flex flex-wrap items-center gap-4 text-xs text-text3">
        <span>
          Tick rows, or right-click one for the menu. The bar is the real component, pinned to the
          viewport while a row is selected.
        </span>
        <label className="flex items-center gap-2 text-text2">
          <Checkbox
            checked={demo}
            onChange={(event) => {
              setDemo(event.target.checked);
            }}
            data-slot="multiselect-story-demo"
          />
          Demo mode — every action held with the hint
        </label>
      </div>
      {menu === null ? null : (
        <RowContextMenu
          position={menu}
          label={menu.name}
          onClose={() => {
            setMenu(null);
          }}
          items={[
            {
              label: 'Duplicate',
              shortcut: duplicateShortcut(navigator.userAgent),
              icon: <Copy className="size-4" strokeWidth={1.75} />,
              disabled: demo,
              onSelect: () => {
                setNotice('1 copy created.');
              },
            },
            {
              label: 'Open in Focus Mode',
              icon: <Captions className="size-4" strokeWidth={1.75} />,
              onSelect: () => undefined,
            },
            {
              label: 'Copy link',
              icon: <Link className="size-4" strokeWidth={1.75} />,
              onSelect: () => undefined,
            },
            {
              label: 'Delete',
              icon: <Trash className="size-4" strokeWidth={1.75} />,
              tone: 'bad',
              divider: true,
              disabled: demo,
              onSelect: () => {
                setSelected(new Set([menu.id]));
                setPicker(null);
                setConfirmDelete(true);
              },
            },
          ]}
        />
      )}
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-3">
        <SelectionStatusPicker
          tracks={STORY_STATUS_TRACKS}
          track="internalStatus"
          value=""
          onTrackChange={() => undefined}
          onValueChange={() => undefined}
          onApply={() => undefined}
        />
        <span className="text-xs text-text2">
          <SelectionDeleteConfirm
            count={2}
            noun="creative"
            detail={STORY_DELETE_DETAIL}
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </span>
      </div>
      <SelectionBar
        count={count}
        noun="creative"
        onClear={clear}
        actions={[
          {
            label: `Duplicate (${String(count)})`,
            icon: <Copy className="size-3.5" strokeWidth={1.75} />,
            disabled: demo,
            hint,
            slot: 'selection-duplicate',
            onSelect: () => {
              setNotice(`${String(count)} ${count === 1 ? 'copy' : 'copies'} created.`);
              clear();
            },
          },
          {
            label: 'Change status',
            icon: <RefreshCw className="size-3.5" strokeWidth={1.75} />,
            disabled: demo,
            hint,
            slot: 'selection-change-status',
            onSelect: () => {
              setConfirmDelete(false);
              setPicker((current) =>
                current === null ? { track: 'internalStatus', value: '' } : null,
              );
            },
          },
          {
            label: `Delete (${String(count)})`,
            icon: <Trash className="size-3.5" strokeWidth={1.75} />,
            tone: 'bad',
            disabled: demo,
            hint,
            slot: 'selection-delete',
            onSelect: () => {
              setPicker(null);
              setConfirmDelete(true);
            },
          },
        ]}
        notice={
          confirmDelete ? (
            <SelectionDeleteConfirm
              count={count}
              noun="creative"
              detail={STORY_DELETE_DETAIL}
              disabled={demo}
              onConfirm={() => {
                setNotice(`${String(count)} deleted.`);
                clear();
              }}
              onCancel={() => {
                setConfirmDelete(false);
              }}
            />
          ) : (
            notice
          )
        }
      >
        {picker === null ? null : (
          <SelectionStatusPicker
            tracks={STORY_STATUS_TRACKS}
            track={picker.track}
            value={picker.value}
            disabled={demo}
            onTrackChange={(track) => {
              setPicker({ track, value: '' });
            }}
            onValueChange={(value) => {
              setPicker({ track: picker.track, value });
            }}
            onApply={() => {
              setNotice(`${String(count)} moved.`);
              clear();
            }}
          />
        )}
      </SelectionBar>
    </div>
  );
}
