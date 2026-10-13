// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BulkDeleteResult, BulkStatusResult } from './bulk-results';
import { useGridSelection, type GridSelectionArgs } from './use-grid-selection';

interface Row {
  readonly id: string;
  readonly name: string;
}

const ROW_A: Row = { id: 'a', name: 'Alpha' };
const ROW_B: Row = { id: 'b', name: 'Beta' };
const ROW_C: Row = { id: 'c', name: 'Gamma' };
const ROWS: readonly Row[] = [ROW_A, ROW_B, ROW_C];

const rowId = (row: Row) => row.id;
const rowLabel = (row: Row) => row.name;

function args(overrides: Partial<GridSelectionArgs<Row>> = {}): GridSelectionArgs<Row> {
  return {
    rows: ROWS,
    rowId,
    rowLabel,
    demo: false,
    noun: 'angle',
    linkFor: (id) => `https://app.test/app/angles?angle=${id}`,
    open: { label: 'Open', onOpen: () => undefined },
    refresh: () => undefined,
    ...overrides,
  };
}

const okDelete = (ids: readonly string[]): Promise<BulkDeleteResult> =>
  Promise.resolve({ ok: true, deleted: [...ids] });

afterEach(() => {
  cleanup();
});

describe('useGridSelection', () => {
  it('toggles rows and the header, and prunes a selection when its rows leave the grid', () => {
    const { result, rerender } = renderHook(
      (props: GridSelectionArgs<Row>) => useGridSelection(props),
      {
        initialProps: args(),
      },
    );

    act(() => {
      result.current.gridProps.selection.onToggle('a');
    });
    expect(result.current.selected).toEqual(new Set(['a']));
    expect(result.current.gridProps.selection.selected).toEqual(new Set(['a']));

    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b', 'c']);
    });
    expect(result.current.selected.size).toBe(3);
    // Every visible row already in: the header toggle empties the selection.
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b', 'c']);
    });
    expect(result.current.selected.size).toBe(0);

    act(() => {
      result.current.gridProps.selection.onToggle('c');
    });
    rerender(args({ rows: ROWS.slice(0, 2) }));
    expect(result.current.selected.size).toBe(0);
  });

  it('deletes through the confirm: ask once, run, report onDeleted, clear, notice, refresh', async () => {
    const run = vi.fn(okDelete);
    const onDeleted = vi.fn();
    const refresh = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection(args({ remove: { detail: 'Nothing is erased.', run, onDeleted }, refresh })),
    );
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b']);
    });

    const del = result.current.selectionActions.find((a) => a.slot === 'selection-delete');
    expect(del?.label).toBe('Delete (2)');
    act(() => {
      del?.onSelect();
    });
    expect(result.current.confirmDelete).toBe(true);
    expect(result.current.deleteDetail).toBe('Nothing is erased.');
    expect(run).not.toHaveBeenCalled();

    await act(async () => {
      result.current.onConfirmDelete();
      await Promise.resolve();
    });
    expect(run).toHaveBeenCalledWith(['a', 'b']);
    expect(onDeleted).toHaveBeenCalledWith(['a', 'b']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.confirmDelete).toBe(false);
    // The notice outlives the cleared selection (B3.A29): the bar's toolbar is gone, the line stays.
    expect(result.current.selected.size).toBe(0);
    expect(result.current.notice).toBe('2 angles deleted.');
  });

  it('pluralises the delete notice through `plural`: 2 copies, never 2 copys', async () => {
    const { result } = renderHook(() =>
      useGridSelection(
        args({
          noun: 'copy',
          plural: 'copies',
          remove: { detail: 'Nothing is erased.', run: okDelete },
        }),
      ),
    );
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b']);
    });
    await act(async () => {
      result.current.onConfirmDelete();
      await Promise.resolve();
    });
    expect(result.current.notice).toBe('2 copies deleted.');
  });

  it('surfaces a refused delete as the notice and keeps the selection', async () => {
    const run = vi.fn((): Promise<BulkDeleteResult> =>
      Promise.resolve({ ok: false, error: 'Session expired.' }),
    );
    const refresh = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection(args({ remove: { detail: 'd', run }, refresh })),
    );
    act(() => {
      result.current.gridProps.selection.onToggle('a');
    });
    await act(async () => {
      result.current.onConfirmDelete();
      await Promise.resolve();
    });
    expect(result.current.notice).toBe('Session expired.');
    expect(result.current.selected.size).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('demo mode disables every write action with the demo hint and never runs the delete', () => {
    const run = vi.fn(okDelete);
    const { result } = renderHook(() =>
      useGridSelection(
        args({
          demo: true,
          remove: { detail: 'd', run },
          duplicate: { run: () => Promise.resolve({ ok: true, created: [], skipped: 0 }) },
          status: {
            tracks: [{ key: 'status', label: 'Status', options: [{ key: 'x', label: 'X' }] }],
            run: () => Promise.resolve({ ok: true, moved: [], refused: [] }),
          },
        }),
      ),
    );
    act(() => {
      result.current.gridProps.selection.onToggle('a');
    });
    expect(result.current.selectionActions.length).toBe(3);
    for (const action of result.current.selectionActions) {
      expect(action.disabled).toBe(true);
      expect(action.hint).toBe(DEMO_WRITE_HINT);
    }

    act(() => {
      result.current.gridProps.onRowContextMenu(ROW_A, { x: 10, y: 10 });
    });
    const bySlot = (slot: string) => result.current.contextItems.find((item) => item.slot === slot);
    expect(bySlot('context-duplicate')?.disabled).toBe(true);
    expect(bySlot('context-delete')?.disabled).toBe(true);
    // Open and Copy link write nothing, so demo mode leaves them live.
    expect(bySlot('context-open')?.disabled).not.toBe(true);
    expect(bySlot('context-copy-link')?.disabled).not.toBe(true);

    act(() => {
      result.current.onConfirmDelete();
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('orders the menu Open → Copy link → Delete, with Open full page after Open when given', () => {
    const onOpen = vi.fn();
    const onOpenFullPage = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection(
        args({
          open: { label: 'Open', onOpen },
          openFullPage: { label: 'Open full page', onOpen: onOpenFullPage },
          remove: { detail: 'd', run: okDelete },
        }),
      ),
    );
    act(() => {
      result.current.gridProps.onRowContextMenu(ROW_B, { x: 10, y: 10 });
    });
    expect(result.current.gridProps.contextRowId).toBe('b');
    expect(result.current.contextItems.map((item) => item.label)).toEqual([
      'Open',
      'Open full page',
      'Copy link',
      'Delete',
    ]);
    expect(result.current.contextItems.map((item) => item.slot)).toEqual([
      'context-open',
      'context-open-full-page',
      'context-copy-link',
      'context-delete',
    ]);
    result.current.contextItems[0]?.onSelect();
    expect(onOpen).toHaveBeenCalledWith('b');
    result.current.contextItems[1]?.onSelect();
    expect(onOpenFullPage).toHaveBeenCalledWith('b');
    // Delete puts the menu's row alone into the selection and asks in the bar.
    act(() => {
      result.current.contextItems[3]?.onSelect();
    });
    expect(result.current.selected).toEqual(new Set(['b']));
    expect(result.current.confirmDelete).toBe(true);
  });

  it('registers no keydown listener without `duplicate`, and duplicates the selection with it', async () => {
    const spy = vi.spyOn(window, 'addEventListener');
    const { result, unmount } = renderHook(() => useGridSelection(args()));
    act(() => {
      result.current.gridProps.selection.onToggle('a');
    });
    expect(result.current.selectionActions.find((a) => a.slot === 'selection-duplicate')).toBe(
      undefined,
    );
    expect(spy.mock.calls.some(([type]) => type === 'keydown')).toBe(false);
    unmount();
    spy.mockClear();

    const run = vi.fn((ids: readonly string[]) =>
      Promise.resolve({
        ok: true as const,
        created: ids.map((id) => ({ id: `${id}-copy`, name: 'Copy' })),
        skipped: 0,
      }),
    );
    const withDuplicate = renderHook(() => useGridSelection(args({ duplicate: { run } })));
    act(() => {
      withDuplicate.result.current.gridProps.selection.onToggle('a');
    });
    expect(spy.mock.calls.some(([type]) => type === 'keydown')).toBe(true);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', metaKey: true }));
      await Promise.resolve();
    });
    expect(run).toHaveBeenCalledWith(['a']);
    expect(withDuplicate.result.current.notice).toBe('1 copy created: Copy');
    spy.mockRestore();
  });

  it('offers Change status only with a status config, and applies the picked track and value', async () => {
    const bare = renderHook(() => useGridSelection(args()));
    act(() => {
      bare.result.current.gridProps.selection.onToggle('a');
    });
    expect(
      bare.result.current.selectionActions.find((a) => a.slot === 'selection-change-status'),
    ).toBe(undefined);

    const run = vi.fn((ids: readonly string[]): Promise<BulkStatusResult> =>
      Promise.resolve({ ok: true, moved: [...ids], refused: [] }),
    );
    const refresh = vi.fn();
    const tracks = [
      {
        key: 'internalStatus',
        label: 'Internal Status',
        options: [
          { key: 'draft', label: 'Draft' },
          { key: 'approved', label: 'Approved' },
        ],
      },
    ];
    const { result } = renderHook(() =>
      useGridSelection(args({ status: { tracks, run }, refresh })),
    );
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b']);
    });
    const change = result.current.selectionActions.find(
      (a) => a.slot === 'selection-change-status',
    );
    act(() => {
      change?.onSelect();
    });
    expect(result.current.statusPicker).toEqual({ track: 'internalStatus', value: '' });
    // An empty value never applies.
    await act(async () => {
      result.current.onApplyStatus();
      await Promise.resolve();
    });
    expect(run).not.toHaveBeenCalled();

    act(() => {
      result.current.onStatusValueChange('approved');
    });
    await act(async () => {
      result.current.onApplyStatus();
      await Promise.resolve();
    });
    expect(run).toHaveBeenCalledWith(['a', 'b'], 'internalStatus', 'approved');
    expect(result.current.notice).toBe('2 moved.');
    expect(result.current.statusPicker).toBe(null);
    // A status move keeps the selection, as the sheet does.
    expect(result.current.selected.size).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('spells out the refused rows after a partial status move', async () => {
    const run = (): Promise<BulkStatusResult> =>
      Promise.resolve({
        ok: true,
        moved: [],
        refused: [{ id: 'a', name: 'Alpha', reason: 'the client gate is closed' }],
      });
    const tracks = [
      { key: 'clientStatus', label: 'Client Status', options: [{ key: 'live', label: 'Live' }] },
    ];
    const { result } = renderHook(() => useGridSelection(args({ status: { tracks, run } })));
    act(() => {
      result.current.gridProps.selection.onToggle('a');
    });
    act(() => {
      result.current.selectionActions.find((a) => a.slot === 'selection-change-status')?.onSelect();
    });
    act(() => {
      result.current.onStatusValueChange('live');
    });
    await act(async () => {
      result.current.onApplyStatus();
      await Promise.resolve();
    });
    expect(result.current.notice).toBe('0 moved. 1 refused: Alpha — the client gate is closed');
  });

  it('Copy link falls back to the URL as the notice when the clipboard is missing or refuses', async () => {
    const { result } = renderHook(() => useGridSelection(args()));
    act(() => {
      result.current.gridProps.onRowContextMenu(ROW_B, { x: 0, y: 0 });
    });
    const copy = () => result.current.contextItems.find((i) => i.slot === 'context-copy-link');
    // jsdom has no navigator.clipboard at all: the notice is the link itself.
    act(() => {
      copy()?.onSelect();
    });
    expect(result.current.notice).toBe('https://app.test/app/angles?angle=b');

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    try {
      await act(async () => {
        copy()?.onSelect();
        await Promise.resolve();
      });
      expect(result.current.notice).toBe('Link copied.');
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it('runs a page-defined extra action through the same lifecycle (Themes Archive)', async () => {
    const run = vi.fn((ids: readonly string[]) =>
      Promise.resolve({ ok: true as const, notice: `${String(ids.length)} archived.` }),
    );
    const refresh = vi.fn();
    const { result } = renderHook(() =>
      useGridSelection(
        args({
          extraActions: [
            { label: (n) => `Archive (${String(n)})`, run, slot: 'selection-archive' },
          ],
          refresh,
        }),
      ),
    );
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'c']);
    });
    const archive = result.current.selectionActions.find((a) => a.slot === 'selection-archive');
    expect(archive?.label).toBe('Archive (2)');
    await act(async () => {
      archive?.onSelect();
      await Promise.resolve();
    });
    expect(run).toHaveBeenCalledWith(['a', 'c']);
    expect(result.current.selected.size).toBe(0);
    expect(result.current.notice).toBe('2 archived.');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('clearSelection empties everything including the notice; Clear is the one reset', () => {
    const { result } = renderHook(() =>
      useGridSelection(args({ remove: { detail: 'd', run: okDelete } })),
    );
    act(() => {
      result.current.gridProps.selection.onToggleAll(['a', 'b']);
    });
    act(() => {
      result.current.selectionActions.find((a) => a.slot === 'selection-delete')?.onSelect();
    });
    expect(result.current.confirmDelete).toBe(true);
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selected.size).toBe(0);
    expect(result.current.confirmDelete).toBe(false);
    expect(result.current.statusPicker).toBe(null);
    expect(result.current.notice).toBe(null);
  });
});
