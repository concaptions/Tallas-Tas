'use client';

import type { UserView, ViewType } from '@tas/domain';

import { FieldsMenu, type FieldOption } from './fields-menu';
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
  readonly error?: string | null;
}

/**
 * The strip above every one of the six tables (Sprint 7, VIEWS-01): the view type switch, the
 * viewer's saved views, and the Fields popover (Grid and Gallery only — a Kanban column is not a
 * field). One component so the three controls sit in the same place on every page.
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
  error = null,
}: ViewToolbarProps) {
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
    </div>
  );
}
