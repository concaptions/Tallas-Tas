'use client';

import { useCallback, useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@tas/ui';
import {
  CalendarRange,
  Captions,
  Grid3x3,
  LayoutGrid,
  Rows3,
  SquareKanban,
  type LucideIcon,
} from '@tas/ui/icons';
import type { ViewType } from '@tas/domain';

import {
  saveViewPreferenceAction,
  type SaveViewPreferenceInput,
} from '@/lib/view-preference-actions';

const VIEW_LABELS: Record<ViewType, string> = {
  grid: 'Grid',
  kanban: 'Kanban',
  gallery: 'Gallery',
  timeline: 'Timeline',
  list: 'List',
  focus: 'Focus Mode',
};

/** The glyph before each tab (B1.V24): the boards' 3×3 hash, four squares and framed lines. */
const VIEW_ICONS: Record<ViewType, LucideIcon> = {
  grid: Grid3x3,
  kanban: SquareKanban,
  gallery: LayoutGrid,
  timeline: CalendarRange,
  list: Rows3,
  focus: Captions,
};

interface ViewSwitcherProps {
  readonly tableKey: string;
  readonly supportedViews: readonly ViewType[];
  readonly activeView: ViewType;
  readonly onViewChange: (view: ViewType) => void;
  readonly kanbanGroupByField: string | null;
}

export function ViewSwitcher({
  tableKey,
  supportedViews,
  activeView,
  onViewChange,
  kanbanGroupByField,
}: ViewSwitcherProps) {
  const [, startTransition] = useTransition();

  const handleChange = useCallback(
    (value: string) => {
      const view = value as ViewType;
      onViewChange(view);
      startTransition(() => {
        const input: SaveViewPreferenceInput = {
          tableKey,
          viewType: view,
          kanbanGroupByField,
        };
        void saveViewPreferenceAction(input);
      });
    },
    [tableKey, onViewChange, kanbanGroupByField],
  );

  if (supportedViews.length <= 1) return null;

  return (
    <Tabs value={activeView} onValueChange={handleChange}>
      {/* The boards' pill (B1.V25): a bordered `surface2` list, 8px radius, 11.5px tabs. Set
          here, not in `tabs.tsx`, so the product-wide Tabs keep their look. */}
      <TabsList className="h-8 rounded-card border border-line">
        {supportedViews.map((view) => {
          const Icon = VIEW_ICONS[view];
          return (
            <TabsTrigger key={view} value={view} className="px-2.5 text-xs">
              <Icon className="size-3.5" strokeWidth={1.8} aria-hidden />
              {VIEW_LABELS[view]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
