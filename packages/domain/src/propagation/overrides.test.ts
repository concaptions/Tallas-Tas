import { describe, expect, it } from 'vitest';

import { computeOverrides, hasOverrides } from './overrides';

describe('computeOverrides', () => {
  it('adds every edited field to an empty set, sorted and deduplicated', () => {
    expect(computeOverrides({ current: [], edited: ['name', 'batch', 'name'] })).toEqual([
      'batch',
      'name',
    ]);
  });

  it('merges edited fields into an existing set without disturbing untouched overrides', () => {
    expect(computeOverrides({ current: ['color'], edited: ['name'] })).toEqual(['color', 'name']);
  });

  it('is idempotent: re-recording the same edit does not grow the set', () => {
    const once = computeOverrides({ current: ['name'], edited: ['name'] });
    expect(once).toEqual(['name']);
  });

  it('drops a field that the edit set back to the template value (back in sync)', () => {
    expect(
      computeOverrides({
        current: ['name', 'batch'],
        edited: ['name'],
        matchesTemplate: (field) => field === 'name',
      }),
    ).toEqual(['batch']);
  });

  it('adds a diverging field and drops a re-synced one in the same edit', () => {
    expect(
      computeOverrides({
        current: ['batch'],
        edited: ['name', 'batch'],
        matchesTemplate: (field) => field === 'batch',
      }),
    ).toEqual(['name']);
  });

  it('never mutates its inputs', () => {
    const current = ['a'];
    const edited = ['b'];
    computeOverrides({ current, edited });
    expect(current).toEqual(['a']);
    expect(edited).toEqual(['b']);
  });
});

describe('hasOverrides', () => {
  it('is true only when at least one field is overridden', () => {
    expect(hasOverrides([])).toBe(false);
    expect(hasOverrides(['name'])).toBe(true);
  });
});
