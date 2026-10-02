'use client';

import { useMemo } from 'react';
import {
  applyUserView,
  freezeUpTo,
  frozenUpTo,
  type UserView,
  type UserViewConfig,
  type ViewType,
} from '@tas/domain';

import { FieldsMenu, type FieldOption } from './fields-menu';
import { FreezeMenu } from './freeze-menu';
import { ViewSwitcher } from './view-switcher';
import { ViewsMenu } from './views-menu';

interface ViewToolbarProps {
  readonly tableKey: string;
  readonly supportedViews: readonly ViewType[];
  readonly activeView: ViewType;
  readonly onViewChange: (view: ViewType) => void;
  readonly kanbanGroupByField: string | null;
  readonly views: readonly UserView[];
  readonly activeViewId: string | null;
  readonly onActivateView: (id: string | null) => void;
  readonly onCreateView: (name: string) => void;
  readonly onRenameView: (id: string, name: string) => void;
  readonly onDeleteView: (id: string) => void;
  readonly fields: readonly FieldOption[];
  readonly isFieldVisible: (key: string) => boolean;
  readonly onToggleField: (key: string) => void;
  /**
   * The viewer's active config. Given together with `onFreezeChange`, the Grid also carries the
   * Freeze popover (AI-22); the config is what tells it the viewer's column order and current
   * freeze. A table that has not been wired for it yet simply shows no Freeze control.
   */
  readonly viewConfig?: UserViewConfig;
  readonly onFreezeChange?: (frozenFields: readonly string[]) => void;
  readonly error?: string | null;
}

/**
 * The strip above every one of the six tables (Sprint 7, VIEWS-01): the view type switch, the
 * viewer's saved views, the Fields popover (Grid and Gallery only — a Kanban column is not a field)
 * and, on the Grid, the Freeze popover (AI-22). One component so the controls sit in the same place
 * on every page.
 */
export function ViewToolbar({
  tableKey,
  supportedViews,
  activeView,
  onViewChange,
  kanbanGroupByField,
  views,
  activeViewId,
  onActivateView,
  onCreateView,
  onRenameView,
  onDeleteView,
  fields,
  isFieldVisible,
  onToggleField,
  viewConfig,
  onFreezeChange,
  error = null,
}: ViewToolbarProps) {
  // The freeze is a prefix of the columns AS THE VIEWER SEES THEM, so the order and the visibility
  // of the active view are applied before the control is handed its list.
  const orderedKeys = useMemo(
    () => (viewConfig === undefined ? [] : applyUserView(fields, viewConfig).map((f) => f.key)),
    [fields, viewConfig],
  );
  const orderedFields = useMemo(
    () =>
      orderedKeys.flatMap((key) => {
        const field = fields.find((candidate) => candidate.key === key);
        return field === undefined ? [] : [field];
      }),
    [fields, orderedKeys],
  );

  return (
    <div className="flex flex-wrap items-center gap-2" data-slot="view-toolbar">
      <ViewSwitcher
        tableKey={tableKey}
        supportedViews={supportedViews}
        activeView={activeView}
        onViewChange={onViewChange}
        kanbanGroupByField={kanbanGroupByField}
      />
      <ViewsMenu
        views={views}
        activeViewId={activeViewId}
        onActivate={onActivateView}
        onCreate={onCreateView}
        onRename={onRenameView}
        onDelete={onDeleteView}
        error={error}
      />
      {activeView === 'grid' || activeView === 'gallery' ? (
        <FieldsMenu fields={fields} isVisible={isFieldVisible} onToggle={onToggleField} />
      ) : null}
      {activeView === 'grid' && viewConfig !== undefined && onFreezeChange !== undefined ? (
        <FreezeMenu
          fields={orderedFields}
          frozenUpTo={frozenUpTo(orderedKeys, viewConfig)}
          onFreezeChange={(key) => {
            onFreezeChange(freezeUpTo(orderedKeys, key));
          }}
        />
      ) : null}
    </div>
  );
}
