'use client';

import { useMemo } from 'react';
import {
  applyUserView,
  freezeUpTo,
  frozenUpTo,
  type UserView,
  type UserViewConfig,
  type UserViewFilter,
  type ViewType,
} from '@tas/domain';

import { CoverMenu } from './cover-menu';
import { FieldsMenu, type FieldOption } from './fields-menu';
import { FilterMenu } from './filter-menu';
import { FreezeMenu } from './freeze-menu';
import { GroupMenu } from './group-menu';
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
   * Moves one field a step in the viewer's order (action item 16, the reorder half of "customise
   * the card"). Given, the Fields popover carries "Arrange fields…"; the grid's columns and the
   * gallery's card lines follow the same stored `fieldOrder`, so one control reorders both.
   */
  readonly onMoveField?: (key: string, direction: 'up' | 'down') => void;
  /**
   * The viewer's active config. Given together with `onFreezeChange`, the Grid also carries the
   * Freeze popover (action item 22); the config is what tells it the viewer's column order and
   * their current freeze. A table not wired for it yet simply shows no Freeze control.
   */
  readonly viewConfig?: UserViewConfig;
  readonly onFreezeChange?: (frozenFields: readonly string[]) => void;
  /**
   * The media columns this table allows as a gallery cover, already narrowed to the ones this brand
   * resolves (`coverFieldOptions`). Given together with `onCoverChange`, the Gallery carries the
   * Cover popover (action item 16); an empty list renders no control, which is the right answer for
   * the four core tables that declare no media column.
   */
  readonly coverFields?: readonly FieldOption[];
  readonly onCoverChange?: (coverField: string | null) => void;
  /**
   * The view's field conditions (AI-32). Given, the Filter popover renders wherever rows render —
   * Grid, Gallery and List alike, because the conditions narrow the ROWS, not one drawing of
   * them. Field options are the page's resolved columns, the same list the Fields popover reads.
   */
  readonly onFiltersChange?: (filters: readonly UserViewFilter[]) => void;
  /** The grid's grouping column (AI-32). Given, the Grid carries the Group popover. */
  readonly onGroupChange?: (groupBy: string | null) => void;
  readonly error?: string | null;
}

/**
 * The strip above every one of the six tables (Sprint 7, VIEWS-01): the view type switch, the
 * viewer's saved views, the Fields popover (Grid, Gallery and List — a Kanban column is not a
 * field), the Freeze popover on the Grid (action item 22) and the Cover popover on the Gallery
 * (action item 16). One component so the controls sit in the same place on every page, and so a
 * control that makes no sense for the active view is simply not there.
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
  onMoveField,
  viewConfig,
  onFreezeChange,
  coverFields = [],
  onCoverChange,
  onFiltersChange,
  onGroupChange,
  error = null,
}: ViewToolbarProps) {
  // The freeze is a prefix of the columns AS THE VIEWER SEES THEM, so the active view's order and
  // visibility are applied before the control is handed its list — otherwise "freeze up to Theme"
  // would mean a different set of columns in the menu than on screen.
  const orderedFields = useMemo(
    () => (viewConfig === undefined ? [] : applyUserView(fields, viewConfig)),
    [fields, viewConfig],
  );
  const orderedKeys = useMemo(() => orderedFields.map((field) => field.key), [orderedFields]);
  // The Fields popover lists EVERY field in the viewer's order — hidden ones keep their place, so
  // re-showing a column puts it back where the viewer left it, not at the end of the table.
  const arrangedFields = useMemo(
    () =>
      viewConfig === undefined
        ? fields
        : applyUserView(fields, {
            visibleFields: null,
            fieldOrder: viewConfig.fieldOrder,
            frozenFields: [],
          }),
    [fields, viewConfig],
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
      {activeView === 'grid' || activeView === 'gallery' || activeView === 'list' ? (
        <FieldsMenu
          fields={arrangedFields}
          isVisible={isFieldVisible}
          onToggle={onToggleField}
          onMoveField={onMoveField}
        />
      ) : null}
      {(activeView === 'grid' || activeView === 'gallery' || activeView === 'list') &&
      viewConfig !== undefined &&
      onFiltersChange !== undefined ? (
        <FilterMenu
          fields={arrangedFields}
          filters={viewConfig.filters}
          onFiltersChange={onFiltersChange}
        />
      ) : null}
      {activeView === 'grid' && viewConfig !== undefined && onGroupChange !== undefined ? (
        <GroupMenu
          fields={arrangedFields}
          groupBy={viewConfig.groupBy}
          onGroupChange={onGroupChange}
        />
      ) : null}
      {activeView === 'gallery' && viewConfig !== undefined && onCoverChange !== undefined ? (
        <CoverMenu
          fields={coverFields}
          coverField={viewConfig.coverField}
          onCoverChange={onCoverChange}
        />
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
