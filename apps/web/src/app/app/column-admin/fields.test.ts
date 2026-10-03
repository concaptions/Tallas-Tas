import { COLUMN_SEED } from '@tas/db';
import { describe, expect, it } from 'vitest';

import {
  COLUMN_ADMIN_ADMIN_NOTE,
  COLUMN_ADMIN_NOT_ADMIN_NOTE,
  DEFAULT_TABLE_KEY,
  DEMO_COLUMN_ADMIN_NOTE,
  HIDE_NOTE,
  INHERITANCE_NOTE,
  LEAVES_TEMPLATE_WARNING,
  ORIGIN_LABEL,
  ORIGIN_TONE,
  REATTACH_WARNING,
  SEED_PARENT_BASE_ID,
  columnOrigin,
  labelProblem,
  moveColumn,
  resolveBaseId,
  resolveTableKey,
  restorableColumns,
  restoreWriteOf,
  seedColumnsFor,
  seedHiddenColumnKeys,
  toColumnAdminRows,
  writeOf,
  type ColumnAdminBase,
  type ColumnAdminRow,
  type ResolvedColumnView,
} from './fields';

/** A resolved column, with only the fields a case cares about spelled out. */
function column(partial: Partial<ResolvedColumnView> = {}): ResolvedColumnView {
  return {
    columnKey: 'demographic',
    displayLabel: 'Demographic',
    displayOrder: 3,
    fieldType: 'multilineText',
    source: 'parent',
    isDetached: false,
    inheritedFrom: null,
    ...partial,
  };
}

function rows(...views: ResolvedColumnView[]): readonly ColumnAdminRow[] {
  return toColumnAdminRows(views, false);
}

describe('columnOrigin', () => {
  it('calls every column on the parent base part of the master set', () => {
    expect(columnOrigin(column({ inheritedFrom: null }), true)).toBe('master');
    expect(columnOrigin(column({ source: 'custom' }), true)).toBe('master');
  });

  it('reads a child with no row of its own as following the template', () => {
    expect(columnOrigin(column({ inheritedFrom: 'template-a' }), false)).toBe('inherited');
  });

  it('reads a local row that replaces the parent as detached', () => {
    expect(columnOrigin(column({ isDetached: true }), false)).toBe('detached');
  });

  it('reads a column the child added for itself as added here', () => {
    expect(columnOrigin(column({ source: 'custom' }), false)).toBe('custom');
  });

  it('reads a local row without the detach flag as a local override', () => {
    expect(columnOrigin(column(), false)).toBe('overriding');
  });

  /**
   * The seed marks Gratsi's own `passion` as custom AND detached. It is not detached from anything —
   * the parent has no such column — and reading it as detached would offer a reattach with no
   * parent row to fall back on, which would take the column out of the view altogether.
   */
  it('reads a child-added column as added here even when it is also marked detached', () => {
    expect(columnOrigin(column({ source: 'custom', isDetached: true }), false)).toBe('custom');

    const [added] = rows(column({ source: 'custom', isDetached: true }));

    expect(added).toMatchObject({ canDetach: false, canReattach: false });
  });

  it('gives every origin a label and a chip tone from the shared vocabulary', () => {
    for (const origin of ['master', 'inherited', 'overriding', 'detached', 'custom'] as const) {
      expect(ORIGIN_LABEL[origin].length).toBeGreaterThan(0);
      expect(['ok', 'warn', 'bad', 'info', 'accent', 'mute']).toContain(ORIGIN_TONE[origin]);
    }
  });
});

