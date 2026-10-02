import { describe, expect, it } from 'vitest';

import {
  applyUserView,
  defaultUserViewConfig,
  freezeUpTo,
  frozenUpTo,
  isViewFieldVisible,
  parseUserViewConfig,
  toggleViewField,
  USER_VIEW_NAME_MAX,
  validateUserViewName,
} from './user-views';

const FIELDS: readonly { readonly key: string; readonly frozen?: boolean }[] = [
  { key: 'name', frozen: true },
  { key: 'status' },
  { key: 'notes' },
  { key: 'updated' },
];

describe('validateUserViewName', () => {
  it('trims and accepts a short name', () => {
    expect(validateUserViewName('  My queue ')).toEqual({
      ok: true,
      name: 'My queue',
      error: null,
    });
  });

  it('refuses an empty name and one past the limit, in words', () => {
    expect(validateUserViewName('   ').ok).toBe(false);
    expect(validateUserViewName('x'.repeat(USER_VIEW_NAME_MAX + 1)).error).toMatch(/under/);
  });
});

describe('applyUserView', () => {
  it('shows everything in table order under the default config', () => {
    expect(applyUserView(FIELDS, defaultUserViewConfig()).map((f) => f.key)).toEqual([
      'name',
      'status',
      'notes',
      'updated',
    ]);
  });

  it('orders the listed keys first, drops unknown keys and appends the rest', () => {
    const view = { ...defaultUserViewConfig(), fieldOrder: ['updated', 'ghost', 'name'] };
    expect(applyUserView(FIELDS, view).map((f) => f.key)).toEqual([
      'updated',
      'name',
      'status',
      'notes',
    ]);
  });

  it('hides fields outside visibleFields and keeps the table default freeze', () => {
    const view = { ...defaultUserViewConfig(), visibleFields: ['name', 'notes'] };
    const shown = applyUserView(FIELDS, view);
    expect(shown.map((f) => f.key)).toEqual(['name', 'notes']);
    expect(shown[0]?.frozen).toBe(true);
  });

  it('a non-empty frozenFields replaces the table freeze', () => {
    const view = { ...defaultUserViewConfig(), frozenFields: ['status'] };
    const shown = applyUserView(FIELDS, view);
    expect(shown.find((f) => f.key === 'name')?.frozen).toBe(false);
    expect(shown.find((f) => f.key === 'status')?.frozen).toBe(true);
  });

  it('never hides every column: an all-hidden view keeps the first one', () => {
    const view = { ...defaultUserViewConfig(), visibleFields: [] };
    expect(applyUserView(FIELDS, view).map((f) => f.key)).toEqual(['name']);
  });
});

describe('toggleViewField / isViewFieldVisible', () => {
  const all = FIELDS.map((f) => f.key);

  it('turns "everything" into an explicit list minus the toggled key', () => {
    expect(toggleViewField(defaultUserViewConfig(), 'notes', all)).toEqual([
      'name',
      'status',
      'updated',
    ]);
  });

  it('shows a hidden key again', () => {
    expect(toggleViewField({ visibleFields: ['name'] }, 'notes', all)).toEqual(['name', 'notes']);
  });

  it('reads visibility the same way', () => {
    expect(isViewFieldVisible(defaultUserViewConfig(), 'notes')).toBe(true);
    expect(isViewFieldVisible({ visibleFields: ['name'] }, 'notes')).toBe(false);
  });
});

describe('parseUserViewConfig', () => {
  it('narrows a stored row field by field and falls back on junk', () => {
    expect(
      parseUserViewConfig({
        viewType: 'gallery',
        visibleFields: ['a', 1, null],
        fieldOrder: 'nope',
        frozenFields: undefined,
        sort: { key: 'name', direction: 'desc' },
        filter: 42,
      }),
    ).toEqual({
      viewType: 'gallery',
      visibleFields: ['a'],
      fieldOrder: [],
      frozenFields: [],
      sort: { key: 'name', direction: 'desc' },
      filter: '',
    });
    expect(parseUserViewConfig({ viewType: 'bogus', sort: { key: 'x' } }).viewType).toBe('grid');
    expect(parseUserViewConfig({ viewType: 'bogus' }).sort).toBeNull();
    expect(parseUserViewConfig({}).visibleFields).toBeNull();
  });
});

describe('freezeUpTo / frozenUpTo', () => {
  const keys = FIELDS.map((f) => f.key);

  it('freezes every column up to and including the chosen one', () => {
    expect(freezeUpTo(keys, 'name')).toEqual(['name']);
    expect(freezeUpTo(keys, 'notes')).toEqual(['name', 'status', 'notes']);
  });

  it('reads the view order it is given, not the table order', () => {
    expect(freezeUpTo(['updated', 'name', 'status'], 'name')).toEqual(['updated', 'name']);
  });

  it('returns the table default (an empty list) for null and for a column the view hides', () => {
    expect(freezeUpTo(keys, null)).toEqual([]);
    expect(freezeUpTo(keys, 'ghost')).toEqual([]);
  });

  it('round-trips: the chosen column is the one the control shows back', () => {
    const chosen = 'status';
    const view = { frozenFields: freezeUpTo(keys, chosen) };
    expect(frozenUpTo(keys, view)).toBe(chosen);
  });

  it('reports no choice while the table default is in force', () => {
    expect(frozenUpTo(keys, defaultUserViewConfig())).toBeNull();
  });

  it('reports the last frozen column when a stored freeze is not a clean prefix', () => {
    expect(frozenUpTo(keys, { frozenFields: ['name', 'notes'] })).toBe('notes');
  });
});
