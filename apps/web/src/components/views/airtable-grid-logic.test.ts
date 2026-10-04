import { describe, expect, it } from 'vitest';

import {
  cycleSort,
  sameOffsets,
  sortRows,
  stickyOffsets,
  toggleHidden,
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
