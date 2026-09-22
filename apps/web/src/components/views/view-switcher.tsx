'use client';

import { useCallback, useTransition } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@tas/ui';
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
      <TabsList>
        {supportedViews.map((view) => (
          <TabsTrigger key={view} value={view}>
            {VIEW_LABELS[view]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