describe('toColumnAdminRows', () => {
  it('offers detach to an inherited column and reattach to a local one', () => {
    const [inherited, overridden] = rows(
      column({ columnKey: 'a', inheritedFrom: 'template-a' }),
      column({ columnKey: 'b' }),
    );

    expect(inherited).toMatchObject({ canDetach: true, canReattach: false });
    expect(overridden).toMatchObject({ canDetach: true, canReattach: true });
  });

  it('offers neither on the parent base, which has nothing to detach from', () => {
    const [master] = toColumnAdminRows([column()], true);

    expect(master).toMatchObject({ origin: 'master', canDetach: false, canReattach: false });
  });

  it('offers reattach but not detach on an already detached column', () => {
    const [detached] = rows(column({ isDetached: true }));

    expect(detached).toMatchObject({ canDetach: false, canReattach: true });
  });

  it('offers neither on a column the child added, which the parent does not have', () => {
    const [added] = rows(column({ source: 'custom' }));

    expect(added).toMatchObject({ canDetach: false, canReattach: false });
  });
});

describe('writeOf', () => {
  it('carries the whole row, because the upsert replaces it', () => {
    const [row] = rows(column({ isDetached: true }));
    if (row === undefined) throw new Error('no row');

    expect(writeOf(row)).toEqual({
      columnKey: 'demographic',
      displayLabel: 'Demographic',
      displayOrder: 3,
      isHidden: false,
      isDetached: true,
      fieldType: 'multilineText',
      source: 'parent',
    });
  });

  it('changes one field and leaves the rest of the row alone', () => {
    const [row] = rows(column());
    if (row === undefined) throw new Error('no row');

    expect(writeOf(row, { isHidden: true })).toMatchObject({
      displayLabel: 'Demographic',
      displayOrder: 3,
      isHidden: true,
    });
  });
});

describe('restorableColumns', () => {
  const parent = [
    column({ columnKey: 'name', displayOrder: 1 }),
    column({ columnKey: 'demographic', displayOrder: 3 }),
    column({ columnKey: 'core_desires', displayOrder: 5 }),
  ];

  it('offers the parent columns this base does not show, which are the ones it hid', () => {
    const shown = [column({ columnKey: 'name', displayOrder: 1 })];

    expect(restorableColumns(parent, shown).map((entry) => entry.columnKey)).toEqual([
      'demographic',
      'core_desires',
    ]);
  });

  it('offers nothing when the base already shows every parent column', () => {
    expect(restorableColumns(parent, parent)).toEqual([]);
  });

  it('offers nothing on the parent base, where the two sets are the same read', () => {
    expect(restorableColumns([], parent)).toEqual([]);
  });
});

/**
 * The write that unhides a parent column on a brand. It carries `source: 'parent'` and no detach
 * flag on purpose: a resurrected row marked `custom` is what the schema forbids for a column the
 * parent owns, and it could then never be detached or reattached again.
 */
describe('restoreWriteOf', () => {
  it("writes the parent's own row back, unhidden and on the template track", () => {
    expect(
      restoreWriteOf(
        column({
          columnKey: 'core_desires',
          displayLabel: 'Core Desires (Cashvertising)',
          displayOrder: 5,
          fieldType: 'multilineText',
          isDetached: true,
          inheritedFrom: 'template-a',
        }),
      ),
    ).toEqual({
      columnKey: 'core_desires',
      displayLabel: 'Core Desires (Cashvertising)',
      displayOrder: 5,
      isHidden: false,
      isDetached: false,
      fieldType: 'multilineText',
      source: 'parent',
    });
  });
});

