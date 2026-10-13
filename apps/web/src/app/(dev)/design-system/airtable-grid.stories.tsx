'use client';

import { useEffect, useRef, useState } from 'react';
import { chipTone } from '@tas/domain/state';
import { Checkbox, StatusChip } from '@tas/ui';

import { GridSelectionOverlay, SelectionDeleteConfirm, useGridSelection } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import { toggleAllSelected, toggleSelected } from '@/components/views/airtable-grid-logic';

/**
 * The reusable Airtable-style grid (P2A, UI governance rule 4). Read-only, full-width, horizontally
 * scrollable with a frozen primary column and click-to-sort headers. This story feeds it enough
 * columns to force horizontal scroll so the freeze and the Fields menu can be tried on the deployed
 * /design-system page. Cell rendering (badges, link counts, checkbox icons) is the caller's job — the
 * grid only lays them out — so the story shows each kind inline.
 */
interface DemoRow {
  readonly id: string;
  readonly name: string;
  readonly status: 'Draft' | 'Approved' | 'Testing';
  readonly angles: number;
  readonly used: boolean;
  readonly owner: string;
  readonly updated: string;
}

const ROWS: readonly DemoRow[] = [
  {
    id: '1',
    name: 'Sleep Mask — Hero',
    status: 'Approved',
    angles: 4,
    used: true,
    owner: 'Mia',
    updated: '2d ago',
  },
  {
    id: '2',
    name: 'Weighted Blanket',
    status: 'Testing',
    angles: 2,
    used: false,
    owner: 'Jon',
    updated: '5h ago',
  },
  {
    id: '3',
    name: 'Magnesium Drink',
    status: 'Draft',
    angles: 0,
    used: false,
    owner: 'Ada',
    updated: '1w ago',
  },
];

const COLUMNS: readonly GridColumn<DemoRow>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 200,
    sortValue: (row) => row.name,
    render: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (row) => row.status,
    // The one pill: `StatusChip`, toned by `chipTone` — never a hand-rolled badge (governance rule 3).
    render: (row) => <StatusChip tone={chipTone(row.status)} label={row.status} />,
  },
  {
    key: 'angles',
    header: 'Angles',
    align: 'right',
    sortValue: (row) => row.angles,
    render: (row) => <span className="font-mono text-text3">{row.angles}</span>,
  },
  {
    key: 'used',
    header: 'Used',
    align: 'center',
    render: (row) => <span aria-hidden>{row.used ? '✅' : '—'}</span>,
  },
  { key: 'owner', header: 'Owner', sortValue: (row) => row.owner, render: (row) => row.owner },
  {
    key: 'updated',
    header: 'Updated',
    render: (row) => <span className="text-text3">{row.updated}</span>,
  },
];

export function AirtableGridStory() {
  return (
    <AirtableGrid
      tableKey="design-system-demo"
      columns={COLUMNS}
      rows={ROWS}
      rowId={(row) => row.id}
      onRowClick={() => undefined}
    />
  );
}

export function AirtableGridEmptyStory() {
  return (
    <AirtableGrid
      tableKey="design-system-demo-empty"
      columns={COLUMNS}
      rows={[]}
      rowId={(row) => row.id}
      empty="🌱 No records yet — add your first one."
    />
  );
}

/**
 * The three row states board 3 draws, in one grid (B3.V5 / B3.V29): the first row TICKED
 * (`accent-soft` wash, the inset bar, its cells in `--text`), the second OPEN in the sidebar
 * (`surface3` + the bar, `selectedId`), the third the row whose context menu is up (`surface3`,
 * `contextRowId`). One of three is ticked, so the header box shows the indeterminate bar. Ticking
 * rows changes the header through the shared `toggleSelected` / `toggleAllSelected` logic.
 */
const DEMO_ROW_ID = (row: DemoRow) => row.id;

const OVERLAY_STATUS_OPTIONS = [
  { key: 'Draft', label: 'Draft' },
  { key: 'Testing', label: 'Testing' },
  { key: 'Approved', label: 'Approved' },
];

const OVERLAY_DELETE_DETAIL = 'Linked records keep their reference and go nameless.';

