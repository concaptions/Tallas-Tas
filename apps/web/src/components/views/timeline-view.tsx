'use client';

import { useMemo } from 'react';

export interface TimelineItem {
  readonly id: string;
  readonly name: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly subtitle?: string;
}

interface TimelineViewProps {
  readonly items: readonly TimelineItem[];
}

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TimelineView({ items }: TimelineViewProps) {
  const { validItems, timelineStart, totalDays, monthMarkers } = useMemo(() => {
    const valid = items
      .map((item) => ({
        ...item,
        start: parseDate(item.startDate),
        end: parseDate(item.endDate),
      }))
      .filter(
        (item): item is typeof item & { start: Date; end: Date } =>
          item.start !== null && item.end !== null && item.start <= item.end,
      );

    if (valid.length === 0) {
      return { validItems: [], timelineStart: new Date(), totalDays: 30, monthMarkers: [] };
    }

    const allStarts = valid.map((i) => i.start.getTime());
    const allEnds = valid.map((i) => i.end.getTime());
    const minDate = new Date(Math.min(...allStarts));
    const maxDate = new Date(Math.max(...allEnds));

    const padStart = new Date(minDate);
    padStart.setDate(padStart.getDate() - 3);
    const padEnd = new Date(maxDate);
    padEnd.setDate(padEnd.getDate() + 3);
    const days = Math.max(daysBetween(padStart, padEnd), 14);

    const markers: { label: string; offset: number }[] = [];
    const cursor = new Date(padStart);
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= padEnd) {
      const offset = daysBetween(padStart, cursor);
      markers.push({
        label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        offset,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { validItems: valid, timelineStart: padStart, totalDays: days, monthMarkers: markers };
  }, [items]);

  if (validItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text3">
        No items with date ranges to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line">
      <div className="min-w-[600px]">
        <div className="relative flex h-8 border-b border-line bg-surface2">
          {monthMarkers.map((marker) => (
            <div
              key={marker.label}
              className="absolute top-0 h-full border-l border-line"
              style={{ left: `${String((marker.offset / totalDays) * 100)}%` }}
            >
              <span className="ml-1 text-xs text-text4">{marker.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {validItems.map((item) => {
            const startOffset = daysBetween(timelineStart, item.start);
            const duration = daysBetween(item.start, item.end);
            const leftPct = (startOffset / totalDays) * 100;
            const widthPct = Math.max((duration / totalDays) * 100, 1);

            return (
              <div
                key={item.id}
                className="relative flex h-10 items-center border-b border-line/50"
              >
                <div
                  className="absolute flex h-6 items-center rounded bg-accent/20 px-2"
                  style={{ left: `${String(leftPct)}%`, width: `${String(widthPct)}%` }}
                  title={`${item.name}: ${formatDate(item.start)} – ${formatDate(item.end)}`}
                >
                  <span className="truncate text-xs font-medium text-text">{item.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