describe('moveColumn', () => {
  const three = rows(
    column({ columnKey: 'a', displayOrder: 1 }),
    column({ columnKey: 'b', displayOrder: 2 }),
    column({ columnKey: 'c', displayOrder: 3 }),
  );

  it('swaps the two rows that change places, and writes nothing else', () => {
    expect(moveColumn(three, 'c', 'up')).toEqual([
      expect.objectContaining({ columnKey: 'c', displayOrder: 2 }),
      expect.objectContaining({ columnKey: 'b', displayOrder: 3 }),
    ]);
  });

  it('moves a column down the same way', () => {
    expect(moveColumn(three, 'a', 'down')).toEqual([
      expect.objectContaining({ columnKey: 'a', displayOrder: 2 }),
      expect.objectContaining({ columnKey: 'b', displayOrder: 1 }),
    ]);
  });

  it('writes nothing for an impossible move or an unknown column', () => {
    expect(moveColumn(three, 'a', 'up')).toEqual([]);
    expect(moveColumn(three, 'c', 'down')).toEqual([]);
    expect(moveColumn(three, 'nope', 'up')).toEqual([]);
    expect(moveColumn([], 'a', 'up')).toEqual([]);
  });

  /**
   * Swapping numbers cannot reorder a table whose numbers are not distinct — the resolver
   * tie-breaks on `column_key`, so the pair would not actually move. A duplicate renumbers to
   * 1..n instead, and still reports only the rows that moved.
   */
  it('renumbers the table when two columns share a position', () => {
    const tied = rows(
      column({ columnKey: 'a', displayOrder: 1 }),
      column({ columnKey: 'b', displayOrder: 1 }),
      column({ columnKey: 'c', displayOrder: 4 }),
    );

    expect(moveColumn(tied, 'c', 'up')).toEqual([
      expect.objectContaining({ columnKey: 'c', displayOrder: 2 }),
      expect.objectContaining({ columnKey: 'b', displayOrder: 3 }),
    ]);
  });
});

describe('labelProblem', () => {
  it('accepts a real label', () => {
    expect(labelProblem('Description [Age Status Salary]')).toBeNull();
  });

  it('refuses an empty or whitespace-only label', () => {
    expect(labelProblem('')).toBe('A label is required.');
    expect(labelProblem('   ')).toBe('A label is required.');
  });

  it('refuses a label too long to render', () => {
    expect(labelProblem('x'.repeat(121))).toBe('Keep the label under 120 characters.');
  });
});

describe('resolveBaseId', () => {
  const bases: readonly ColumnAdminBase[] = [
    { id: 'template-a', name: 'Parent template', isTemplate: true },
    { id: 'brand-a', name: 'Gratsi', isTemplate: false },
  ];

  it('honours a base the agency actually has', () => {
    expect(resolveBaseId('brand-a', bases)).toBe('brand-a');
    expect(resolveBaseId(['brand-a'], bases)).toBe('brand-a');
  });

  it('falls back to the template for an unknown, forged or missing id', () => {
    expect(resolveBaseId('brand-of-another-agency', bases)).toBe('template-a');
    expect(resolveBaseId(undefined, bases)).toBe('template-a');
  });

  it('answers null when the workspace has no base at all', () => {
    expect(resolveBaseId('brand-a', [])).toBeNull();
  });
});

describe('resolveTableKey', () => {
  const tables = ['angles', 'personas', 'products'];

  it('honours a table the product has', () => {
    expect(resolveTableKey('angles', tables)).toBe('angles');
  });

  it('falls back to the default table for anything else', () => {
    expect(resolveTableKey('themes', tables)).toBe(DEFAULT_TABLE_KEY);
    expect(resolveTableKey(undefined, tables)).toBe(DEFAULT_TABLE_KEY);
  });
});

