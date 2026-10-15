/**
 * Pure helpers for the manual group ordering a user can set on a grouped table view (Phase B5
 * commit 2). The DAO in `@tas/db` stores the user's choice; this module alone owns what that
 * choice MEANS when the grid draws it, and is unit-tested with fixtures.
 *
 * The data: a `GroupOrderEntry[]` is a list of `{ value, position, pinned }` records. `position`
 * is a 0-indexed slot the user put the group in; `pinned` lifts a group above every unpinned one.
 * The stored list may not mention every group a grid is drawing: a new value that was added since
 * (a new status key, a new assignee) is NOT in `saved`, and the helper here appends it at the end
 * in default order rather than hiding it.
 */

import { INTERNAL_STATUS, CLIENT_STATUS } from '../state/creative-status';
import { CREATOR_INTERNAL_STATUS } from '../state/creator-status';

/**
 * One entry of the user's saved order. Re-declared here rather than imported from `@tas/db` so
 * the domain package stays free of a DB dependency; the two shapes are kept equal by the server
 * action which bridges them (and the type-checker catches any drift at the call site).
 */
export interface GroupOrderEntry {
  readonly value: string;
  readonly position: number;
  readonly pinned: boolean;
}

/**
 * The grouping field keys that carry a known STATUS enum. For these, the default order (when the
 * user has not pinned or dragged anything) is the enum's own order, not alphabetical: a draft
 * ladder reads `draft → … → approved`, never `approved → draft`.
 *
 * The list is the authoritative set from `../state`: `creative_briefs.internal_status`,
 * `concepts.client_approval_status`, `copywriting.client_approval_status`,
 * `creative_briefs.client_status`, `creators.client_status` and its internal counterpart. Any key
 * not here falls back to alphabetical in `applyGroupOrder`.
 */
const STATUS_FIELD_KEYS: readonly string[] = [
  'internal_status',
  'client_status',
  'client_approval_status',
  'concept_client_status',
  'copy_client_status',
  'internal_creator_status',
] as const;

export function isStatusField(fieldKey: string): boolean {
  return STATUS_FIELD_KEYS.includes(fieldKey);
}

/**
 * The default order of the known status enums, keyed by the field name callers group by. A field
 * whose stored keys match more than one of these falls back to the first match (there is no
 * ambiguity today — `internal_status` is briefs/concepts only, the client tracks all share the
 * same vocabulary, `internal_creator_status` is the creator-only ladder).
 */
export function statusEnumOrderFor(fieldKey: string): readonly string[] | null {
  switch (fieldKey) {
    case 'internal_status':
      return INTERNAL_STATUS.map((entry) => entry.key);
    case 'client_status':
    case 'client_approval_status':
    case 'concept_client_status':
    case 'copy_client_status':
      return CLIENT_STATUS.map((entry) => entry.key);
    case 'internal_creator_status':
      return CREATOR_INTERNAL_STATUS.map((entry) => entry.key);
    default:
      return null;
  }
}

/**
 * Resolve the final order of groups for one grouped view. Pure, deterministic.
 *
 * Rules, in order:
 *   1. If `saved` is `null`, return the DEFAULT order — the enum order for a status field, or
 *      the alphabetical order of `groupValues` otherwise. Done.
 *   2. Otherwise split `saved` into pinned and unpinned, each sorted ascending by `position`.
 *   3. The returned list is: pinned entries' values (first), then unpinned entries' values, then
 *      any value in `groupValues` not mentioned by `saved`, appended in default order.
 *
 * Values the user ordered but the grid is no longer drawing are DROPPED — a stale entry for a
 * status key that was renamed must not conjure an empty header.
 */
