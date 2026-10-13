import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  GROUP_NONE,
  GroupByControl,
  groupByTriggerText,
  type GroupByOption,
} from './group-by-control';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

const GRID_OPTIONS: readonly GroupByOption[] = [
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
];

/** The Creative Sheet's Kanban fields, as `TABLE_VIEW_CAPABILITIES['creative-sheet']` words them. */
const KANBAN_OPTIONS: readonly GroupByOption[] = [
  { key: 'internalStatus', label: 'Internal Status' },
  { key: 'status', label: 'Client Approval' },
  { key: 'editorStage', label: 'Editing stage' },
];

const noop = () => undefined;

describe('groupByTriggerText', () => {
  it('prints the word alone while flat, and "word: label" once a column is chosen', () => {
    expect(groupByTriggerText('Group', null, GRID_OPTIONS)).toBe('Group');
    expect(groupByTriggerText('Group', 'owner', GRID_OPTIONS)).toBe('Group: Owner');
    expect(groupByTriggerText('Board', 'status', KANBAN_OPTIONS)).toBe('Board: Client Approval');
  });

  it('falls back to the raw key for a stored column the options no longer carry', () => {
    // A stale lens: the view remembers `formats`, which the grid cannot bucket, so the popover no
    // longer offers it. The trigger still says what is stored rather than pretending it is flat.
    expect(groupByTriggerText('Group', 'formats', GRID_OPTIONS)).toBe('Group: formats');
  });
});

describe('GroupByControl', () => {
  it('pins the "None" radio value the e2e locators read', () => {
    expect(GROUP_NONE).toBe('__none__');
  });

  it('keeps the grid slot and reads "Group" while flat, with the Layers glyph before the word', () => {
    const markup = renderToStaticMarkup(
      <GroupByControl options={GRID_OPTIONS} value={null} onChange={noop} />,
    );
    // Closed Radix content is not in server markup, so the trigger is what a render can prove.
    expect(markup).toContain('data-slot="grid-group"');
    expect(markup).toContain('Group</button>');
    expect(markup).toContain('lucide-layers-2');
    expect(markup).toContain('aria-haspopup="menu"');
  });

  it('names the chosen column on the trigger', () => {
    const markup = renderToStaticMarkup(
      <GroupByControl options={GRID_OPTIONS} value="status" onChange={noop} />,
    );
    expect(markup).toContain('Group: Status</button>');
  });

  it('is the Kanban field picker under a caller-named slot, with no "None" and its own label', () => {
    const markup = renderToStaticMarkup(
      <GroupByControl
        options={KANBAN_OPTIONS}
        value="internalStatus"
        allowNone={false}
        slot="creative-sheet-group-by"
        menuLabel="Board columns by"
        onChange={noop}
      />,
    );
    expect(markup).toContain('data-slot="creative-sheet-group-by"');
    expect(markup).not.toContain('data-slot="grid-group"');
    expect(markup).toContain('Group: Internal Status</button>');
  });

  it('takes a trigger word of its own and a disabled state', () => {
    const markup = renderToStaticMarkup(
      <GroupByControl
        options={GRID_OPTIONS}
        value="owner"
        label="Board"
        disabled
        onChange={noop}
      />,
    );
    expect(markup).toContain('Board: Owner</button>');
    expect(markup).toMatch(/<button[^>]*data-slot="grid-group"[^>]*disabled=""/);
  });

  it('holds no colour literal in either flavour', () => {
    const grid = renderToStaticMarkup(
      <GroupByControl options={GRID_OPTIONS} value="status" onChange={noop} />,
    );
    const board = renderToStaticMarkup(
      <GroupByControl
        options={KANBAN_OPTIONS}
        value="status"
        allowNone={false}
        slot="creative-sheet-group-by"
        onChange={noop}
      />,
    );
    expect(grid).not.toMatch(COLOUR_LITERAL);
    expect(board).not.toMatch(COLOUR_LITERAL);
  });
});