/**
 * The SHARED multi-select wiring every grid view adopts (Ticket 8): one `useGridSelection` call
 * feeds the grid's checkbox column and one `GridSelectionOverlay` draws the right-click menu, the
 * bar, the inline Change-status picker and the Delete confirm. Live: two rows arrive ticked with
 * the picker open, right-click a row for the menu (Open → Copy link → Delete; no Duplicate — no
 * naming formula, PRD §7), Delete asks once in the bar, a confirmed delete really drops the story
 * rows and leaves the notice behind the cleared selection (B3.A29). The demo switch holds every
 * write with the demo hint. The confirm line is also mounted inline below so it can be reviewed
 * without a click.
 */
export function GridSelectionOverlayStory() {
  const [demo, setDemo] = useState(false);
  const [rows, setRows] = useState<readonly DemoRow[]>(ROWS);
  const state = useGridSelection<DemoRow>({
    rows,
    rowId: DEMO_ROW_ID,
    rowLabel: (row) => row.name,
    demo,
    noun: 'record',
    linkFor: (id) => `${window.location.origin}/design-system?record=${id}`,
    open: { label: 'Open', onOpen: () => undefined },
    remove: {
      detail: OVERLAY_DELETE_DETAIL,
      run: (ids) => Promise.resolve({ ok: true as const, deleted: [...ids] }),
      onDeleted: (ids) => {
        setRows((current) => current.filter((row) => !ids.includes(row.id)));
      },
    },
    status: {
      tracks: [{ key: 'status', label: 'Status', options: OVERLAY_STATUS_OPTIONS }],
      run: (ids) => Promise.resolve({ ok: true as const, moved: [...ids], refused: [] }),
    },
    refresh: () => undefined,
  });

  // Two rows ticked and the picker open on load, so the bar and the picker are reviewable
  // without a click; the toggle and the action are the hook's own, run once.
  const seeded = useRef(false);
  const seedToggleAll = state.gridProps.selection.onToggleAll;
  const changeStatus = state.selectionActions.find(
    (action) => action.slot === 'selection-change-status',
  );
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    seedToggleAll(['1', '2']);
    changeStatus?.onSelect();
  }, [changeStatus, seedToggleAll]);

  return (
    <div className="relative flex flex-col gap-3">
      <AirtableGrid
        tableKey="design-system-grid-selection-overlay"
        columns={COLUMNS}
        rows={rows}
        rowId={DEMO_ROW_ID}
        rowLabel={(row) => row.name}
        {...state.gridProps}
        tableSlot="design-system-grid-selection-overlay-table"
      />
      <div className="flex flex-wrap items-center gap-4 text-xs text-text3">
        <span>
          Tick rows or right-click one; the bar, the picker, the confirm and the notice are the
          hook&apos;s own state.
        </span>
        <label className="flex items-center gap-2 text-text2">
          <Checkbox
            checked={demo}
            onChange={(event) => {
              setDemo(event.target.checked);
            }}
            data-slot="grid-selection-overlay-story-demo"
          />
          Demo mode — every write held with the hint
        </label>
      </div>
      <div className="rounded-card border border-line bg-surface px-3 py-2 text-xs text-text2">
        <SelectionDeleteConfirm
          count={2}
          noun="record"
          detail={OVERLAY_DELETE_DETAIL}
          disabled={demo}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </div>
      <GridSelectionOverlay state={state} noun="record" />
    </div>
  );
}

export function AirtableGridSelectionStory() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(['1']));
  return (
    <AirtableGrid
      tableKey="design-system-demo-selection"
      columns={COLUMNS}
      rows={ROWS}
      rowId={(row) => row.id}
      rowLabel={(row) => row.name}
      selectedId="2"
      contextRowId="3"
      selection={{
        selected,
        onToggle: (id) => {
          setSelected((current) => toggleSelected(current, id));
        },
        onToggleAll: (ids) => {
          setSelected((current) => toggleAllSelected(current, ids));
        },
      }}
      onRowClick={() => undefined}
      tableSlot="design-system-selection-table"
    />
  );
}
