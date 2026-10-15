import { describe, expect, it } from 'vitest';

import {
  applyGroupOrder,
  isStatusField,
  pinGroup,
  reorderGroups,
  statusEnumOrderFor,
  unpinGroup,
  type GroupOrderEntry,
} from './group-order';
import { INTERNAL_STATUS } from '../state/creative-status';

describe('applyGroupOrder', () => {
  it('with no saved order and alpha default → alphabetical', () => {
    const result = applyGroupOrder(['charlie', 'alpha', 'bravo'], null, 'alpha');
    expect(result).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('with no saved order and enum default → enum order, extras appended alphabetically', () => {
    const enumOrder = INTERNAL_STATUS.map((entry) => entry.key);
    const groupValues = ['approved', 'draft', 'brand_new_key', 'revisions_needed'];
    const result = applyGroupOrder(groupValues, null, 'enum', enumOrder);
    // Known keys first in enum order, unknown key appended.
    expect(result).toEqual(['draft', 'revisions_needed', 'approved', 'brand_new_key']);
  });

  it('with a saved order and no pins → saved order applied, extras appended in default order', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'charlie', position: 0, pinned: false },
      { value: 'alpha', position: 1, pinned: false },
    ];
    const result = applyGroupOrder(['charlie', 'alpha', 'bravo'], saved, 'alpha');
    expect(result).toEqual(['charlie', 'alpha', 'bravo']);
  });

  it('with pinned entries → pinned first (in position order), then unpinned, then extras', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'alpha', position: 1, pinned: false },
      { value: 'bravo', position: 0, pinned: true },
      { value: 'charlie', position: 1, pinned: true },
      { value: 'delta', position: 0, pinned: false },
    ];
    const result = applyGroupOrder(['alpha', 'bravo', 'charlie', 'delta', 'echo'], saved, 'alpha');
    expect(result).toEqual(['bravo', 'charlie', 'delta', 'alpha', 'echo']);
  });

  it('drops saved entries whose value is no longer in the grid', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'retired_key', position: 0, pinned: true },
      { value: 'alpha', position: 1, pinned: false },
    ];
    const result = applyGroupOrder(['alpha', 'bravo'], saved, 'alpha');
    expect(result).toEqual(['alpha', 'bravo']);
  });

  it('returns a fresh array (never mutates `groupValues`)', () => {
    const input = ['b', 'a', 'c'];
    const result = applyGroupOrder(input, null, 'alpha');
    expect(input).toEqual(['b', 'a', 'c']);
    expect(result).not.toBe(input);
  });
});

describe('pinGroup', () => {
  it('pins a previously-unpinned entry at position 0', () => {
    const result = pinGroup(null, 'alpha');
    expect(result).toEqual([{ value: 'alpha', position: 0, pinned: true }]);
  });

  it('shifts the previously-top pinned entry down to position 1', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'bravo', position: 0, pinned: true },
      { value: 'alpha', position: 0, pinned: false },
    ];
    const result = pinGroup(saved, 'charlie');
    expect(result).toContainEqual({ value: 'charlie', position: 0, pinned: true });
    expect(result).toContainEqual({ value: 'bravo', position: 1, pinned: true });
    // Unpinned block retained.
    expect(result).toContainEqual({ value: 'alpha', position: 0, pinned: false });
  });

  it('re-pinning an existing pinned entry puts it back at position 0', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'bravo', position: 0, pinned: true },
      { value: 'charlie', position: 1, pinned: true },
    ];
    const result = pinGroup(saved, 'charlie');
    const charlie = result.find((entry) => entry.value === 'charlie');
    const bravo = result.find((entry) => entry.value === 'bravo');
    expect(charlie?.position).toBe(0);
    expect(bravo?.position).toBe(1);
    expect(result).toHaveLength(2);
  });
});

describe('unpinGroup', () => {
  it('flips `pinned` to false but preserves `position`', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'alpha', position: 3, pinned: true },
      { value: 'bravo', position: 0, pinned: false },
    ];
    const result = unpinGroup(saved, 'alpha');
    expect(result).toContainEqual({ value: 'alpha', position: 3, pinned: false });
    expect(result).toContainEqual({ value: 'bravo', position: 0, pinned: false });
  });

  it('is a no-op when the value has no entry', () => {
    const saved: GroupOrderEntry[] = [{ value: 'alpha', position: 0, pinned: false }];
    expect(unpinGroup(saved, 'bravo')).toEqual(saved);
  });
});

describe('reorderGroups', () => {
  it('writes positions by array index and carries pinned flags', () => {
    const saved: GroupOrderEntry[] = [
      { value: 'alpha', position: 2, pinned: true },
      { value: 'bravo', position: 0, pinned: false },
    ];
    const result = reorderGroups(saved, ['bravo', 'alpha', 'charlie']);
    expect(result).toEqual([
      { value: 'bravo', position: 0, pinned: false },
      { value: 'alpha', position: 1, pinned: true },
      { value: 'charlie', position: 2, pinned: false },
    ]);
  });
});

describe('isStatusField', () => {
  it('is true for every live status key', () => {
    expect(isStatusField('internal_status')).toBe(true);
    expect(isStatusField('client_approval_status')).toBe(true);
    expect(isStatusField('client_status')).toBe(true);
    expect(isStatusField('concept_client_status')).toBe(true);
    expect(isStatusField('copy_client_status')).toBe(true);
    expect(isStatusField('internal_creator_status')).toBe(true);
  });

  it('is false for other field keys', () => {
    expect(isStatusField('name')).toBe(false);
    expect(isStatusField('assignee')).toBe(false);
    expect(isStatusField('')).toBe(false);
    expect(isStatusField('category')).toBe(false);
  });
});

describe('statusEnumOrderFor', () => {
  it('returns the INTERNAL_STATUS keys for internal_status', () => {
    expect(statusEnumOrderFor('internal_status')).toEqual(
      INTERNAL_STATUS.map((entry) => entry.key),
    );
  });

  it('returns null for an unknown field key', () => {
    expect(statusEnumOrderFor('category')).toBeNull();
  });
});
