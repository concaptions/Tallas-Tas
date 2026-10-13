'use client';

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { Copy, Link, RefreshCw, Trash } from '@tas/ui/icons';

import { pruneSelection, toggleAllSelected, toggleSelected } from './airtable-grid-logic';
import type {
  BulkDeleteResult,
  BulkDuplicateResult,
  BulkFailure,
  BulkStatusResult,
} from './bulk-results';
import { duplicateShortcut, type ContextMenuItem } from './row-context-menu';
import type { SelectionAction } from './selection-bar';
import type { SelectionStatusTrack } from './selection-status-picker';

/** A pointer position, as `AirtableGrid` reports a row's right-click. */
export interface GridPointer {
  readonly x: number;
  readonly y: number;
}

/** An "Open"-style context-menu item: the panel, or Concepts' full page beside it. */
export interface GridSelectionOpenItem {
  readonly label: string;
  readonly icon?: ReactNode;
  /** `data-slot` override; defaults to `context-open` (`context-open-full-page` for the second). */
  readonly slot?: string;
  readonly onOpen: (id: string) => void;
}

/**
 * A page-defined bar action beyond the shared three (Themes' "Archive (n)" / "Restore (n)"): it
 * runs through the hook's busy/demo/notice lifecycle, and on `ok` the selection clears and the
 * returned notice line is shown.
 */
export interface GridSelectionExtraAction {
  /** The bar label for the current count, e.g. ``(n) => `Archive (${String(n)})``. */
  readonly label: (count: number) => string;
  readonly icon?: ReactNode;
  readonly tone?: 'default' | 'bad';
  /** `data-slot`; defaults to `selection-extra`. */
  readonly slot?: string;
  readonly run: (
    ids: readonly string[],
  ) => Promise<{ readonly ok: true; readonly notice: string } | BulkFailure>;
}

export interface GridSelectionArgs<Row> {
  /** The rows on screen (after search and view filters); a vanished row leaves the selection. */
  readonly rows: readonly Row[];
  readonly rowId: (row: Row) => string;
  /** The record's name: the context menu's accessible label. */
  readonly rowLabel: (row: Row) => string;
  readonly demo: boolean;
  /** Singular noun for the notices, e.g. `angle` → "2 angles deleted." */
  readonly noun: string;
  /** Irregular plural (`copy` → `copies`); defaults to `${noun}s`. */
  readonly plural?: string;
  /** The ABSOLUTE URL "Copy link" puts on the clipboard, built by the page. */
  readonly linkFor: (id: string) => string;
  readonly open: GridSelectionOpenItem;
  /** A second open item (Concepts: "Open full page" beside the panel's "Open"). */
  readonly openFullPage?: GridSelectionOpenItem;
  /** Delete over the selection; absent, no Delete appears anywhere (Themes without the lead's go). */
  readonly remove?: {
    /** What the delete means for these records, after the confirm's question. */
    readonly detail: string;
    readonly run: (ids: readonly string[]) => Promise<BulkDeleteResult>;
    /** After a confirmed delete: close a panel whose row is gone, prune page state. */
    readonly onDeleted?: (ids: readonly string[]) => void;
  };
  /**
   * Duplicate over the selection. ABSENT ON EVERY TICKET 8 PAGE (names are typed or
   * formula-generated, PRD §7); the Creative Sheet passes it when it adopts the hook. The ⌘D /
   * Ctrl+D listener is registered only while this is given.
   */
  readonly duplicate?: {
    readonly run: (ids: readonly string[]) => Promise<BulkDuplicateResult>;
  };
  /** Change status over the selection: the tracks the picker offers, and the one bulk write. */
  readonly status?: {
    readonly tracks: readonly SelectionStatusTrack[];
    readonly run: (
      ids: readonly string[],
      track: string,
      value: string,
    ) => Promise<BulkStatusResult>;
  };
  /** Page-defined bar actions (Themes' Archive/Restore), drawn between Change status and Delete. */
  readonly extraActions?: readonly GridSelectionExtraAction[];
  /** `router.refresh`, called after every successful write. */
  readonly refresh: () => void;
}

