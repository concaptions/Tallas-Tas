'use client';

import { startTransition, useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import { toCsv } from '@tas/domain/csv';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
  StatusChip,
} from '@tas/ui';

import { ColumnNotices, KanbanBoard, ViewSwitcher, type KanbanItem } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { updateEmailFlowAction } from './actions';
import { EmailFlowPanel, NEW_EMAIL_FLOW, type LinkOption } from './email-flows-panel';
import {
  countLabel,
  EM_DASH,
  EMAIL_FLOW_CSV_COLUMNS,
  EMAIL_FLOW_FIELDS,
  kanbanColumnsFor,
  kanbanGroupOf,
  matchesSearch,
  NOT_SET,
  statusLabel,
  statusTone,
  typeLabel,
  typeTone,
  urlListText,
  type EmailFlowItem,
  type KanbanGroupField,
} from './fields';

/**
 * The Email Flows grid, its kanban board, the header actions and the side panel.
 *
 * The panel is NOT a modal: it is fixed to the right edge, the grid stays visible and clickable
 * beside it, and there is no backdrop. The open flow lives in the `?email-flow=` query parameter,
 * written with the History API so opening a row is instant and a refresh still reopens it. The
 * filter is URL-backed the same way, in `?q=`. The view (grid or kanban) and the board's group field
 * come in as `?view=` and `?group=` and are then plain state.
 */
const EMAIL_FLOWS_CAP = getTableCapability('email-flows') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

interface EmailFlowsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadEmailFlowColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly EmailFlowItem[];
  readonly campaigns: readonly LinkOption[];
  readonly assignees: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  readonly initialGroupField?: KanbanGroupField;
}

/** The file a strategist gets from "Download template". */
const TEMPLATE_FILENAME = 'email-flows-template.csv';

/** Why Upload CSV is inert outside demo mode: the import phase has not shipped yet. */
const UPLOAD_SOON_HINT = 'Bulk upload arrives with the CSV import phase.';

/**
 * Writes one table-state parameter without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(key: 'email-flow' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * Builds the template in the browser and hands it to the download manager. No fetch, no Server
 * Action, no database: `toCsv` is a pure function from `@tas/domain/csv`, which is why this control
 * stays enabled in demo mode.
 */
function downloadCsv(): void {
  const blob = new Blob([toCsv([...EMAIL_FLOW_CSV_COLUMNS], [])], {
    type: 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = TEMPLATE_FILENAME;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download before the browser has read the blob.
  window.setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1_000);
}

/**
 * The whole stored row as the panel's form would post it, so a kanban drag can change ONE field
 * and save through the same Server Action the panel uses; nothing is decided here.
 */
function formDataOf(item: EmailFlowItem): FormData {
  const { flow } = item;
  const formData = new FormData();
  formData.set('id', flow.id);
  for (const field of EMAIL_FLOW_FIELDS) {
    const value = flow[field.name];
    formData.set(
      field.name,
      typeof value === 'string' ? value : Array.isArray(value) ? urlListText(value) : '',
    );
  }
  for (const id of flow.campaignIds) {
    formData.append('campaignIds', id);
  }
  return formData;
}

function dash() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/**
 * THE Email Flows renderer registry, keyed by the resolver's `column_key`.
 *
 * `design_due_date` and `copywriting_due_date` are VIRTUAL — Airtable formulas chained off the
 * expected setup date, with no Postgres column behind either. The copywriting one calls the design
 * one so the chain cannot drift, and both are computed on read in `packages/db/src/email-flows.ts`;
 * the values arrive on the row already worked out. They render in `font-mono`, as generated output
 * does.
 */
export const EMAIL_FLOW_RENDERERS: ColumnRegistry<EmailFlowItem> = {
  flow_name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.flow.flowName}
        <PropagationBadge
          templateRowId={item.flow.templateRowId}
          overriddenFields={item.flow.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.flow.flowName,
  },
  status: {
    render: (item) =>
      item.flow.status === null ? (
        dash()
      ) : (
        <StatusChip tone={statusTone(item.flow.status)} label={statusLabel(item.flow.status)} />
      ),
    sortValue: (item) => (item.flow.status === null ? null : statusLabel(item.flow.status)),
  },
  type: {
    render: (item) =>
      item.flow.type === null ? (
        dash()
      ) : (
        <StatusChip tone={typeTone(item.flow.type)} label={typeLabel(item.flow.type)} />
      ),
    sortValue: (item) => (item.flow.type === null ? null : typeLabel(item.flow.type)),
  },
  expected_setup_date: {
    render: (item) => (item.flow.expectedSetupDate === null ? dash() : item.setupLabel),
    sortValue: (item) => item.flow.expectedSetupDate,
    cellTitle: (item) => item.flow.expectedSetupDate ?? undefined,
  },
  design_due_date: {
    render: (item) =>
      item.flow.designDueDate === null ? (
        dash()
      ) : (
        <span className="font-mono text-xs">{item.designDueLabel}</span>
      ),
    sortValue: (item) => item.flow.designDueDate,
    cellTitle: (item) => item.flow.designDueDate ?? undefined,
  },
  copywriting_due_date: {
    render: (item) =>
      item.flow.copywritingDueDate === null ? (
        dash()
      ) : (
        <span className="font-mono text-xs">{item.copywritingDueLabel}</span>
      ),
    sortValue: (item) => item.flow.copywritingDueDate,
    cellTitle: (item) => item.flow.copywritingDueDate ?? undefined,
  },
  assignee_id: {
    render: (item) => item.flow.assigneeName ?? dash(),
    sortValue: (item) => item.flow.assigneeName,
  },
  klaviyo_link: {
    render: (item) => item.klaviyoHost ?? dash(),
    sortValue: (item) => item.klaviyoHost,
    cellTitle: (item) => item.flow.klaviyoLink ?? undefined,
  },
};

