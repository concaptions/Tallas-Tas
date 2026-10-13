import { renderToStaticMarkup } from 'react-dom/server';
import { defaultUserViewConfig } from '@tas/domain';
import { describe, expect, it } from 'vitest';

import { AirtableGrid, type GridColumn } from './airtable-grid';
import { statusGroupHeader } from './grid-cells';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

interface Row {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

const rows: readonly Row[] = [
  { id: 'r1', name: 'TV01-B3-CasualHangouts-V1', type: 'Video' },
  { id: 'r2', name: 'TV01-B3-CasualHangouts-V2', type: 'Video' },
  { id: 'r3', name: 'TS02-B3-CasualHangouts-V1', type: 'Static' },
];

const columns: readonly GridColumn<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    render: (row) => row.name,
    sortValue: (row) => row.name,
  },
  { key: 'type', header: 'Type', render: (row) => row.type },
];

function grid(options: {
  readonly selected?: ReadonlySet<string>;
  readonly selectedId?: string | null;
  readonly contextRowId?: string | null;
}) {
  return renderToStaticMarkup(
    <AirtableGrid
      tableKey="grid-test"
      columns={columns}
      rows={rows}
      rowId={(row) => row.id}
      rowLabel={(row) => row.name}
      onRowClick={() => undefined}
      selectedId={options.selectedId ?? null}
      contextRowId={options.contextRowId ?? null}
      selection={
        options.selected === undefined
          ? undefined
          : { selected: options.selected, onToggle: () => undefined, onToggleAll: () => undefined }
      }
    />,
  );
}

/** The `<tr>` tag of one row, by its accessible name. */
function rowTag(markup: string, name: string): string {
  const match = new RegExp(`<tr[^>]*aria-label="${name}"[^>]*>`).exec(markup);
  if (match === null) throw new Error(`no row named ${name}`);
  return match[0];
}

describe('AirtableGrid multi-select (B3.V3, B3.V4)', () => {
  it('draws the row and header boxes with the Checkbox primitive, slots and state on the INPUT', () => {
    const markup = grid({ selected: new Set(['r1']) });
    // The e2e reads `[data-slot="row-select"]` / `[data-slot="select-all"]` and `.check()`s them:
    // the caller's slot lands on the native input, inside the primitive's `checkbox` wrapper.
    expect(markup.match(/<input type="checkbox"[^>]*data-slot="row-select"/g)).toHaveLength(3);
    expect(markup).toMatch(
      /data-slot="checkbox"[^>]*>\s*<input type="checkbox"[^>]*data-slot="select-all"[^>]*data-state="some"/,
    );
    expect(markup).toMatch(/data-slot="select-all"[^>]*aria-label="Select every row on screen"/);
    expect(markup).toMatch(
      /<input type="checkbox"[^>]*aria-label="Select TV01-B3-CasualHangouts-V1"[^>]*checked=""/,
    );
    // The primitive paints itself: no browser accent colour, the 4px radius on the box.
    expect(markup).toContain('appearance-none');
    expect(markup).not.toContain('accent-[var(--accent)]');
    expect(markup).not.toContain('rounded-input border border-line2 bg-surface2 accent');
  });

  it('reads the header as all / none from the selection', () => {
    expect(grid({ selected: new Set(['r1', 'r2', 'r3']) })).toMatch(
      /data-slot="select-all"[^>]*checked=""[^>]*data-state="all"|data-slot="select-all"[^>]*data-state="all"[^>]*checked=""/,
    );
    expect(grid({ selected: new Set() })).toMatch(/data-slot="select-all"[^>]*data-state="none"/);
  });
});

