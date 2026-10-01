'use client';

import { startTransition, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import { Button, Input, PropagationBadge, StatusChip } from '@tas/ui';

import { KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import { moveSmCampaignFeedTaskAction } from './actions';
import {
  countLabel,
  EM_DASH,
  EMPTY_LANE,
  emptyLaneLabel,
  isSmKanbanField,
  kanbanGroupValue,
  kanbanLanes,
  kanbanLaneTone,
  matchesSmTaskSearch,
  platformLabel,
  platformTone,
  REMINDER_LABEL,
  REMINDER_TONE,
  statusLabel,
  statusTone,
  type SmKanbanField,
  type SmTaskItem,
} from './fields';
import { NEW_TASK, SmCampaignFeedPanel } from './sm-campaign-feed-panel';

/**
 * The SM Campaign Feed grid, its Kanban board and its side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open task lives in the `?task=` query parameter, written
 * with the History API so opening a row is instant and a refresh still reopens it. The filter is
 * URL-backed the same way, in `?q=`.
 *
 * The board groups by status or by platform (the two `kanbanFields` of the `sm-campaign-feed`
 * capability); a drop posts one field and one key to `moveSmCampaignFeedTaskAction`. Every string
 * on a card or in a cell was computed on the server or is a vocabulary label from `fields.ts`; this
 * component computes nothing.
 */
export type { SmTaskItem } from './fields';

interface SmCampaignFeedWorkspaceProps {
  readonly items: readonly SmTaskItem[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  /** The saved Kanban group field, if any; anything but `status` or `platform` falls back to status. */
  readonly initialKanbanField?: string | null;
}

const TABLE_KEY = 'sm-campaign-feed';

const SM_CAP = getTableCapability(TABLE_KEY) as NonNullable<ReturnType<typeof getTableCapability>>;

/** Writes one table-state parameter without a server round trip; Next.js reads the History API back. */
function syncUrl(key: 'task' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * The Airtable-style grid columns: the frozen task column carries the propagation badge; Platform,
 * Status and Reminder are the shared `StatusChip` (never bare text); Due Date and Updated are the
 * strings the page computed. Notes are truncated in the cell and carried whole in its title.
 */
const SM_TASK_COLUMNS: readonly GridColumn<SmTaskItem>[] = [
  {
    key: 'taskName',
    header: 'Task',
    frozen: true,
    minWidth: 240,
    sortValue: (item) => item.task.taskName,
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.task.taskName}
        <PropagationBadge
          templateRowId={item.task.templateRowId}
          overriddenFields={item.task.overriddenFields}
        />
      </span>
    ),
  },
  {
    key: 'platform',
    header: 'Platform',
    sortValue: (item) => (item.task.platform === null ? null : platformLabel(item.task.platform)),
    render: (item) =>
      item.task.platform === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <StatusChip
          tone={platformTone(item.task.platform)}
          label={platformLabel(item.task.platform)}
        />
      ),
  },
  {
    key: 'dueDate',
    header: 'Due date',
    sortValue: (item) => item.task.dueDate?.getTime() ?? null,
    render: (item) =>
      item.task.dueDate === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="text-text2">{item.dueLabel}</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (item) => (item.task.status === null ? null : statusLabel(item.task.status)),
    render: (item) =>
      item.task.status === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <StatusChip tone={statusTone(item.task.status)} label={statusLabel(item.task.status)} />
      ),
  },
  {
    key: 'reminder',
    header: 'Reminder',
    sortValue: (item) => (item.reminder === 'due' ? 1 : 0),
    render: (item) =>
      item.reminder === 'due' ? (
        <StatusChip tone={REMINDER_TONE} label={REMINDER_LABEL} />
      ) : (
        <span className="text-text4">{EM_DASH}</span>
      ),
  },
  {
    key: 'notes',
    header: 'Notes',
    cellTitle: (item) => item.task.notes ?? undefined,
    render: (item) =>
      item.task.notes === null ? (
        <span className="text-text4">{EM_DASH}</span>
      ) : (
        <span className="block max-w-[28rem] truncate">{item.task.notes}</span>
      ),
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

function initialGroupField(requested: string | null | undefined): SmKanbanField {
  return typeof requested === 'string' && isSmKanbanField(requested) ? requested : 'status';
}

export function SmCampaignFeedWorkspace({
  items,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  initialKanbanField = null,
}: SmCampaignFeedWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [kanbanField, setKanbanField] = useState<SmKanbanField>(() =>
    initialGroupField(initialKanbanField),
  );

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('task', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const close = useCallback(() => {
    select(null);
  }, [select]);

  const saved = useCallback(
    (id: string) => {
      select(id);
      router.refresh();
    },
    [router, select],
  );

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => matchesSmTaskSearch(item.task, query))),
    [items, query],
  );

  const open = items.find((item) => item.task.id === selection) ?? null;
  const creating = selection === NEW_TASK;

  const lanes = useMemo(() => {
    const base = kanbanLanes(kanbanField);
    const needsEmpty = visible.some(
      (item) => kanbanGroupValue(item.task, kanbanField) === EMPTY_LANE,
    );
    return needsEmpty ? [...base, { value: EMPTY_LANE, label: emptyLaneLabel(kanbanField) }] : base;
  }, [visible, kanbanField]);

  const kanbanColumns = useMemo(() => lanes.map((lane) => lane.value), [lanes]);
  const kanbanLabels = useMemo(
    () => Object.fromEntries(lanes.map((lane) => [lane.value, lane.label])),
    [lanes],
  );

  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      visible.map(({ task, dueLabel, reminder }) => {
        const groupValue = kanbanGroupValue(task, kanbanField);
        // The card's chip shows the OTHER field, so a status board still says the platform.
        const other =
          kanbanField === 'status'
            ? task.platform === null
              ? null
              : { label: platformLabel(task.platform), tone: platformTone(task.platform) }
            : task.status === null
              ? null
              : { label: statusLabel(task.status), tone: statusTone(task.status) };
        return {
          id: task.id,
          name: task.taskName,
          groupValue,
          subtitle: task.dueDate === null ? undefined : dueLabel,
          chipLabel: other?.label,
          chipTone: other?.tone,
          badges: reminder === 'due' ? [{ label: REMINDER_LABEL, tone: REMINDER_TONE }] : undefined,
          accentTone: kanbanLaneTone(kanbanField, groupValue),
        };
      }),
    [visible, kanbanField],
  );

  const handleKanbanMove = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      startTransition(() => {
        void moveSmCampaignFeedTaskAction({ id: itemId, field: kanbanField, value: newValue }).then(
          (result) => {
            if (result.ok) router.refresh();
          },
        );
      });
    },
    [demo, kanbanField, router],
  );

  const handleCardClick = useCallback(
    (card: KanbanItem) => {
      select(card.id);
    },
    [select],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">SM Campaign Feed</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">SM Campaign Feed</h1>
          <Button
            size="sm"
            onClick={() => {
              select(NEW_TASK);
            }}
            data-slot="new-sm-task"
          >
            New task
          </Button>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="sm-task-count">{countLabel(items.length, visible.length)}</span> — the
          social posts and campaign chores, with the platform each one targets.
        </p>
      </header>

      <section aria-labelledby="sm-tasks-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 id="sm-tasks-heading" className="text-sm font-medium text-text2">
              Feed
            </h2>
            <ViewSwitcher
              tableKey={TABLE_KEY}
              supportedViews={[...SM_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={kanbanField}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeView === 'kanban' ? (
              <select
                value={kanbanField}
                onChange={(event) => {
                  setKanbanField(initialGroupField(event.target.value));
                }}
                className="h-8 rounded-input border border-line bg-surface px-2 text-xs text-text"
                aria-label="Group by"
                data-slot="sm-task-group-by"
              >
                {SM_CAP.kanbanFields.map((option) => (
                  <option key={option.field} value={option.field}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search task, notes, platform or status"
              aria-label="Search tasks by name, notes, platform or status"
              data-slot="sm-task-search"
              className="h-8 w-full sm:w-72"
            />
          </div>
        </div>

        {activeView === 'kanban' ? (
          <KanbanBoard
            items={kanbanItems}
            columns={kanbanColumns}
            columnLabels={kanbanLabels}
            onMove={handleKanbanMove}
            onCardClick={handleCardClick}
            demo={demo}
          />
        ) : (
          <AirtableGrid
            tableKey={TABLE_KEY}
            columns={SM_TASK_COLUMNS}
            rows={visible}
            rowId={(item) => item.task.id}
            rowLabel={(item) => item.task.taskName}
            rowAttributes={(item) => ({ 'data-sm-task-id': item.task.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.task.id);
            }}
            tableSlot="sm-tasks-table"
            rowSlot="sm-task-row"
            empty={
              <div
                data-slot="sm-tasks-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No tasks yet. Start with the next post that has a date.'
                    : `Nothing matches “${term}”. Try a task name, a platform or a status.`}
                </p>
                {items.length === 0 ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      select(NEW_TASK);
                    }}
                    data-slot="empty-new-sm-task"
                  >
                    New task
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      filter('');
                    }}
                    data-slot="clear-search"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            }
          />
        )}
      </section>

      {creating || open !== null ? (
        <SmCampaignFeedPanel
          key={selection}
          item={creating ? null : open}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
