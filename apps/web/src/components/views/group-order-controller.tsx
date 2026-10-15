'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  applyGroupOrder,
  isStatusField,
  pinGroup,
  reorderGroups,
  statusEnumOrderFor,
  unpinGroup,
  type GroupOrderEntry,
} from '@tas/domain';
import { Button, cn } from '@tas/ui';
import { GripVertical, Pin, PinOff, RotateCcw } from '@tas/ui/icons';

import { RowContextMenu } from './row-context-menu';

/**
 * Per-user group ordering controller (Phase B5 commit 2). The hook resolves the final order of
 * group values from (natural first-appearance order, viewer's saved order, default sort), owns the
 * drag/pin/reset callbacks that write back to the DAO through the server actions, and renders the
 * right-click context menu beside the group header. One component, two outputs: `groupOrder` for
 * `AirtableGrid` and `renderGroupHeader`/`onGroupContextMenu` for the same.
 *
 * On mount the hook calls the loader passed in once (so the shell owns the viewer-active-view id)
 * and caches `GroupOrderEntry[] | null`. Every save goes through `useTransition` so the drag ends
 * optimistically and the server-action fires in the background; a failure reverts.
 */
export interface GroupOrderIO {
  readonly load: () => Promise<readonly GroupOrderEntry[] | null>;
  readonly save: (
    order: readonly GroupOrderEntry[],
    applyToAllViews: boolean,
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
  readonly clear: (
    applyToAllViews: boolean,
  ) => Promise<{ readonly ok: boolean; readonly error?: string }>;
}

export interface GroupOrderControllerOptions {
  readonly fieldKey: string;
  readonly naturalOrder: readonly string[];
  readonly io: GroupOrderIO;
  readonly onError?: (message: string) => void;
}

export interface GroupOrderControllerState {
  readonly orderedValues: readonly string[];
  readonly saved: readonly GroupOrderEntry[] | null;
  readonly isApplyToAllViews: boolean;
  readonly setApplyToAllViews: (next: boolean) => void;
  readonly reorder: (nextOrder: readonly string[]) => void;
  readonly pin: (value: string) => void;
  readonly unpin: (value: string) => void;
  readonly reset: () => void;
  readonly openContextMenu: (
    groupValue: string,
    position: { readonly x: number; readonly y: number },
  ) => void;
  readonly menu: ReactNode;
  readonly isPending: boolean;
}

/**
 * React hook that owns the viewer's group order for one `(table, field, view?)` scope. Returns
 * the resolved display order (via `applyGroupOrder`) plus the handlers the UI calls on drag, pin,
 * unpin, and reset. The caller plugs `orderedValues` into `AirtableGrid.groupOrder` and `menu`
 * somewhere in the page's root. Pure React + domain helpers — the only side effects are the three
 * `io.*` calls, which are injected so tests and the design-system story drive them with local
 * state.
 */
export function useGroupOrder(options: GroupOrderControllerOptions): GroupOrderControllerState {
  const { fieldKey, naturalOrder, io, onError } = options;
  const [saved, setSaved] = useState<readonly GroupOrderEntry[] | null>(null);
  const [applyToAllViews, setApplyToAllViews] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [menuState, setMenuState] = useState<null | {
    readonly value: string;
    readonly position: { readonly x: number; readonly y: number };
  }>(null);
  const previousSaved = useRef<readonly GroupOrderEntry[] | null>(null);

  // Load once on mount; a view change in the parent re-mounts this through `fieldKey` so the
  // reload is implicit — no second effect pathway here.
  useEffect(() => {
    let cancelled = false;
    io.load()
      .then((loaded) => {
        if (!cancelled) setSaved(loaded);
      })
      .catch(() => {
        if (!cancelled && onError !== undefined) {
          onError('Could not read your saved group order.');
        }
      });
    return () => {
      cancelled = true;
    };
    // The IO object is stable in practice (bound to the viewer's view id); re-running on identity
    // changes would thrash the loader, so this effect intentionally keys on `fieldKey` alone.
  }, [fieldKey, io, onError]);

  const orderedValues = useMemo(() => {
    const enumOrder = statusEnumOrderFor(fieldKey);
    const defaultSort = isStatusField(fieldKey) && enumOrder !== null ? 'enum' : 'alpha';
    return applyGroupOrder(naturalOrder, saved, defaultSort, enumOrder ?? undefined);
  }, [fieldKey, naturalOrder, saved]);

  const commit = useCallback(
    (next: readonly GroupOrderEntry[] | null) => {
      previousSaved.current = saved;
      setSaved(next);
      startTransition(() => {
        const run = next === null ? io.clear(applyToAllViews) : io.save(next, applyToAllViews);
        void run.then((result) => {
          if (!result.ok) {
            setSaved(previousSaved.current);
            onError?.(result.error ?? 'Could not save group order.');
          }
        });
      });
    },
    [io, applyToAllViews, saved, onError],
  );

  const reorder = useCallback(
    (nextOrder: readonly string[]) => {
      commit(reorderGroups(saved, nextOrder));
    },
    [commit, saved],
  );

  const pin = useCallback(
    (value: string) => {
      commit(pinGroup(saved, value));
    },
    [commit, saved],
  );

  const unpin = useCallback(
    (value: string) => {
      commit(unpinGroup(saved, value));
    },
    [commit, saved],
  );

  const reset = useCallback(() => {
    commit(null);
  }, [commit]);

  const openContextMenu = useCallback(
    (value: string, position: { readonly x: number; readonly y: number }) => {
      setMenuState({ value, position });
    },
    [],
  );

  const menu = useMemo(() => {
    if (menuState === null) return null;
    const entry = saved?.find((row) => row.value === menuState.value);
    const isPinned = entry?.pinned ?? false;
    const items = [
      isPinned
        ? {
            label: 'Unpin',
            icon: <PinOff className="size-3.5" strokeWidth={1.8} aria-hidden />,
            slot: 'group-context-unpin' as const,
            onSelect: () => {
              unpin(menuState.value);
            },
          }
        : {
            label: 'Pin to top',
            icon: <Pin className="size-3.5" strokeWidth={1.8} aria-hidden />,
            slot: 'group-context-pin' as const,
            onSelect: () => {
              pin(menuState.value);
            },
          },
      {
        label: 'Reset order',
        icon: <RotateCcw className="size-3.5" strokeWidth={1.8} aria-hidden />,
        slot: 'group-context-reset' as const,
        divider: true as const,
        onSelect: () => {
          reset();
        },
      },
      {
        label: applyToAllViews ? 'Scope: all views' : 'Scope: this view',
        slot: 'group-context-scope' as const,
        onSelect: () => {
          setApplyToAllViews(!applyToAllViews);
        },
      },
    ];
    return (
      <RowContextMenu
        position={menuState.position}
        items={items}
        onClose={() => {
          setMenuState(null);
        }}
        label={`Group ${menuState.value}`}
      />
    );
  }, [menuState, saved, applyToAllViews, pin, unpin, reset]);

  return {
    orderedValues,
    saved,
    isApplyToAllViews: applyToAllViews,
    setApplyToAllViews,
    reorder,
    pin,
    unpin,
    reset,
    openContextMenu,
    menu,
    isPending,
  };
}

/**
 * One draggable group header for the airtable grid. The parent wraps the whole header-row body
 * (passed into `AirtableGrid.renderGroupHeader`) in a `<SortableGroupHeader>`, giving dnd-kit the
 * `value` and letting it draw the handle inline with the label and count. The handle alone starts
 * a drag — a stray pointer on the label text does nothing (and does not block the row click under
 * it).
 */
export interface SortableGroupHeaderProps {
  readonly value: string;
  readonly label: ReactNode;
  readonly count: number;
  readonly pinned?: boolean;
}

export function SortableGroupHeader({
  value,
  label,
  count,
  pinned = false,
}: SortableGroupHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
  });
  const style: Record<string, string | undefined> = {
    transform: CSS.Transform.toString(transform) ?? undefined,
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slot="group-header-draggable"
      data-group-value={value}
      className={cn(
        'sticky left-0 flex w-fit max-w-full items-center gap-2 px-3 py-1.5',
        isDragging && 'opacity-70',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-5 cursor-grab text-text3"
        aria-label={`Drag ${value}`}
        data-slot="group-drag-handle"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" strokeWidth={1.8} aria-hidden />
      </Button>
      <span className="text-xs font-semibold text-text2">{label}</span>
      <span className="font-mono text-[10px] text-text3" data-slot="group-count">
        {count}
      </span>
      {pinned ? (
        <Pin
          className="size-3 text-accent"
          strokeWidth={1.8}
          aria-label="Pinned"
          data-slot="group-pinned-indicator"
        />
      ) : null}
    </div>
  );
}

/**
 * The DnD context the page wraps its grid body in. Pass the ordered values and an `onReorder`
 * callback — the context handles the pointer sensor and the sorting strategy. The group headers
 * must be rendered as `<SortableGroupHeader>` inside the same context.
 */
export interface GroupSortableContextProps {
  readonly orderedValues: readonly string[];
  readonly onReorder: (nextOrder: readonly string[]) => void;
  readonly children: ReactNode;
}

export function GroupSortableContext({
  orderedValues,
  onReorder,
  children,
}: GroupSortableContextProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;
    const fromIndex = orderedValues.indexOf(String(active.id));
    const toIndex = orderedValues.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...orderedValues];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) return;
    next.splice(toIndex, 0, moved);
    onReorder(next);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={[...orderedValues]} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
