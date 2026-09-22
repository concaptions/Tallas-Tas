'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { Card, CardContent, StatusChip } from '@tas/ui';

export interface KanbanItem {
  readonly id: string;
  readonly name: string;
  readonly groupValue: string;
  readonly subtitle?: string;
  readonly chipLabel?: string;
  readonly chipTone?: 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute';
  readonly href?: string;
}

interface KanbanBoardProps {
  readonly items: readonly KanbanItem[];
  readonly columns: readonly string[];
  readonly columnLabels: Record<string, string>;
  readonly onMove: (itemId: string, newValue: string) => void;
  readonly demo: boolean;
}

function KanbanCard({ item, isDragging }: { item: KanbanItem; isDragging?: boolean }) {
  return (
    <Card
      className={`cursor-grab border-line bg-surface transition-shadow ${isDragging ? 'rotate-2 shadow-lg opacity-80' : 'hover:shadow-md'}`}
    >
      <CardContent className="flex flex-col gap-1 p-3">
        <span className="text-sm font-medium text-text">{item.name}</span>
        {item.subtitle && <span className="text-xs text-text3">{item.subtitle}</span>}
        {item.chipLabel && <StatusChip tone={item.chipTone ?? 'mute'} label={item.chipLabel} />}
      </CardContent>
    </Card>
  );
}

function DraggableCard({ item }: { item: KanbanItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-30' : ''}>
      <KanbanCard item={item} />
    </div>
  );
}

function KanbanColumn({
  value,
  label,
  items,
}: {
  value: string;
  label: string;
  items: readonly KanbanItem[];
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
          <DraggableCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({ items, columns, columnLabels, onMove, demo }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<KanbanItem | null>(null);

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
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col}
            value={col}
            label={columnLabels[col] ?? col}
            items={grouped.get(col) ?? []}
          />
        ))}
      </div>
      <DragOverlay>{activeItem ? <KanbanCard item={activeItem} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
