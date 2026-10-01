'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Button,
  Card,
  CardContent,
  cn,
  DisabledWrite,
  disabledWriteClassName,
  StatusChip,
} from '@tas/ui';
import type { ChipTone } from '@tas/domain/state';

export interface KanbanItem {
  readonly id: string;
  readonly name: string;
  readonly groupValue: string;
  readonly subtitle?: string;
  readonly chipLabel?: string;
  readonly chipTone?: ChipTone;
  readonly href?: string;
  /**
   * Extra labelled chips under the name — the briefs board surfaces priority and type here. Optional,
   * so a board that wants the plain card (Personas) passes nothing and renders exactly as before.
   */
  readonly badges?: readonly { readonly label: string; readonly tone: ChipTone }[];
  /** Who the record is assigned to; absent or null renders no assignee line. */
  readonly assignee?: string | null;
  /** Colours the card's left stripe by stage, so a column reads at a glance. */
  readonly accentTone?: ChipTone;
  /**
   * One action on the card (the editor board's Start, Sprint 10): a button that runs without
   * opening the card or starting a drag. `hint` explains a disabled button (demo mode).
   */
  readonly action?: {
    readonly label: string;
    readonly onAction: () => void;
    readonly disabled?: boolean;
    readonly hint?: string;
    readonly slot?: string;
  };
}

/** The left stripe colour per stage tone. Semantic token classes only — no literals. */
const ACCENT_STRIPE: Record<ChipTone, string> = {
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  bad: 'border-l-bad',
  info: 'border-l-info',
  accent: 'border-l-accent',
  mute: 'border-l-line2',
};

interface KanbanBoardProps {
  readonly items: readonly KanbanItem[];
  readonly columns: readonly string[];
  readonly columnLabels: Record<string, string>;
  readonly onMove: (itemId: string, newValue: string) => void;
  readonly demo: boolean;
  /**
   * Opens a card without leaving the board (the briefs quick-look panel, P2B-3). Optional: a board
   * that passes nothing keeps drag-only cards, so Personas is unchanged. A click that followed a
   * DRAG is swallowed, so dropping a card never also opens it.
   */
  readonly onCardClick?: (item: KanbanItem) => void;
}

function KanbanCard({ item, isDragging }: { item: KanbanItem; isDragging?: boolean }) {
  return (
    <Card
      data-slot="kanban-card"
      data-card-id={item.id}
      className={cn(
        'cursor-grab border-line bg-surface transition-shadow',
        item.accentTone === undefined ? undefined : `border-l-4 ${ACCENT_STRIPE[item.accentTone]}`,
        isDragging ? 'rotate-2 opacity-80 shadow-lg' : 'hover:shadow-md',
      )}
    >
      <CardContent className="flex flex-col gap-1.5 p-3">
        <span className="text-sm font-medium text-text">{item.name}</span>
        {item.subtitle && <span className="text-xs text-text3">{item.subtitle}</span>}
        {item.badges && item.badges.length > 0 ? (
          <span className="flex flex-wrap items-center gap-1">
            {item.badges.map((badge) => (
              <StatusChip key={badge.label} tone={badge.tone} label={badge.label} />
            ))}
          </span>
        ) : null}
        {item.action === undefined ? null : (
          <span
            className="flex"
            onPointerDown={(event) => {
              // The button is not a drag handle and not a card click.
              event.stopPropagation();
            }}
          >
            <DisabledWrite active={item.action.disabled === true} hint={item.action.hint ?? ''}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={item.action.disabled === true}
                className={item.action.disabled === true ? disabledWriteClassName : undefined}
                data-slot={item.action.slot ?? 'kanban-card-action'}
                onClick={(event) => {
                  event.stopPropagation();
                  item.action?.onAction();
                }}
              >
                {item.action.label}
              </Button>
            </DisabledWrite>
          </span>
        )}
        {item.chipLabel === undefined && (item.assignee ?? null) === null ? null : (
          <span className="flex flex-wrap items-center justify-between gap-1">
            {item.chipLabel === undefined ? (
              <span />
            ) : (
              <StatusChip tone={item.chipTone ?? 'mute'} label={item.chipLabel} />
            )}
            {(item.assignee ?? null) === null ? null : (
              <span className="text-xs text-text3">{item.assignee}</span>
            )}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

function DraggableCard({
  item,
  onActivate,
}: {
  item: KanbanItem;
  onActivate?: (item: KanbanItem) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={
        onActivate === undefined
          ? undefined
          : () => {
              onActivate(item);
            }
      }
      className={isDragging ? 'opacity-30' : ''}
    >
      <KanbanCard item={item} />
    </div>
  );
}

function KanbanColumn({
  value,
  label,
  items,
  onActivate,
}: {
  value: string;
  label: string;
  items: readonly KanbanItem[];
  onActivate?: (item: KanbanItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: value });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[220px] max-w-[300px] flex-1 flex-col rounded-card border ${
        isOver ? 'border-accent bg-accent/5' : 'border-line bg-surface2'
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-xs font-medium text-text2">{label}</span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text3">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: '100px' }}>
        {items.map((item) => (
          <DraggableCard key={item.id} item={item} onActivate={onActivate} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  items,
  columns,
  columnLabels,
  onMove,
  demo,
  onCardClick,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);
  // dnd-kit only starts a drag past its 5px activation distance, so a plain click never reaches
  // `onDragEnd`. The pointerup that ENDS a drag does still fire a click, which this swallows.
  const justDragged = useRef(false);

  const activate = useCallback(
    (item: KanbanItem) => {
      if (justDragged.current) return;
      onCardClick?.(item);
    },
    [onCardClick],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const map = new Map<string, KanbanItem[]>();
    for (const col of columns) {
      map.set(col, []);
    }
    for (const item of items) {
      const list = map.get(item.groupValue);
      if (list) {
        list.push(item);
      } else {
        const uncategorized = map.get('') ?? [];
        uncategorized.push(item);
        if (!map.has('')) map.set('', uncategorized);
      }
    }
    return map;
  }, [items, columns]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { item: KanbanItem } | undefined;
    setActiveItem(data?.item ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      justDragged.current = true;
      // One macrotask later the next click is a genuine click again.
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
      if (demo) return;
      const { active, over } = event;
      if (!over) return;
      const itemId = active.id as string;
      const newColumn = over.id as string;
      const currentItem = items.find((i) => i.id === itemId);
      if (currentItem && currentItem.groupValue !== newColumn) {
        onMove(itemId, newColumn);
      }
    },
    [demo, items, onMove],
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div data-slot="kanban-board" className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col}
            value={col}
            label={columnLabels[col] ?? col}
            items={grouped.get(col) ?? []}
            onActivate={onCardClick === undefined ? undefined : activate}
          />
        ))}
      </div>
      <DragOverlay>{activeItem ? <KanbanCard item={activeItem} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