export function applyGroupOrder(
  groupValues: readonly string[],
  saved: readonly GroupOrderEntry[] | null,
  defaultSort: 'enum' | 'alpha',
  enumOrder?: readonly string[],
): string[] {
  const defaultOrdered = defaultSortOrder(groupValues, defaultSort, enumOrder);

  if (saved === null || saved.length === 0) {
    return defaultOrdered;
  }

  const groupSet = new Set(groupValues);
  const seen = new Set<string>();

  const pinned = [...saved]
    .filter((entry) => entry.pinned && groupSet.has(entry.value))
    .sort((a, b) => a.position - b.position);
  const unpinned = [...saved]
    .filter((entry) => !entry.pinned && groupSet.has(entry.value))
    .sort((a, b) => a.position - b.position);

  const ordered: string[] = [];
  for (const entry of pinned) {
    if (!seen.has(entry.value)) {
      ordered.push(entry.value);
      seen.add(entry.value);
    }
  }
  for (const entry of unpinned) {
    if (!seen.has(entry.value)) {
      ordered.push(entry.value);
      seen.add(entry.value);
    }
  }
  for (const value of defaultOrdered) {
    if (!seen.has(value)) {
      ordered.push(value);
      seen.add(value);
    }
  }
  return ordered;
}

/**
 * Produce the saved entries that correspond to pinning `value` to the top. Pure: returns a new
 * array and never mutates `saved`.
 *
 * The pinned entry lands at position 0 (the top of the pinned section). Any previously-top entry
 * drops one slot — `position` numbers are shifted so the stored shape stays contiguous. An entry
 * for `value` that was unpinned becomes pinned, with position 0.
 */
export function pinGroup(
  saved: readonly GroupOrderEntry[] | null,
  value: string,
): GroupOrderEntry[] {
  const current = saved ?? [];
  const others = current.filter((entry) => entry.value !== value);
  // Shift the positions of every OTHER pinned entry down by one, so the new pin sits above them.
  const shifted = others.map((entry) =>
    entry.pinned ? { ...entry, position: entry.position + 1 } : entry,
  );
  const pinnedEntry: GroupOrderEntry = { value, position: 0, pinned: true };
  const pinnedBlock = [pinnedEntry, ...shifted.filter((entry) => entry.pinned)].sort(
    (a, b) => a.position - b.position,
  );
  const unpinnedBlock = shifted
    .filter((entry) => !entry.pinned)
    .sort((a, b) => a.position - b.position);
  return [...pinnedBlock, ...unpinnedBlock];
}

/**
 * Produce the saved entries that correspond to unpinning `value`. Preserves the entry's `position`
 * so the user does not lose their drag position when they merely unpin. Pure.
 */
export function unpinGroup(
  saved: readonly GroupOrderEntry[] | null,
  value: string,
): GroupOrderEntry[] {
  const current = saved ?? [];
  return current.map((entry) => (entry.value === value ? { ...entry, pinned: false } : entry));
}

/**
 * Produce the saved entries for a fresh ordering of `groupValues` after a user drag — the new
 * array is index-based: entry at index i → position i. Pinned flags are carried from `saved`.
 * Pure.
 */
export function reorderGroups(
  saved: readonly GroupOrderEntry[] | null,
  nextOrder: readonly string[],
): GroupOrderEntry[] {
  const current = saved ?? [];
  const pinnedByValue = new Map(current.map((entry) => [entry.value, entry.pinned] as const));
  return nextOrder.map((value, index) => ({
    value,
    position: index,
    pinned: pinnedByValue.get(value) ?? false,
  }));
}

function defaultSortOrder(
  groupValues: readonly string[],
  defaultSort: 'enum' | 'alpha',
  enumOrder: readonly string[] | undefined,
): string[] {
  if (defaultSort === 'enum' && enumOrder !== undefined) {
    const indexOf = (value: string): number => {
      const found = enumOrder.indexOf(value);
      // Values not in the enum go after the known ones, in their natural order of appearance.
      return found === -1 ? enumOrder.length : found;
    };
    return [...groupValues].sort((a, b) => {
      const diff = indexOf(a) - indexOf(b);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
  }
  return [...groupValues].sort((a, b) => a.localeCompare(b));
}