/** What `useGridSelection` returns: the grid's props and everything `GridSelectionOverlay` draws. */
export interface GridSelectionState<Row> {
  readonly selected: ReadonlySet<string>;
  /** Spread into `<AirtableGrid>`: the checkbox column, the right-click report, the menu's row. */
  readonly gridProps: {
    readonly selection: {
      readonly selected: ReadonlySet<string>;
      readonly onToggle: (id: string) => void;
      readonly onToggleAll: (visibleIds: readonly string[]) => void;
    };
    readonly onRowContextMenu: (row: Row, position: GridPointer) => void;
    readonly contextRowId: string | null;
  };
  readonly contextMenu: { readonly row: Row; readonly position: GridPointer } | null;
  readonly contextItems: readonly ContextMenuItem[];
  readonly selectionActions: readonly SelectionAction[];
  readonly statusTracks: readonly SelectionStatusTrack[];
  readonly statusPicker: { readonly track: string; readonly value: string } | null;
  readonly onStatusTrackChange: (track: string) => void;
  readonly onStatusValueChange: (value: string) => void;
  readonly onApplyStatus: () => void;
  readonly confirmDelete: boolean;
  /** The page's `remove.detail`, for the confirm line; `''` when the page offers no Delete. */
  readonly deleteDetail: string;
  /** Runs the confirmed delete over the selection. */
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
  /** The last outcome or refusal. It OUTLIVES a cleared selection (B3.A29). */
  readonly notice: string | null;
  readonly busy: boolean;
  readonly demo: boolean;
  readonly rowLabel: (row: Row) => string;
  readonly clearSelection: () => void;
  readonly closeContextMenu: () => void;
}

const NO_TRACKS: readonly SelectionStatusTrack[] = [];

/**
 * The Creative Sheet's multi-select wiring (Oct 12 scope 3), extracted for every grid view
 * (Ticket 8): the selected set pruned as rows change, the right-click menu's items, the floating
 * bar's actions with counts, the Delete confirm, the inline Change-status picker, Copy link with
 * its clipboard fallback, and the ⌘D listener — registered ONLY when `duplicate` is given, which
 * no Ticket 8 page does (PRD §7: no formula, no Duplicate).
 *
 * Every write here is a Server Action the PAGE passes in; the hook only sequences demo refusal →
 * busy → outcome notice → `refresh()`. Demo mode disables Duplicate / Change status / Delete with
 * `DEMO_WRITE_HINT`; Open and Copy link stay live (they write nothing). The selection is
 * deliberately EPHEMERAL state — never persisted into `user_table_views`.
 */
