'use client';

import { useMemo } from 'react';
import type { GroupOrderEntry } from '@tas/domain';

import {
  clearGroupOrderAction,
  getGroupOrderAction,
  saveGroupOrderAction,
} from '@/lib/group-order-actions';

import type { GroupOrderIO } from './group-order-controller';

/**
 * Phase B5 commit 3 — the thin bridge from `useGroupOrder` to the server actions and demo-mode
 * `localStorage`. One hook, memoized, so the controller's load effect fires once per scope.
 *
 * Live mode (`demo === false`): `load`/`save`/`clear` call the three server actions in
 * `@/lib/group-order-actions`. The actions themselves resolve the Clerk user id, the brand, and the
 * role gate (`admin`/`strategist`/`csm`/`media_buyer`). A refusal flows back as `{ ok: false, error }`,
 * which `useGroupOrder` surfaces through its `onError` and reverts the optimistic state.
 *
 * Demo mode (`demo === true`): no Clerk session, no database row, so the actions would refuse. The
 * IO instead reads and writes `localStorage` under a per-scope key — the same contract `useTableView`
 * uses for a demo visitor's views, and the same reason: the preference is private to this browser
 * and must survive a reload so the design-system drag/pin flow matches live behaviour. A write
 * never throws out — private windows / disabled storage just drop silently.
 *
 * The `applyToAllViews` boolean collapses to `viewId: null` on the save/clear calls, matching the
 * DAO's "view-specific first, then user-global, then default" fallback chain. A blank `fieldKey`
 * (no grouping active) is a no-op in every branch so the hook stays safe to call unconditionally.
 */

export interface GroupOrderIoScope {
  readonly tableKey: string;
  readonly fieldKey: string;
  readonly viewId: string | null;
}

export interface GroupOrderIoOptions {
  readonly demo: boolean;
}

const LOCAL_PREFIX = 'tas.group-order';

function localKey(scope: GroupOrderIoScope, applyToAllViews: boolean): string {
  const viewSlug = applyToAllViews ? '__all__' : (scope.viewId ?? '__none__');
  return `${LOCAL_PREFIX}.${scope.tableKey}.${scope.fieldKey}.${viewSlug}`;
}

function store(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

function readLocal(scope: GroupOrderIoScope): GroupOrderEntry[] | null {
  if (!scope.fieldKey) return null;
  try {
    const s = store();
    if (s === undefined) return null;
    // View-specific first, then the user-global fallback — the same precedence as the DAO.
    const raw = s.getItem(localKey(scope, false)) ?? s.getItem(localKey(scope, true));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const entries: GroupOrderEntry[] = [];
    for (const row of parsed) {
      if (
        typeof row === 'object' &&
        row !== null &&
        typeof (row as Record<string, unknown>)['value'] === 'string' &&
        typeof (row as Record<string, unknown>)['position'] === 'number' &&
        typeof (row as Record<string, unknown>)['pinned'] === 'boolean'
      ) {
        const r = row as Record<string, unknown>;
        entries.push({
          value: r['value'] as string,
          position: r['position'] as number,
          pinned: r['pinned'] as boolean,
        });
      }
    }
    return entries;
  } catch {
    return null;
  }
}

function writeLocal(
  scope: GroupOrderIoScope,
  order: readonly GroupOrderEntry[],
  applyToAllViews: boolean,
): void {
  try {
    store()?.setItem(localKey(scope, applyToAllViews), JSON.stringify([...order]));
  } catch {
    /* private window / disabled storage: the drag still works, it just will not be remembered */
  }
}

function clearLocal(scope: GroupOrderIoScope, applyToAllViews: boolean): void {
  try {
    store()?.removeItem(localKey(scope, applyToAllViews));
  } catch {
    /* same as writeLocal */
  }
}

export function useGroupOrderIo(
  scope: GroupOrderIoScope,
  options: GroupOrderIoOptions,
): GroupOrderIO {
  const { tableKey, fieldKey, viewId } = scope;
  const { demo } = options;
  return useMemo<GroupOrderIO>(
    () => ({
      load: async () => {
        if (!fieldKey) return null;
        if (demo) return readLocal({ tableKey, fieldKey, viewId });
        return getGroupOrderAction({ tableKey, fieldKey, viewId });
      },
      save: async (order, applyToAllViews) => {
        if (!fieldKey) return { ok: true };
        if (demo) {
          writeLocal({ tableKey, fieldKey, viewId }, order, applyToAllViews);
          return { ok: true };
        }
        const result = await saveGroupOrderAction({
          tableKey,
          fieldKey,
          viewId: applyToAllViews ? null : viewId,
          order: [...order],
        });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
      clear: async (applyToAllViews) => {
        if (!fieldKey) return { ok: true };
        if (demo) {
          clearLocal({ tableKey, fieldKey, viewId }, applyToAllViews);
          return { ok: true };
        }
        const result = await clearGroupOrderAction({
          tableKey,
          fieldKey,
          viewId: applyToAllViews ? null : viewId,
        });
        return result.ok ? { ok: true } : { ok: false, error: result.error };
      },
    }),
    [tableKey, fieldKey, viewId, demo],
  );
}