interface EmailFlowsGridProps {
  readonly items: readonly EmailFlowItem[];
  /**
   * The grid columns, already joined from the resolver and the registry. Passed IN rather than built
   * here because this component is mounted twice — by the workspace and by the design-system page —
   * and a column set is per-brand data, which a presentational grid has no way to resolve.
   */
  readonly columns: readonly GridColumn<EmailFlowItem>[];
  readonly selectedId?: string | null;
  readonly onRowClick?: (item: EmailFlowItem) => void;
  readonly empty?: ReactNode;
}

/** The grid alone: the route mounts it with a row handler, the design-system page without one. */
export function EmailFlowsGrid({
  items,
  columns,
  selectedId,
  onRowClick,
  empty,
}: EmailFlowsGridProps) {
  return (
    <AirtableGrid
      tableKey="email-flows"
      columns={columns}
      rows={items}
      rowId={(item) => item.flow.id}
      rowLabel={(item) => item.flow.flowName}
      rowAttributes={(item) => ({ 'data-email-flow-id': item.flow.id })}
      selectedId={selectedId}
      onRowClick={onRowClick}
      tableSlot="email-flows-table"
      rowSlot="email-flow-row"
      empty={empty}
    />
  );
}

interface EmailFlowsBoardProps {
  readonly items: readonly EmailFlowItem[];
  readonly groupField: KanbanGroupField;
  readonly demo: boolean;
  readonly onMove?: (itemId: string, newValue: string) => void;
  readonly onCardClick?: (item: KanbanItem) => void;
}

/** The unset column's key: a flow with no value for the group field lands here. */
const UNSET_COLUMN = '';

/**
 * The board grouped by status or by type: one column per vocabulary value in the base's order,
 * empties kept, plus an unset column when a flow has no value. Each card carries the OTHER
 * single-select as its chip, the assignee, and a stripe in the column's tone.
 */
export function EmailFlowsBoard({
  items,
  groupField,
  demo,
  onMove,
  onCardClick,
}: EmailFlowsBoardProps) {
  const cards: readonly KanbanItem[] = useMemo(
    () =>
      items.map((item) => {
        const group = kanbanGroupOf(item.flow, groupField);
        const other = kanbanGroupOf(item.flow, groupField === 'status' ? 'type' : 'status');
        return {
          id: item.flow.id,
          name: item.flow.flowName,
          groupValue: group?.value ?? UNSET_COLUMN,
          subtitle: item.flow.expectedSetupDate === null ? undefined : `Setup ${item.setupLabel}`,
          chipLabel: other?.label,
          chipTone: other?.tone,
          assignee: item.flow.assigneeName,
          accentTone: group?.tone,
        };
      }),
    [items, groupField],
  );

  const { columns, labels } = useMemo(() => {
    const vocabulary = kanbanColumnsFor(groupField);
    const keys = vocabulary.map((column) => column.value);
    const names: Record<string, string> = Object.fromEntries(
      vocabulary.map((column) => [column.value, column.label]),
    );
    if (cards.some((card) => card.groupValue === UNSET_COLUMN)) {
      keys.push(UNSET_COLUMN);
      names[UNSET_COLUMN] = NOT_SET;
    }
    return { columns: keys, labels: names };
  }, [cards, groupField]);

  const noMove = useCallback(() => undefined, []);

  return (
    <KanbanBoard
      items={cards}
      columns={columns}
      columnLabels={labels}
      onMove={onMove ?? noMove}
      onCardClick={onCardClick}
      demo={demo}
    />
  );
}