export function useGridSelection<Row>({
  rows,
  rowId,
  rowLabel,
  demo,
  noun,
  plural,
  linkFor,
  open,
  openFullPage,
  remove,
  duplicate,
  status,
  extraActions,
  refresh,
}: GridSelectionArgs<Row>): GridSelectionState<Row> {
  const pluralNoun = plural ?? `${noun}s`;
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<{
    readonly row: Row;
    readonly position: GridPointer;
  } | null>(null);
  const [statusPicker, setStatusPicker] = useState<{ track: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBulk] = useTransition();

  // Rows deleted, or filtered off screen, leave the selection; `pruneSelection` returns the same
  // set when nothing changed, so this never loops a render.
  useEffect(() => {
    setSelected((current) => pruneSelection(current, rows.map(rowId)));
  }, [rows, rowId]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setStatusPicker(null);
    setConfirmDelete(false);
    setNotice(null);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const finish = useCallback(
    (message: string | null) => {
      setNotice(message);
      setStatusPicker(null);
      setConfirmDelete(false);
      refresh();
    },
    [refresh],
  );

  const runDuplicate = useCallback(
    (ids: readonly string[]) => {
      if (duplicate === undefined || demo || ids.length === 0) return;
      setNotice(null);
      startBulk(async () => {
        const result = await duplicate.run(ids);
        if (!result.ok) {
          setNotice(result.error);
          return;
        }
        clearSelection();
        finish(
          `${String(result.created.length)} ${result.created.length === 1 ? 'copy' : 'copies'} created` +
            (result.created.length === 1 && result.created[0] !== undefined
              ? `: ${result.created[0].name}`
              : '.'),
        );
      });
    },
    [clearSelection, demo, duplicate, finish],
  );

  const runDelete = useCallback(
    (ids: readonly string[]) => {
      if (remove === undefined || demo || ids.length === 0) return;
      setNotice(null);
      startBulk(async () => {
        const result = await remove.run(ids);
        if (!result.ok) {
          setNotice(result.error);
          return;
        }
        remove.onDeleted?.(result.deleted);
        clearSelection();
        finish(
          `${String(result.deleted.length)} ${result.deleted.length === 1 ? noun : pluralNoun} deleted.`,
        );
      });
    },
    [clearSelection, demo, finish, noun, pluralNoun, remove],
  );

  const runExtra = useCallback(
    (action: GridSelectionExtraAction, ids: readonly string[]) => {
      if (demo || ids.length === 0) return;
      setNotice(null);
      startBulk(async () => {
        const result = await action.run(ids);
        if (!result.ok) {
          setNotice(result.error);
          return;
        }
        clearSelection();
        finish(result.notice);
      });
    },
    [clearSelection, demo, finish],
  );

  const onApplyStatus = useCallback(() => {
    if (
      status === undefined ||
      demo ||
      statusPicker === null ||
      statusPicker.value === '' ||
      selected.size === 0
    ) {
      return;
    }
    setNotice(null);
    const ids = [...selected];
    const { track, value } = statusPicker;
    startBulk(async () => {
      const result = await status.run(ids, track, value);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const refused =
        result.refused.length === 0
          ? ''
          : ` ${String(result.refused.length)} refused: ${result.refused
              .map((entry) => `${entry.name} — ${entry.reason}`)
              .join('; ')}`;
      finish(`${String(result.moved.length)} moved.${refused}`);
    });
  }, [demo, finish, selected, status, statusPicker]);

  // ⌘D / Ctrl+D duplicates THE MENU'S ROW while a context menu is up — the hint sits on that row,
  // ticked or not (B3.A20) — and the selection otherwise. No `duplicate`, no listener at all.
  useEffect(() => {
    if (duplicate === undefined) return;
    if (selected.size === 0 && contextMenu === null) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, select') !== null) {
          return;
        }
        event.preventDefault();
        if (contextMenu !== null) {
          setContextMenu(null);
          runDuplicate([rowId(contextMenu.row)]);
        } else {
          runDuplicate([...selected]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu, duplicate, rowId, runDuplicate, selected]);

  const copyLink = useCallback(
    (id: string) => {
      const url = linkFor(id);
      // jsdom and insecure contexts have no clipboard at all; headless Chromium can reject the
      // write. Either way the notice IS the link, so it can still be copied by hand.
      const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
      if (clipboard === undefined) {
        setNotice(url);
        return;
      }
      void clipboard.writeText(url).then(
        () => {
          setNotice('Link copied.');
        },
        () => {
          setNotice(url);
        },
      );
    },
    [linkFor],
  );

  const contextItems = useMemo((): readonly ContextMenuItem[] => {
    if (contextMenu === null) return [];
    const id = rowId(contextMenu.row);
    const items: ContextMenuItem[] = [];
    if (duplicate !== undefined) {
      items.push({
        label: 'Duplicate',
        shortcut: duplicateShortcut(navigator.userAgent),
        icon: createElement(Copy, { className: 'size-4', strokeWidth: 1.75 }),
        disabled: demo,
        slot: 'context-duplicate',
        onSelect: () => {
          runDuplicate([id]);
        },
      });
    }
    items.push({
      label: open.label,
      icon: open.icon,
      slot: open.slot ?? 'context-open',
      onSelect: () => {
        open.onOpen(id);
      },
    });
    if (openFullPage !== undefined) {
      items.push({
        label: openFullPage.label,
        icon: openFullPage.icon,
        slot: openFullPage.slot ?? 'context-open-full-page',
        onSelect: () => {
          openFullPage.onOpen(id);
        },
      });
    }
    items.push({
      label: 'Copy link',
      icon: createElement(Link, { className: 'size-4', strokeWidth: 1.75 }),
      slot: 'context-copy-link',
      onSelect: () => {
        copyLink(id);
      },
    });
    if (remove !== undefined) {
      items.push({
        label: 'Delete',
        icon: createElement(Trash, { className: 'size-4', strokeWidth: 1.75 }),
        tone: 'bad',
        divider: true,
        disabled: demo,
        slot: 'context-delete',
        onSelect: () => {
          // Delete asks once, in the bar: the row becomes the selection and the bar confirms.
          setSelected(new Set([id]));
          setStatusPicker(null);
          setConfirmDelete(true);
        },
      });
    }
    return items;
  }, [contextMenu, copyLink, demo, duplicate, open, openFullPage, remove, rowId, runDuplicate]);

  const selectionActions = useMemo((): readonly SelectionAction[] => {
    const count = selected.size;
    const ids = [...selected];
    const hint = demo ? DEMO_WRITE_HINT : busy ? 'Saving…' : '';
    const disabled = demo || busy;
    const actions: SelectionAction[] = [];
    if (duplicate !== undefined) {
      actions.push({
        label: `Duplicate (${String(count)})`,
        icon: createElement(Copy, { className: 'size-3.5', strokeWidth: 1.75 }),
        disabled,
        hint,
        slot: 'selection-duplicate',
        onSelect: () => {
          runDuplicate(ids);
        },
      });
    }
    if (status !== undefined && status.tracks.length > 0) {
      const firstTrack = status.tracks[0]?.key ?? '';
      actions.push({
        label: 'Change status',
        icon: createElement(RefreshCw, { className: 'size-3.5', strokeWidth: 1.75 }),
        disabled,
        hint,
        slot: 'selection-change-status',
        onSelect: () => {
          setConfirmDelete(false);
          setStatusPicker((current) =>
            current === null ? { track: firstTrack, value: '' } : null,
          );
        },
      });
    }
    for (const extra of extraActions ?? []) {
      actions.push({
        label: extra.label(count),
        icon: extra.icon,
        tone: extra.tone,
        disabled,
        hint,
        slot: extra.slot ?? 'selection-extra',
        onSelect: () => {
          runExtra(extra, ids);
        },
      });
    }
    if (remove !== undefined) {
      actions.push({
        label: `Delete (${String(count)})`,
        icon: createElement(Trash, { className: 'size-3.5', strokeWidth: 1.75 }),
        tone: 'bad',
        disabled,
        hint,
        slot: 'selection-delete',
        onSelect: () => {
          setStatusPicker(null);
          setConfirmDelete(true);
        },
      });
    }
    return actions;
  }, [busy, demo, duplicate, extraActions, remove, runDuplicate, runExtra, selected, status]);

  const onToggle = useCallback((id: string) => {
    setSelected((current) => toggleSelected(current, id));
  }, []);
  const onToggleAll = useCallback((visibleIds: readonly string[]) => {
    setSelected((current) => toggleAllSelected(current, visibleIds));
  }, []);
  const onRowContextMenu = useCallback((row: Row, position: GridPointer) => {
    setContextMenu({ row, position });
  }, []);

  const gridProps = useMemo(
    () => ({
      selection: { selected, onToggle, onToggleAll },
      onRowContextMenu,
      contextRowId: contextMenu === null ? null : rowId(contextMenu.row),
    }),
    [contextMenu, onRowContextMenu, onToggle, onToggleAll, rowId, selected],
  );

  const onStatusTrackChange = useCallback((track: string) => {
    setStatusPicker({ track, value: '' });
  }, []);
  const onStatusValueChange = useCallback((value: string) => {
    setStatusPicker((current) => (current === null ? current : { track: current.track, value }));
  }, []);
  const onConfirmDelete = useCallback(() => {
    runDelete([...selected]);
  }, [runDelete, selected]);
  const onCancelDelete = useCallback(() => {
    setConfirmDelete(false);
  }, []);

  return {
    selected,
    gridProps,
    contextMenu,
    contextItems,
    selectionActions,
    statusTracks: status?.tracks ?? NO_TRACKS,
    statusPicker,
    onStatusTrackChange,
    onStatusValueChange,
    onApplyStatus,
    confirmDelete,
    deleteDetail: remove?.detail ?? '',
    onConfirmDelete,
    onCancelDelete,
    notice,
    busy,
    demo,
    rowLabel,
    clearSelection,
    closeContextMenu,
  };
}
