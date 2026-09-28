'use client';

import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

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

const TONE: Record<DemoRow['status'], string> = {
  Approved: 'bg-ok/15 text-ok',
  Testing: 'bg-warn/15 text-warn',
  Draft: 'bg-surface3 text-text3',
};

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
    render: (row) => (
      <span className={`rounded-input px-2 py-0.5 text-xs ${TONE[row.status]}`}>{row.status}</span>
    ),
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