describe('seedColumnsFor (demo mode)', () => {
  it("renders the parent's Personas set in Airtable field order", () => {
    const columns = seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, 'personas');

    expect(columns.length).toBeGreaterThan(0);
    expect(columns[0]).toMatchObject({ columnKey: 'name', displayOrder: 1 });
    expect(columns.map((entry) => entry.displayOrder)).toEqual(
      [...columns].map((entry) => entry.displayOrder).sort((left, right) => left - right),
    );
  });

  it("renders a child's own departures under its own names, hidden rows left out", () => {
    const columns = seedColumnsFor(COLUMN_SEED, 'gratsi', 'personas');

    expect(columns.map((entry) => entry.columnKey)).toEqual([
      'name',
      'demographic',
      'psychographic',
      'core_desires',
      'passion',
      'stage_of_awareness',
      'angle_personas',
    ]);
    expect(columns[1]?.displayLabel).toBe('Description [Age Status Salary]');
    expect(columns.every((entry) => entry.inheritedFrom === null)).toBe(true);
  });

  it('is empty for a base the seed says nothing about', () => {
    // Funky Painting has no seed group at all, so the base owns no rows of its own.
    expect(seedColumnsFor(COLUMN_SEED, 'funky-painting', 'personas')).toEqual([]);
    // `youtube_copy` is one of the six tables that exist only in the Gratsi base, so the PARENT has
    // no rows for it. (`products` used to serve as this case and no longer can: the seed now covers
    // all 21 tables, and the parent owns two products columns.)
    expect(seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, 'youtube_copy')).toEqual([]);
  });

  it('returns the parent rows for a table the seed DOES cover, so the empty case above means something', () => {
    const products = seedColumnsFor(COLUMN_SEED, SEED_PARENT_BASE_ID, 'products');
    expect(products.length).toBeGreaterThan(0);
    expect(products.map((column) => column.columnKey)).toContain('name');
  });
});

describe('seedHiddenColumnKeys (demo mode)', () => {
  it("names the parent columns a child's seed hides, and nothing it shows", () => {
    const hidden = seedHiddenColumnKeys(COLUMN_SEED, 'gratsi', 'personas');

    expect(hidden).toContain('day_in_the_life');
    expect(hidden).not.toContain('demographic');
  });

  it('is empty for the parent base and for a base the seed says nothing about', () => {
    expect(seedHiddenColumnKeys(COLUMN_SEED, SEED_PARENT_BASE_ID, 'personas')).toEqual([]);
    expect(seedHiddenColumnKeys(COLUMN_SEED, 'funky-painting', 'personas')).toEqual([]);
  });
});

describe('the page copy', () => {
  it('says the page is admin only, and names the role a refused reader needs', () => {
    expect(COLUMN_ADMIN_ADMIN_NOTE).toContain('admin only');
    expect(COLUMN_ADMIN_NOT_ADMIN_NOTE).toContain('Admin');
  });

  /**
   * The copy used to promise that a detached column "ignores the template until it is reattached",
   * which implies a non-detached local row still follows it. `resolveColumns` has no such rule:
   * a local row wins either way, and `is_detached` is never read as a condition. These cases pin
   * the note to what the resolver does.
   */
  it('says a local row is what stops a column following the template, flag or no flag', () => {
    expect(INHERITANCE_NOTE).toContain('holds no definition of its own');
    expect(INHERITANCE_NOTE).toContain('Relabelling or moving');
    expect(INHERITANCE_NOTE).toContain('does not read the flag yet');
    expect(COLUMN_ADMIN_ADMIN_NOTE).not.toContain('detached');
  });

  it('warns in the relabel dialog before a column leaves the template track', () => {
    expect(LEAVES_TEMPLATE_WARNING).toContain('following the parent template');
    expect(LEAVES_TEMPLATE_WARNING).toContain('stop applying');
  });

  /**
   * It used to say "Add the column again by the same key", which would resurrect a parent column as
   * a locally added one and strand it off the template track for good.
   */
  it('does not offer re-adding a key as the way back from Hide', () => {
    expect(HIDE_NOTE).toContain('Restore list');
    expect(HIDE_NOTE).toContain('cannot be brought back');
    expect(HIDE_NOTE).not.toContain('same key');
  });

  it('warns that reattaching loses the custom label and position', () => {
    expect(REATTACH_WARNING).toContain('label');
    expect(REATTACH_WARNING).toContain('lost');
    expect(REATTACH_WARNING).toContain('recoverable');
  });

  it('says demo mode stubs the role check rather than skipping it', () => {
    expect(DEMO_COLUMN_ADMIN_NOTE).toContain('Admin');
    expect(DEMO_COLUMN_ADMIN_NOTE).toContain('stubbed, not skipped');
  });
});
