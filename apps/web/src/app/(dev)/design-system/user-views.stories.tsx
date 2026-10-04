'use client';

import { useState } from 'react';
import {
  applyUserView,
  defaultUserViewConfig,
  moveViewField,
  type UserView,
  type UserViewFilter,
  type UserViewSort,
  type ViewType,
} from '@tas/domain';

import {
  FieldsMenu,
  FilterMenu,
  GalleryView,
  GroupMenu,
  ListView,
  ViewsMenu,
  ViewToolbar,
} from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import { applyFilters } from '@/components/views/airtable-grid-logic';

/**
 * The per-user view controls (Sprint 7, VIEWS-01; UI governance rule 4): the toolbar that sits
 * above every one of the six tables, the Views menu on its own, the Fields popover on its own, and
 * the gallery card with the initial tile a record without a picture gets. All state is local to the
 * story — nothing here calls a Server Action.
 */
const SAMPLE_VIEWS: readonly UserView[] = [
  { id: 'v1', name: 'My queue', isActive: true, ...defaultUserViewConfig('grid') },
  {
    id: 'v2',
    name: 'Winning only',
    isActive: false,
    ...defaultUserViewConfig('gallery'),
    visibleFields: ['name', 'status'],
  },
];

const FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'updated', label: 'Updated' },
];

