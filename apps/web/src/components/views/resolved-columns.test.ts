import { describe, expect, it } from 'vitest';

import { applyUserView, defaultUserViewConfig } from '@tas/domain';

import { gridColumnsFrom, type ColumnRegistry, type ResolvedColumnView } from './resolved-columns';

interface Row {
  readonly name: string;
  readonly count: number;
}

const registry: ColumnRegistry<Row> = {
  name: { render: (row) => row.name, sortValue: (row) => row.name },
  count: { render: (row) => row.count, align: 'right', minWidth: 80 },
};

const resolved = (...entries: [string, string, number][]): ResolvedColumnView[] =>
  entries.map(([columnKey, displayLabel, displayOrder]) => ({
    columnKey,
    displayLabel,
    displayOrder,
  }));

describe('gridColumnsFrom', () => {
  it('takes the label and the order from the resolver, and the rendering from the registry', () => {
    const { columns, missing } = gridColumnsFrom(
      resolved(['count', 'Linked angles', 2], ['name', 'Name', 1]),
      registry,
    );
    expect(missing).toEqual([]);
    expect(columns.map((column) => [column.key, column.header])).toEqual([
      ['name', 'Name'],
      ['count', 'Linked angles'],
    ]);
    // The registry never supplies a header; a relabel is a data edit, not a code edit.
    expect(columns[1]?.align).toBe('right');
    expect(columns[0]?.sortValue?.({ name: 'Marcus', count: 2 })).toBe('Marcus');
  });

  it('reports a resolved column with no renderer instead of dropping it silently', () => {
    const { columns, missing } = gridColumnsFrom(
      resolved(['name', 'Name', 1], ['passion', 'Passion', 2]),
      registry,
    );
    expect(missing).toEqual(['passion']);
    expect(columns).toHaveLength(1);
  });

  it('orders by integer and breaks ties on the key, so 10 follows 2', () => {
    const { columns } = gridColumnsFrom(
      resolved(['count', 'Ten', 10], ['name', 'Two', 2]),
      registry,
    );
    expect(columns.map((column) => column.key)).toEqual(['name', 'count']);
  });

  it('freezes only the first column, and only when asked — the TABLE DEFAULT', () => {
    const plain = gridColumnsFrom(resolved(['name', 'Name', 1], ['count', 'N', 2]), registry);
    expect(plain.columns.every((column) => column.frozen === undefined)).toBe(true);

    const frozen = gridColumnsFrom(resolved(['name', 'Name', 1], ['count', 'N', 2]), registry, {
      freezeFirst: true,
      frozenMinWidth: 240,
    });
    expect(frozen.columns[0]).toMatchObject({ frozen: true, minWidth: 240 });
    expect(frozen.columns[1]?.frozen).toBeUndefined();
  });

  /**
   * ONE OWNER OF `frozen`, and these two cases pin which (action item 22). `freezeFirst` here and
   * `frozenFields` in `applyUserView` both write the same property, and the grid runs them in that
   * order — so the VIEWER's freeze wins when they have made one, and the table's default stands
   * when they have not. Without a test, the next edit to either side silently flips the precedence
   * and a viewer's freeze choice is overwritten on every render.
   */
  it('a view with its own freeze overrides freezeFirst', () => {
    const { columns } = gridColumnsFrom(
      resolved(['name', 'Name', 1], ['count', 'N', 2]),
      registry,
      { freezeFirst: true },
    );
    const shown = applyUserView(columns, {
      ...defaultUserViewConfig(),
      frozenFields: ['name', 'count'],
    });
    expect(shown.map((column) => column.frozen)).toEqual([true, true]);
  });

  it('a view with no freeze of its own leaves freezeFirst standing', () => {
    const { columns } = gridColumnsFrom(
      resolved(['name', 'Name', 1], ['count', 'N', 2]),
      registry,
      { freezeFirst: true },
    );
    const shown = applyUserView(columns, defaultUserViewConfig());
    expect(shown[0]?.frozen).toBe(true);
    expect(shown[1]?.frozen).toBeUndefined();
  });

  it('is empty, not broken, when the resolver returns nothing', () => {
    expect(gridColumnsFrom([], registry)).toEqual({ columns: [], missing: [] });
  });
});
