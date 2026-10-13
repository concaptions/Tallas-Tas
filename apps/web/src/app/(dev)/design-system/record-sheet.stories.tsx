'use client';

import { useState } from 'react';
import { chipTone } from '@tas/domain/state';
import { Button, StatusChip } from '@tas/ui';

import type { GridColumn } from '@/components/views/airtable-grid';
import { ReadOnlyFields, RecordSheet, recordNavigation } from '@/components/views';

/**
 * The shared record sidebar (Ticket 9, part 1): three sample rows, one column list used by both
 * `ReadOnlyFields` and the chips. ArrowLeft and ArrowRight walk the selection.
 */
interface SampleRow {
  readonly id: string;
  readonly name: string;
  readonly status: 'Draft' | 'Approved' | 'Testing';
  readonly owner: string;
  readonly updated: string;
}

const ROWS: readonly SampleRow[] = [
  { id: '1', name: 'Sleep Mask — Hero', status: 'Approved', owner: 'Mia', updated: '2d ago' },
  { id: '2', name: 'Weighted Blanket', status: 'Testing', owner: 'Jon', updated: '5h ago' },
  { id: '3', name: 'Magnesium Drink', status: 'Draft', owner: 'Ada', updated: '1w ago' },
];

const COLUMNS: readonly GridColumn<SampleRow>[] = [
  { key: 'name', header: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusChip tone={chipTone(row.status)} label={row.status} />,
  },
  { key: 'owner', header: 'Owner', render: (row) => row.owner },
  {
    key: 'updated',
    header: 'Updated',
    render: (row) => <span className="font-mono text-text3">{row.updated}</span>,
  },
];

const IDS = ROWS.map((row) => row.id);
const DEFAULT_ROW: SampleRow = ROWS[0] ?? {
  id: '',
  name: '',
  status: 'Draft',
  owner: '',
  updated: '',
};

export function RecordSheetStory() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>('2');
  const row: SampleRow = ROWS.find((candidate) => candidate.id === selectedId) ?? DEFAULT_ROW;
  const nav = recordNavigation(IDS, selectedId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(true);
          }}
        >
          Open the record sidebar
        </Button>
        <span className="text-xs text-text3">
          Three sample rows; ArrowLeft and ArrowRight walk the selection.
        </span>
      </div>
      <RecordSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        nav={nav}
        onNavigate={setSelectedId}
        title={row.name}
        titleSlot="record-sheet-sample-title"
        chips={
          <>
            <StatusChip tone={chipTone(row.status)} label={row.status} />
            <StatusChip tone="mute" label={row.owner} />
          </>
        }
      >
        <ReadOnlyFields columns={COLUMNS} row={row} except={['name']} slot="record" />
      </RecordSheet>
    </div>
  );
}
