'use client';

import { useState } from 'react';
import { defaultUserViewConfig, freezeUpTo, frozenUpTo, type UserViewConfig } from '@tas/domain';

import { FreezeMenu } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

/**
 * The Freeze popover and a grid with MORE THAN ONE frozen column (action item 22; UI governance
 * rule 4).
 *
 * Why a story of its own rather than a line in `airtable-grid.stories.tsx`: the thing worth looking
 * at here is not a column, it is the arithmetic. Every frozen cell used to be pinned at `left: 0`,
 * so a second frozen column sat on top of the first and only a one-column freeze ever rendered
 * correctly. The grid now measures the frozen header cells and offsets each one by the widths
 * before it, and the only way to SEE that is a grid wide enough to scroll sideways with two columns
 * pinned — scroll this one right and Name and Batch should stay side by side, not overlap.
 *
 * The header row is pinned too: the grid is a bounded scroll region, so reading down a long table
 * keeps the headers in view. The rows here are deliberately more than fit, so the scroll is real.
 *
 * All state is local to the story — nothing calls a Server Action, and nothing is persisted.
 */
interface FreezeRow {
  readonly id: string;
  readonly name: string;
  readonly batch: string;
  readonly theme: string;
  readonly persona: string;
  readonly product: string;
  readonly owner: string;
  readonly updated: string;
}

const ROWS: readonly FreezeRow[] = Array.from({ length: 14 }, (_, index) => ({
  id: String(index + 1),
  name: `B${String((index % 4) + 1)}-Concept ${String(index + 1)}`,
  batch: `Batch ${String((index % 4) + 1)}`,
  theme: ['Green Screen', 'Talking Head', 'Street Interview', 'Unboxing'][index % 4] ?? '—',
  persona: ['Tired Parent', 'Shift Worker', 'Light Sleeper', 'New Mum'][index % 4] ?? '—',
  product: ['Sleep Mask', 'Weighted Blanket', 'Magnesium Drink', 'Pillow Spray'][index % 4] ?? '—',
  owner: ['Mia', 'Jon', 'Ada', 'Sam'][index % 4] ?? '—',
  updated: `${String((index % 9) + 1)}d ago`,
}));

/** `frozen: true` on the first two is the TABLE's default here; a view's own freeze replaces it. */
const COLUMNS: readonly GridColumn<FreezeRow>[] = [
  {
    key: 'name',
    header: 'Concept Name',
    frozen: true,
    minWidth: 240,
    sortValue: (row) => row.name,
    render: (row) => <span className="font-mono font-medium">{row.name}</span>,
  },
  {
    key: 'batch',
    header: 'Batch',
    frozen: true,
    minWidth: 120,
    sortValue: (row) => row.batch,
    render: (row) => row.batch,
  },
  { key: 'theme', header: 'Theme', minWidth: 200, render: (row) => row.theme },
  { key: 'persona', header: 'Persona', minWidth: 200, render: (row) => row.persona },
  { key: 'product', header: 'Product', minWidth: 200, render: (row) => row.product },
  { key: 'owner', header: 'Owner', minWidth: 160, render: (row) => row.owner },
  {
    key: 'updated',
    header: 'Updated',
    minWidth: 160,
    render: (row) => <span className="text-text3">{row.updated}</span>,
  },
];

const FIELDS = COLUMNS.map((column) => ({ key: column.key, label: column.header }));
const KEYS = FIELDS.map((field) => field.key);

/** The control on its own: a single choice, because a freeze is a prefix and not a set. */
export function FreezeMenuStory() {
  const [frozenFields, setFrozenFields] = useState<readonly string[]>(['name', 'batch']);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FreezeMenu
        fields={FIELDS}
        frozenUpTo={frozenUpTo(KEYS, { frozenFields })}
        onFreezeChange={(key) => {
          setFrozenFields(freezeUpTo(KEYS, key));
        }}
      />
      <p className="text-sm text-text2">
        Frozen:{' '}
        <span className="font-mono text-text3">
          {frozenFields.length === 0 ? 'table default' : frozenFields.join(', ')}
        </span>
      </p>
    </div>
  );
}

/**
 * The control and the grid together, so the choice can be made and its effect read in one place.
 * `applyUserView` inside the grid turns the view's `frozenFields` into the sticky columns; the
 * table's own two-column default stands until a choice is made here.
 */
export function FrozenColumnsGridStory() {
  const [view, setView] = useState<UserViewConfig>(() => defaultUserViewConfig('grid'));
  return (
    <div className="flex flex-col gap-3">
      <FreezeMenuStoryControl view={view} onChange={setView} />
      <AirtableGrid
        tableKey="design-system-freeze"
        view={view}
        onSortChange={(sort) => {
          setView((current) => ({ ...current, sort }));
        }}
        columns={COLUMNS}
        rows={ROWS}
        rowId={(row) => row.id}
        rowLabel={(row) => row.name}
        tableSlot="freeze-story-table"
      />
    </div>
  );
}

function FreezeMenuStoryControl({
  view,
  onChange,
}: {
  readonly view: UserViewConfig;
  readonly onChange: (next: UserViewConfig) => void;
}) {
  return (
    <FreezeMenu
      fields={FIELDS}
      frozenUpTo={frozenUpTo(KEYS, view)}
      onFreezeChange={(key) => {
        onChange({ ...view, frozenFields: freezeUpTo(KEYS, key) });
      }}
    />
  );
}