export function EmailFlowsWorkspace({
  items,
  campaigns,
  assignees,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  initialGroupField = 'status',
  columns,
  unconfiguredColumns = false,
}: EmailFlowsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, EMAIL_FLOW_RENDERERS, { freezeFirst: true, frozenMinWidth: 220 }),
    [columns],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [groupField, setGroupField] = useState<KanbanGroupField>(initialGroupField);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('email-flow', id);
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
    () => (query === '' ? items : items.filter((item) => matchesSearch(item, query))),
    [items, query],
  );

  const open = items.find((item) => item.flow.id === selection)?.flow ?? null;
  const creating = selection === NEW_EMAIL_FLOW;

  /** A card dropped in another column saves that one field through the panel's own action. */
  const move = useCallback(
    (itemId: string, newValue: string) => {
      if (demo) return;
      const item = items.find((candidate) => candidate.flow.id === itemId);
      if (item === undefined) return;
      startTransition(() => {
        const formData = formDataOf(item);
        formData.set(groupField, newValue);
        void updateEmailFlowAction(null, formData).then(() => {
          router.refresh();
        });
      });
    },
    [demo, groupField, items, router],
  );

  const openCard = useCallback(
    (card: KanbanItem) => {
      select(card.id);
    },
    [select],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Email Flows</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Email Flows</h1>
          <div className="flex flex-wrap items-center gap-2">
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                size="sm"
                disabled={demo}
                className={demo ? disabledWriteClassName : undefined}
                onClick={() => {
                  select(NEW_EMAIL_FLOW);
                }}
                data-slot="new-email-flow"
              >
                New flow
              </Button>
            </DisabledWrite>
            {/*
              Upload CSV has no action behind it yet, so it is disabled in both modes — but it always
              explains itself, with the demo-mode hint when there is no session to write with.
            */}
            <DisabledWrite hint={demo ? DEMO_WRITE_HINT : UPLOAD_SOON_HINT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className={disabledWriteClassName}
                data-slot="upload-csv"
              >
                Upload CSV
              </Button>
            </DisabledWrite>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              title={`Header row: ${EMAIL_FLOW_CSV_COLUMNS.join(',')}`}
              data-slot="download-template"
            >
              Download template
            </Button>
          </div>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="email-flow-count">{countLabel(items.length, visible.length)}</span> — the
          automated Klaviyo flows the brand runs, one row per flow.
        </p>
      </header>

      <section aria-labelledby="email-flows-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="email-flows-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher
              tableKey="email-flows"
              supportedViews={[...EMAIL_FLOWS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={groupField}
            />
            <ColumnNotices
              slotPrefix="email-flow"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="EMAIL_FLOW_RENDERERS in email-flows-workspace.tsx"
            />
            {activeView === 'kanban' ? (
              <select
                value={groupField}
                onChange={(event) => {
                  setGroupField(event.target.value === 'type' ? 'type' : 'status');
                }}
                className="h-8 rounded-input border border-line bg-surface px-2 text-xs text-text"
                aria-label="Group by"
                data-slot="email-flow-kanban-group"
              >
                {EMAIL_FLOWS_CAP.kanbanFields.map((option) => (
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
              placeholder="Search name, status, type, assignee or campaign"
              aria-label="Search email flows"
              data-slot="email-flow-search"
              className="h-8 w-full sm:w-72"
            />
          </div>
        </div>

        {activeView === 'kanban' ? (
          <EmailFlowsBoard
            items={visible}
            groupField={groupField}
            demo={demo}
            onMove={move}
            onCardClick={openCard}
          />
        ) : (
          <EmailFlowsGrid
            items={visible}
            columns={grid.columns}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.flow.id);
            }}
            empty={
              <div
                data-slot="email-flows-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No email flows yet. Start with the welcome series.'
                    : `Nothing matches “${term}”. Try a flow name, a status or an assignee.`}
                </p>
                {items.length === 0 ? (
                  <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                    <Button
                      size="sm"
                      disabled={demo}
                      className={demo ? disabledWriteClassName : undefined}
                      onClick={() => {
                        select(NEW_EMAIL_FLOW);
                      }}
                      data-slot="empty-new-email-flow"
                    >
                      New flow
                    </Button>
                  </DisabledWrite>
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
        <EmailFlowPanel
          key={selection}
          flow={creating ? null : open}
          campaigns={campaigns}
          assignees={assignees}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
