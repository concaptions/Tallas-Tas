import { describe, expect, it } from 'vitest';

import {
  applyFilters,
  cycleSort,
  EMPTY_GROUP_LABEL,
  groupRows,
  sameOffsets,
  sortRows,
  stickyOffsets,
  toggleHidden,
  type FilterableColumn,
  type RowFilter,
} from './airtable-grid-logic';

describe('cycleSort', () => {
  it('starts a fresh column at ascending', () => {
    expect(cycleSort(null, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(cycleSort({ key: 'other', direction: 'desc' }, 'name')).toEqual({
      key: 'name',
      direction: 'asc',
    });
  });

  it('cycles the active column asc → desc → none', () => {
    const asc = cycleSort(null, 'name');
    expect(asc).toEqual({ key: 'name', direction: 'asc' });
    const desc = cycleSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', direction: 'desc' });
    expect(cycleSort(desc, 'name')).toBeNull();
  });
});

describe('sortRows', () => {
  const rows = [
    { n: 'B', v: 2 },
    { n: 'a', v: 10 },
    { n: 'C', v: 1 },
  ];

  it('sorts strings case-insensitively by locale', () => {
    expect(sortRows(rows, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['a', 'B', 'C']);
    expect(sortRows(rows, (r) => r.n, 'desc').map((r) => r.n)).toEqual(['C', 'B', 'a']);
  });

  it('sorts numbers numerically, not lexically', () => {
    expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v)).toEqual([1, 2, 10]);
  });

  it('puts nulls last in both directions and does not mutate the input', () => {
    const withNulls = [{ n: 'A' as string | null }, { n: null }, { n: 'B' }];
    expect(sortRows(withNulls, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['A', 'B', null]);
    expect(sortRows(withNulls, (r) => r.n, 'desc').map((r) => r.n)).toEqual(['B', 'A', null]);
    expect(withNulls.map((r) => r.n)).toEqual(['A', null, 'B']);
  });
});

describe('toggleHidden', () => {
  it('adds, then removes, a key without mutating the input', () => {
    const empty = new Set<string>();
    const withName = toggleHidden(empty, 'name');
    expect([...withName]).toEqual(['name']);
    expect(empty.size).toBe(0);
    expect(toggleHidden(withName, 'name').size).toBe(0);
  });
});

describe('stickyOffsets', () => {
  it('leaves a single frozen column at the left edge', () => {
    expect(stickyOffsets([220])).toEqual([0]);
  });

  it('offsets each frozen column by the widths before it, never stacking them at 0', () => {
    // The bug this exists for: three frozen columns all pinned at `left: 0` overlap, so the second
    // and third are invisible under the first as soon as the grid scrolls sideways.
    expect(stickyOffsets([220, 120, 80])).toEqual([0, 220, 340]);
  });

  it('is empty when nothing is frozen', () => {
    expect(stickyOffsets([])).toEqual([]);
  });

  it('tolerates a zero width: an unmeasured cell shifts nothing', () => {
    expect(stickyOffsets([200, 0, 90])).toEqual([0, 200, 200]);
  });
});

describe('sameOffsets', () => {
  it('is true for the same keys and the same numbers', () => {
    expect(sameOffsets({ name: 0, batch: 220 }, { name: 0, batch: 220 })).toBe(true);
  });

  it('is false when a width changed', () => {
    expect(sameOffsets({ name: 0, batch: 220 }, { name: 0, batch: 240 })).toBe(false);
  });

  it('is false when the frozen set changed', () => {
    expect(sameOffsets({ name: 0 }, { name: 0, batch: 220 })).toBe(false);
    expect(sameOffsets({ name: 0, batch: 220 }, { name: 0, theme: 220 })).toBe(false);
  });

  it('treats two empty maps as equal, so the first measure of an unfrozen grid is not a render', () => {
    expect(sameOffsets({}, {})).toBe(true);
  });
});

/**
 * The field conditions and the grouping of AI-32, pinned operator by operator. The fixture rows
 * are creators in miniature: a string column with a sortValue, a numeric column, a column whose
 * text lives in cellTitle only, and a column the grid cannot read at all.
 */
interface FilterRow {
  readonly name: string;
  readonly status: string | null;
  readonly cost: number | null;
  readonly link: string | null;
}

const FILTER_ROWS: readonly FilterRow[] = [
  { name: 'Danielle', status: 'Approved', cost: 630, link: 'https://a.example/one' },
  { name: 'Marcus', status: 'approved', cost: null, link: null },
  { name: 'Priya', status: 'Filming', cost: 540, link: 'https://b.example/two' },
  { name: 'Tomás', status: null, cost: 0, link: 'https://a.example/three' },
];

const FILTER_COLUMNS: readonly FilterableColumn<FilterRow>[] = [
  { key: 'name', sortValue: (row) => row.name },
  { key: 'status', sortValue: (row) => row.status },
  { key: 'cost', sortValue: (row) => row.cost },
  { key: 'link', cellTitle: (row) => row.link ?? undefined },
  { key: 'unreadable' },
];

const names = (rows: readonly FilterRow[]): string[] => rows.map((row) => row.name);

describe('applyFilters', () => {
  const one = (filter: RowFilter) => applyFilters(FILTER_ROWS, [filter], FILTER_COLUMNS);

  it('is / is_not compare the whole value, case-insensitively', () => {
    expect(names(one({ field: 'status', op: 'is', value: 'approved' }))).toEqual([
      'Danielle',
      'Marcus',
    ]);
    expect(names(one({ field: 'status', op: 'is_not', value: 'Approved' }))).toEqual([
      'Priya',
      'Tomás',
    ]);
  });

  it('contains is a substring match over the readable text, numbers included', () => {
    expect(names(one({ field: 'name', op: 'contains', value: 'ani' }))).toEqual(['Danielle']);
    expect(names(one({ field: 'cost', op: 'contains', value: '0' }))).toEqual([
      'Danielle',
      'Priya',
      'Tomás',
    ]);
  });

  it('empty / not_empty read a null as empty and a zero as a value', () => {
    expect(names(one({ field: 'status', op: 'empty', value: '' }))).toEqual(['Tomás']);
    // Marcus has cost null — empty. Tomás has cost 0, which IS a stored number, not an absence.
    expect(names(one({ field: 'cost', op: 'empty', value: '' }))).toEqual(['Marcus']);
    expect(names(one({ field: 'cost', op: 'not_empty', value: '' }))).toEqual([
      'Danielle',
      'Priya',
      'Tomás',
    ]);
  });

  it('reads a column whose text lives in cellTitle, not sortValue', () => {
    expect(names(one({ field: 'link', op: 'contains', value: 'a.example' }))).toEqual([
      'Danielle',
      'Tomás',
    ]);
    expect(names(one({ field: 'link', op: 'empty', value: '' }))).toEqual(['Marcus']);
  });

  it('ANDs several conditions: every one must hold', () => {
    expect(
      names(
        applyFilters(
          FILTER_ROWS,
          [
            { field: 'status', op: 'is', value: 'approved' },
            { field: 'cost', op: 'not_empty', value: '' },
          ],
          FILTER_COLUMNS,
        ),
      ),
    ).toEqual(['Danielle']);
  });

  it('ignores a condition on a column the table does not carry, or cannot read', () => {
    // The adversarial edge the QA brief names: a stored filter on a column this brand does not
    // resolve. Degrade to the default (the condition drops out), never to nothing (a blank grid).
    expect(names(one({ field: 'ghost', op: 'is', value: 'x' }))).toEqual(names(FILTER_ROWS));
    expect(names(one({ field: 'unreadable', op: 'not_empty', value: '' }))).toEqual(
      names(FILTER_ROWS),
    );
    // A dead condition beside a live one: only the live one bites.
    expect(
      names(
        applyFilters(
          FILTER_ROWS,
          [
            { field: 'ghost', op: 'is', value: 'x' },
            { field: 'status', op: 'is', value: 'filming' },
          ],
          FILTER_COLUMNS,
        ),
      ),
    ).toEqual(['Priya']);
  });

  it('hands the same array back for the empty condition list, and copes with no rows', () => {
    expect(applyFilters(FILTER_ROWS, [], FILTER_COLUMNS)).toBe(FILTER_ROWS);
    expect(applyFilters([], [{ field: 'status', op: 'is', value: 'x' }], FILTER_COLUMNS)).toEqual(
      [],
    );
  });
});

describe('groupRows', () => {
  it('buckets rows under the column values in first-appearance order, counted by length', () => {
    const groups = groupRows(FILTER_ROWS, 'status', FILTER_COLUMNS);
    expect(groups?.map((group) => group.label)).toEqual(['Approved', 'Filming', EMPTY_GROUP_LABEL]);
    expect(groups?.map((group) => group.rows.length)).toEqual([2, 1, 1]);
    // Case-folded into one bucket under the first spelling seen, as applyFilters compares.
    expect(names(groups?.[0]?.rows ?? [])).toEqual(['Danielle', 'Marcus']);
  });

  it('labels the empty-celled bucket in words, never as a blank header', () => {
    const groups = groupRows(FILTER_ROWS, 'status', FILTER_COLUMNS);
    const empty = groups?.find((group) => group.value === '');
    expect(empty?.label).toBe(EMPTY_GROUP_LABEL);
    expect(names(empty?.rows ?? [])).toEqual(['Tomás']);
  });

  it('groups by an entirely empty-valued column into the one Empty bucket', () => {
    // The QA brief's edge: grouping by a column no row has filled in. One honest bucket, every
    // row in it, rather than a crash or a bucket per row.
    const rows: readonly FilterRow[] = [
      { name: 'A', status: null, cost: null, link: null },
      { name: 'B', status: '   ', cost: null, link: null },
    ];
    const groups = groupRows(rows, 'status', FILTER_COLUMNS);
    expect(groups?.length).toBe(1);
    expect(groups?.[0]?.label).toBe(EMPTY_GROUP_LABEL);
    expect(names(groups?.[0]?.rows ?? [])).toEqual(['A', 'B']);
  });

  it('returns null — render flat — for a column the table does not carry or cannot read', () => {
    expect(groupRows(FILTER_ROWS, 'ghost', FILTER_COLUMNS)).toBeNull();
    expect(groupRows(FILTER_ROWS, 'unreadable', FILTER_COLUMNS)).toBeNull();
  });

  it('groups nothing into nothing', () => {
    expect(groupRows([], 'status', FILTER_COLUMNS)).toEqual([]);
  });
});