describe('AirtableGrid row states (B3.V5, ruling 14; B3.A11)', () => {
  const markup = grid({
    selected: new Set(['r1']),
    selectedId: 'r2',
    contextRowId: 'r3',
  });

  it('tells the open, checked and context-menu rows apart', () => {
    const checked = rowTag(markup, 'TV01-B3-CasualHangouts-V1');
    const open = rowTag(markup, 'TV01-B3-CasualHangouts-V2');
    const context = rowTag(markup, 'TS02-B3-CasualHangouts-V1');

    expect(checked).toContain('data-checked="true"');
    expect(checked).toContain('bg-accent-soft/60 shadow-[inset_3px_0_0_var(--accent)]');
    expect(checked).not.toContain('data-context=');

    expect(open).toContain('data-state="selected"');
    expect(open).toContain('data-[state=selected]:bg-surface3');
    expect(open).toContain('data-[state=selected]:shadow-[inset_3px_0_0_var(--accent)]');
    expect(open).not.toContain('data-[state=selected]:bg-accent-soft');

    expect(context).toContain('data-context="open"');
    expect(context).toContain('data-[context=open]:bg-surface3');
    expect(open).not.toContain('data-context="open"');
  });

  it('steps a checked row’s cells up to --text', () => {
    const checkedRow = markup.slice(
      markup.indexOf('aria-label="TV01-B3-CasualHangouts-V1"'),
      markup.indexOf('aria-label="TV01-B3-CasualHangouts-V2"'),
    );
    expect(checkedRow).toMatch(/data-column="type"[^>]*class="[^"]*text-text"/);
    const plainRow = markup.slice(markup.indexOf('aria-label="TS02-B3-CasualHangouts-V1"'));
    expect(plainRow).toMatch(/data-column="type"[^>]*class="[^"]*text-text2"/);
    expect(plainRow).not.toMatch(/data-column="type"[^>]*class="[^"]*text-text"/);
  });
});

describe('AirtableGrid header and row typography (B3.V11, B3.V12, B6.V14)', () => {
  const markup = grid({});

  it('sets every column header as a small uppercase label on surface2, rows at the 42px height', () => {
    expect(markup).toMatch(/<thead[^>]*class="[^"]*bg-surface2/);
    expect(markup).toMatch(
      /<th[^>]*data-column="type"[^>]*class="[^"]*text-\[10px\] font-semibold tracking-widest whitespace-nowrap text-text4 uppercase/,
    );
    // The frozen header cell keeps the header surface so it does not flash `--surface` on scroll.
    expect(markup).toMatch(
      /<th[^>]*data-column="name"[^>]*class="[^"]*sticky z-20 border-r border-line bg-surface2/,
    );
    expect(markup).not.toMatch(/<th[^>]*class="[^"]*font-medium/);
    expect(markup).toMatch(/<td[^>]*data-column="type"[^>]*class="[^"]*py-2\.5/);
  });

  it('holds no colour literal', () => {
    expect(grid({ selected: new Set(['r1']), selectedId: 'r2', contextRowId: 'r3' })).not.toMatch(
      COLOUR_LITERAL,
    );
  });
});

describe('AirtableGrid group headers (B6.V15)', () => {
  const grouped = renderToStaticMarkup(
    <AirtableGrid
      tableKey="grid-test-groups"
      columns={[
        ...columns.filter((column) => column.key !== 'type'),
        {
          key: 'type',
          header: 'Type',
          render: (row) => row.type,
          sortValue: (row) => row.type,
          groupHeader: statusGroupHeader,
        },
      ]}
      rows={[...rows, { id: 'r4', name: 'TS03-B3-CasualHangouts-V1', type: '' }]}
      rowId={(row) => row.id}
      view={{ ...defaultUserViewConfig('grid'), groupBy: 'type' }}
    />,
  );

  it('prints the column’s chip in the header slot while data-group keeps the raw value', () => {
    const video =
      /<tr[^>]*data-slot="grid-group-header"[^>]*data-group="Video"[^>]*>[\s\S]*?<\/tr>/.exec(
        grouped,
      )?.[0];
    expect(video).toBeDefined();
    expect(video).toMatch(/data-slot="status-chip"[^>]*data-tone="mute"[^>]*>Video</);
    expect(video).toMatch(/data-slot="group-count"[^>]*>2</);
    expect(grouped).toMatch(/data-group="Static"[\s\S]*?data-slot="status-chip"[^>]*>Static</);
  });

  it('keeps the empty group in words, never as a chip', () => {
    const empty =
      /<tr[^>]*data-slot="grid-group-header"[^>]*data-group=""[^>]*>[\s\S]*?<\/tr>/.exec(
        grouped,
      )?.[0];
    expect(empty).toContain('>Empty<');
    expect(empty).not.toContain('data-slot="status-chip"');
  });

  it('holds no colour literal', () => {
    expect(grouped).not.toMatch(COLOUR_LITERAL);
  });
});
