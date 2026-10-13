import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultUserViewConfig, type UserViewConfig, type ViewType } from '@tas/domain';

import type { FieldOption } from './fields-menu';
import { ViewToolbar } from './view-toolbar';

const noop = () => undefined;

/** Four columns; "Notes" stands for a render-only one the grid cannot bucket. */
const FIELDS: readonly FieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'updated', label: 'Updated' },
];
const GROUP_FIELDS = FIELDS.filter((field) => field.key !== 'notes');

function toolbar(options: {
  readonly activeView?: ViewType;
  readonly viewConfig?: UserViewConfig;
  readonly onGroupChange?: (groupBy: string | null) => void;
  readonly groupFields?: readonly FieldOption[];
}): string {
  return renderToStaticMarkup(
    <ViewToolbar
      tableKey="toolbar-test"
      supportedViews={['grid', 'kanban']}
      activeView={options.activeView ?? 'grid'}
      onViewChange={noop}
      kanbanGroupByField={null}
      views={[]}
      activeViewId={null}
      onActivateView={noop}
      onCreateView={noop}
      onRenameView={noop}
      onDeleteView={noop}
      fields={FIELDS}
      isFieldVisible={() => true}
      onToggleField={noop}
      viewConfig={options.viewConfig}
      onGroupChange={options.onGroupChange}
      groupFields={options.groupFields}
    />,
  );
}

describe('ViewToolbar — Group popover (Ticket 7)', () => {
  it('carries the Group popover on the grid once a config and a handler are given', () => {
    const markup = toolbar({
      viewConfig: { ...defaultUserViewConfig('grid'), groupBy: 'status' },
      onGroupChange: noop,
      groupFields: GROUP_FIELDS,
    });
    expect(markup).toContain('data-slot="view-toolbar"');
    expect(markup).toContain('data-slot="grid-group"');
    expect(markup).toContain('Group: Status</button>');
  });

  it('labels the trigger from the groupable columns alone: a stored render-only key reads raw', () => {
    // `groupFields` leaves "Notes" out, so a view that still remembers it (a stale lens the grid
    // draws flat) cannot borrow the label from the Fields list — the raw key says what is stored.
    const markup = toolbar({
      viewConfig: { ...defaultUserViewConfig('grid'), groupBy: 'notes' },
      onGroupChange: noop,
      groupFields: GROUP_FIELDS,
    });
    expect(markup).toContain('Group: notes</button>');
  });

  it('falls back to every field when no groupFields are given (the story case)', () => {
    const markup = toolbar({
      viewConfig: { ...defaultUserViewConfig('grid'), groupBy: 'notes' },
      onGroupChange: noop,
    });
    expect(markup).toContain('Group: Notes</button>');
  });

  it('renders no Group popover without a handler, without a config, or off the grid', () => {
    expect(toolbar({ viewConfig: defaultUserViewConfig('grid') })).not.toContain(
      'data-slot="grid-group"',
    );
    expect(toolbar({ onGroupChange: noop })).not.toContain('data-slot="grid-group"');
    expect(
      toolbar({
        activeView: 'kanban',
        viewConfig: defaultUserViewConfig('kanban'),
        onGroupChange: noop,
        groupFields: GROUP_FIELDS,
      }),
    ).not.toContain('data-slot="grid-group"');
  });
});
