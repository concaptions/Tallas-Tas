/**
 * Shared record-sidebar navigation (Ticket 9, part 1). The four data-grid pages' sidebars walk a
 * row selection with prev/next; the Creative Sheet's Focus Mode already answers the three
 * questions those sidebars ask (which row is in focus, where a step lands, the `07 / 23`
 * counter), so this module re-exports those pure helpers and layers one function on top for the
 * `prevId / nextId / counter` triple the UI binds to.
 */

import { focusCounter, focusIndex, neighbourIndex } from '@/app/app/creative-sheet/focus-mode';

export { focusCounter, focusIndex, neighbourIndex };

export interface RecordNavigation {
  readonly index: number;
  readonly total: number;
  /** The previous row's id, or null at the first row (the ends do not wrap). */
  readonly prevId: string | null;
  /** The next row's id, or null at the last row. */
  readonly nextId: string | null;
  /** `07 / 23`, both numbers padded to the total's width. */
  readonly counter: string;
}

/**
 * The sidebar's view of the current selection in `ids`: Focus Mode's chosen index (first row when
 * `selectedId` is null or absent), the counter, and the two neighbour ids — null at the ends,
 * since `neighbourIndex` clamps and would otherwise hand back the current id as its own neighbour.
 */
export function recordNavigation(
  ids: readonly string[],
  selectedId: string | null,
): RecordNavigation {
  const total = ids.length;
  const index = focusIndex(ids, selectedId);
  if (total === 0) {
    return { index: -1, total: 0, prevId: null, nextId: null, counter: focusCounter(-1, 0) };
  }
  const current = ids[index] ?? null;
  const prev = ids[neighbourIndex(index, -1, total)] ?? null;
  const next = ids[neighbourIndex(index, 1, total)] ?? null;
  return {
    index,
    total,
    prevId: prev === current ? null : prev,
    nextId: next === current ? null : next,
    counter: focusCounter(index, total),
  };
}