export function ViewToolbarStory() {
  const [views, setViews] = useState<readonly UserView[]>(SAMPLE_VIEWS);
  const [activeView, setActiveView] = useState<ViewType>('grid');
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const activeId = views.find((view) => view.isActive)?.id ?? null;

  return (
    <ViewToolbar
      tableKey="story"
      supportedViews={['grid', 'kanban', 'gallery']}
      activeView={activeView}
      onViewChange={setActiveView}
      kanbanGroupByField={null}
      views={views}
      activeViewId={activeId}
      onActivateView={(id) => {
        setViews((current) => current.map((view) => ({ ...view, isActive: view.id === id })));
      }}
      onCreateView={(name) => {
        setViews((current) => [
          ...current.map((view) => ({ ...view, isActive: false })),
          {
            id: `v${String(current.length + 1)}`,
            name,
            isActive: true,
            ...defaultUserViewConfig(),
          },
        ]);
      }}
      onRenameView={(id, name) => {
        setViews((current) => current.map((view) => (view.id === id ? { ...view, name } : view)));
      }}
      onDeleteView={(id) => {
        setViews((current) => current.filter((view) => view.id !== id));
      }}
      fields={FIELDS}
      isFieldVisible={(key) => !hidden.has(key)}
      onToggleField={(key) => {
        setHidden((current) => {
          const next = new Set(current);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }}
    />
  );
}

export function ViewsMenuStory() {
  return (
    <ViewsMenu
      views={SAMPLE_VIEWS}
      activeViewId="v1"
      onActivate={() => {
        /* story */
      }}
      onCreate={() => {
        /* story */
      }}
      onRename={() => {
        /* story */
      }}
      onDelete={() => {
        /* story */
      }}
    />
  );
}

export function FieldsMenuStory() {
  return (
    <FieldsMenu
      fields={FIELDS}
      isVisible={(key) => key !== 'notes'}
      onToggle={() => {
        /* story */
      }}
    />
  );
}

/**
 * The arrange dialog behind "Arrange fields…" (action item 16, the reorder half of "customise the
 * card"): per-field Up/Down buttons, every one an ordinary tab stop, each press reported through
 * `onMoveField` and the rows re-sorting live. The order preview underneath renders the same
 * `applyUserView` the grid and the gallery lines read, so the story shows the one rule all three
 * follow: listed keys first, the rest in table order.
 */
export function FieldsArrangeStory() {
  const [fieldOrder, setFieldOrder] = useState<readonly string[]>([]);
  const ordered = applyUserView(FIELDS, { visibleFields: null, fieldOrder, frozenFields: [] });
  return (
    <div className="flex flex-col gap-2">
      <FieldsMenu
        fields={ordered}
        isVisible={() => true}
        onToggle={() => {
          /* story */
        }}
        onMoveField={(key, direction) => {
          setFieldOrder(
            moveViewField(
              FIELDS.map((field) => field.key),
              { fieldOrder },
              key,
              direction,
            ),
          );
        }}
      />
      <p className="text-sm text-text2">
        Order:{' '}
        <span className="font-mono text-text3">
          {ordered.map((field) => field.key).join(' · ')}
        </span>
      </p>
    </div>
  );
}

/** Three cards: a picture, a video, and the coloured initial tile a record without media gets. */
export function GalleryInitialTileStory() {
  return (
    <GalleryView
      items={[
        {
          id: 'g1',
          name: 'Danielle Okonkwo',
          imageUrl: null,
          mediaType: 'image',
          initial: 'D',
          initialTone: 'accent',
          subtitle: 'Female · 25–34',
          fields: [
            { key: 'status', label: 'Internal Status', value: 'Approved' },
            { key: 'platform', label: 'Platform', value: 'Insense' },
          ],
        },
        {
          id: 'g2',
          name: 'Problem → Solution',
          imageUrl: null,
          mediaType: 'image',
          initial: 'P',
          initialTone: 'info',
          subtitle: 'Framework',
          fields: [{ key: 'status', label: 'Status', value: 'In progress' }],
        },
        {
          id: 'g3',
          name: 'Hidden field card',
          imageUrl: null,
          mediaType: 'image',
          initial: 'H',
          initialTone: 'ok',
          fields: [
            { key: 'status', label: 'Status', value: 'Shown' },
            { key: 'notes', label: 'Notes', value: 'Hidden by the Fields popover' },
          ],
        },
      ]}
      visibleFields={['status', 'platform']}
    />
  );
}

/**
 * The List view (AI-17): one record per compact row — the name, up to two labelled values, and the
 * record's status chip where the page provides one. The items are the SAME `GalleryItem`s the
 * gallery renders and the chips wear `chipTone`'s tones through the one `StatusChip` primitive.
 * The third row shows the cap: a record with more fields than the list shows still reads as two
 * labelled values, because the list is a scan and the grid is where every column lives. Generated
 * names (Concepts) render in `font-mono` through `monoNames`.
 */
export function ListViewStory() {
  return (
    <ListView
      monoNames
      items={[
        {
          id: 'l1',
          name: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
          imageUrl: null,
          mediaType: 'image',
          subtitle: 'Niagara Sleep Solutions',
          fields: [
            { key: 'batch', label: 'Batch', value: 'B1' },
            { key: 'theme', label: 'Theme', value: 'Problem/Solution' },
          ],
        },
        {
          id: 'l2',
          name: 'B2-It Is Not Just Your Age-Green Screen',
          imageUrl: null,
          mediaType: 'image',
          fields: [
            { key: 'batch', label: 'Batch', value: 'B2' },
            { key: 'theme', label: 'Theme', value: 'Green Screen' },
          ],
        },
        {
          id: 'l3',
          name: 'B2-Daylight Is Not The Enemy-POV',
          imageUrl: null,
          mediaType: 'image',
          fields: [
            { key: 'batch', label: 'Batch', value: 'B2' },
            { key: 'theme', label: 'Theme', value: 'POV' },
            { key: 'category', label: 'Category', value: 'New' },
          ],
        },
      ]}
      chips={{
        l1: { label: 'Videos Revisions', tone: 'warn' },
        l2: { label: 'Video Editing In Progress', tone: 'info' },
        l3: { label: 'Ad Submitted', tone: 'ok' },
      }}
      onItemClick={() => {
        /* story */
      }}
    />
  );
}

/**
 * Filters and grouping (AI-32; UI governance rule 4): the Filter popover holds the view's field
 * conditions (ANDed, one click removes one, "Add filter…" opens the dialog), the Group popover
 * picks the column whose values head the grid's rows, and the grid below is the real
 * `AirtableGrid` doing both at once — so this story is the live proof that a condition narrows
 * the rows and a grouping draws one counted header per value, composed with click-to-sort.
 */
interface FilterStoryRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly owner: string | null;
}

const FILTER_STORY_ROWS: readonly FilterStoryRow[] = [
  { id: 'f1', name: 'Sleep Mask — Hero', status: 'Approved', owner: 'Mia' },
  { id: 'f2', name: 'Weighted Blanket', status: 'Testing', owner: 'Jon' },
  { id: 'f3', name: 'Magnesium Drink', status: 'Approved', owner: null },
  { id: 'f4', name: 'Cooling Pillow', status: 'Draft', owner: 'Ada' },
];

const FILTER_STORY_COLUMNS: readonly GridColumn<FilterStoryRow>[] = [
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
    render: (row) => <span className="text-text2">{row.status}</span>,
  },
  {
    key: 'owner',
    header: 'Owner',
    sortValue: (row) => row.owner,
    render: (row) => <span className="text-text2">{row.owner ?? '—'}</span>,
  },
];

export function FilterGroupStory() {
  const [filters, setFilters] = useState<readonly UserViewFilter[]>([
    { field: 'status', op: 'is_not', value: 'Draft' },
  ]);
  const [groupBy, setGroupBy] = useState<string | null>('status');
  const [sort, setSort] = useState<UserViewSort | null>(null);
  const fields = FILTER_STORY_COLUMNS.map((column) => ({
    key: column.key,
    label: column.header,
  }));
  const rows = applyFilters(FILTER_STORY_ROWS, filters, FILTER_STORY_COLUMNS);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterMenu fields={fields} filters={filters} onFiltersChange={setFilters} />
        <GroupMenu fields={fields} groupBy={groupBy} onGroupChange={setGroupBy} />
        <p className="text-sm text-text2">
          <span className="font-mono text-text3">
            {String(rows.length)}/{String(FILTER_STORY_ROWS.length)}
          </span>{' '}
          rows pass
        </p>
      </div>
      <AirtableGrid
        tableKey="story-filters"
        columns={FILTER_STORY_COLUMNS}
        rows={rows}
        rowId={(row) => row.id}
        view={{ ...defaultUserViewConfig('grid'), filters, groupBy, sort }}
        onSortChange={setSort}
      />
    </div>
  );
}
