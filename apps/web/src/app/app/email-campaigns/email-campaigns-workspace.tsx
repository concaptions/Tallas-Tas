'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusChip,
} from '@tas/ui';

import {
  ColumnNotices,
  KanbanBoard,
  TimelineView,
  ViewSwitcher,
  type KanbanItem,
} from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { moveEmailCampaignAction } from './actions';
import {
  EmailCampaignPanel,
  NEW_EMAIL_CAMPAIGN,
  type EmailCampaignLinkOption,
} from './email-campaign-panel';
import {
  channelView,
  countLabel,
  EM_DASH,
  groupOptions,
  groupView,
  matchesEmailCampaignSearch,
  statusView,
  typeView,
  UNSET_GROUP_LABEL,
  UNSET_GROUP_VALUE,
  type ChoiceOption,
  type EmailCampaignGroupField,
  type EmailCampaignItem,
} from './fields';

/**
 * The Email Campaigns workspace: the Airtable-style grid, the Kanban board grouped by status, type
 * or channel, the send-date Timeline (the base's "Calendar"), the header actions and the side panel.
 * The panel is NOT a modal: it is fixed to the right edge and the grid stays clickable beside it.
 * The open row (`?emailCampaign=`), the filter (`?q=`), the view (`?view=`) and the board grouping
 * (`?group=`) are all URL state written with the History API, so a refresh restores them and any
 * of them is a link you can send.
 */
export type { EmailCampaignItem };

interface EmailCampaignsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadEmailCampaignColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly EmailCampaignItem[];
  readonly campaignOptions: readonly EmailCampaignLinkOption[];
  readonly productOptions: readonly EmailCampaignLinkOption[];
  readonly collectionOptions: readonly EmailCampaignLinkOption[];
  readonly assigneeOptions: readonly EmailCampaignLinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
  readonly initialGroupField?: EmailCampaignGroupField;
}

const CAP = getTableCapability('email-campaigns') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

type UrlKey = 'emailCampaign' | 'q' | 'view' | 'group';

/** Writes one piece of table state without a server round trip; an empty value clears the key. */
function syncUrl(key: UrlKey, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function Dash() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/** A date the system owns — stored or computed — always `YYYY-MM-DD` in the mono face. */
function MonoDate({ value }: { value: string | null }) {
  return value === null ? <Dash /> : <span className="font-mono text-xs">{value}</span>;
}

function Choice({ view }: { view: ChoiceOption | null }) {
  return view === null ? <Dash /> : <StatusChip tone={view.tone} label={view.label} />;
}

/**
 * THE Email Campaigns renderer registry, keyed by the resolver's `column_key`.
 *
 * `design_due_date` and `copywriting_due_date` are VIRTUAL — the send date minus 5 and minus 10
 * days, formulas with no Postgres column behind either, and the copywriting one calls the design one
 * so the chain cannot drift. Each keeps the cell title that says where its number comes from.
 */
const EMAIL_CAMPAIGN_RENDERERS: ColumnRegistry<EmailCampaignItem> = {
  name: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.row.name}
        <PropagationBadge
          templateRowId={item.row.templateRowId}
          overriddenFields={item.row.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.row.name,
  },
  status: {
    render: (item) => <Choice view={statusView(item.row.status)} />,
    sortValue: (item) => statusView(item.row.status)?.label ?? null,
  },
  type: {
    render: (item) => <Choice view={typeView(item.row.type)} />,
    sortValue: (item) => typeView(item.row.type)?.label ?? null,
  },
  channel: {
    render: (item) => <Choice view={channelView(item.row.channel)} />,
    sortValue: (item) => channelView(item.row.channel)?.label ?? null,
  },
  send_date: {
    render: (item) => <MonoDate value={item.row.sendDate} />,
    sortValue: (item) => item.row.sendDate,
  },
  design_due_date: {
    render: (item) => <MonoDate value={item.row.designDueDate} />,
    sortValue: (item) => item.row.designDueDate,
    cellTitle: () => 'Send date − 5 days (formula, read-only)',
  },
  copywriting_due_date: {
    render: (item) => <MonoDate value={item.row.copywritingDueDate} />,
    sortValue: (item) => item.row.copywritingDueDate,
    cellTitle: () => 'Send date − 10 days (formula, read-only)',
  },
  assignee_id: {
    render: (item) => item.row.assigneeName ?? <Dash />,
    sortValue: (item) => item.row.assigneeName,
  },
  klaviyo_link: {
    render: (item) => item.klaviyoHost ?? <Dash />,
    cellTitle: (item) => item.row.klaviyoLink ?? undefined,
  },
  copy_link: {
    render: (item) => item.copyHost ?? <Dash />,
    cellTitle: (item) => item.row.copyLink ?? undefined,
  },
  email_campaign_campaigns: {
    render: (item) =>
      item.row.campaignOfferNames.length === 0 ? (
        <Dash />
      ) : (
        <span className="flex flex-wrap gap-1">
          {item.row.campaignOfferNames.map((name) => (
            <StatusChip key={name} tone="info" label={name} />
          ))}
        </span>
      ),
    sortValue: (item) => item.row.campaignOfferNames.join(', '),
  },
};

export function EmailCampaignsWorkspace({
  items,
  campaignOptions,
  productOptions,
  collectionOptions,
  assigneeOptions,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  initialGroupField = 'status',
  columns,
  unconfiguredColumns = false,
}: EmailCampaignsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, EMAIL_CAMPAIGN_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 220,
      }),
    [columns],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);
  const [groupField, setGroupField] = useState<EmailCampaignGroupField>(initialGroupField);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('emailCampaign', id);
  }, []);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl('q', next);
  }, []);

  const changeView = useCallback((view: ViewType) => {
    setActiveView(view);
    syncUrl('view', view === 'grid' ? null : view);
  }, []);

  const changeGroup = useCallback((field: EmailCampaignGroupField) => {
    setGroupField(field);
    syncUrl('group', field === 'status' ? null : field);
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
    () =>
      query === '' ? items : items.filter((item) => matchesEmailCampaignSearch(item.row, query)),
    [items, query],
  );

  const open = items.find((item) => item.row.id === selection)?.row ?? null;
  const creating = selection === NEW_EMAIL_CAMPAIGN;

  const columnOptions = groupOptions(groupField);
  const kanbanItems: readonly KanbanItem[] = useMemo(
    () =>
      visible.map(({ row }) => {
        const view = groupView(row, groupField);
        return {
          id: row.id,
          name: row.name,
          groupValue: view?.value ?? UNSET_GROUP_VALUE,
          subtitle: row.sendDate ?? undefined,
          chipLabel: view?.label,
          chipTone: view?.tone,
          accentTone: view?.tone,
          assignee: row.assigneeName,
        };
      }),
    [visible, groupField],
  );

  const kanbanColumns = useMemo(() => {
    const columns = columnOptions.map((option) => option.value);
    return kanbanItems.some((item) => item.groupValue === UNSET_GROUP_VALUE)
      ? [...columns, UNSET_GROUP_VALUE]
      : columns;
  }, [columnOptions, kanbanItems]);

  const kanbanLabels = useMemo(() => {
    const labels: Record<string, string> = { [UNSET_GROUP_VALUE]: UNSET_GROUP_LABEL };
    for (const option of columnOptions) labels[option.value] = option.label;
    return labels;
  }, [columnOptions]);

  const onMove = useCallback(
    (id: string, value: string) => {
      startTransition(async () => {
        const result = await moveEmailCampaignAction({ id, field: groupField, value });
        setMoveError(result.ok ? null : result.error);
        if (result.ok) router.refresh();
      });
    },
    [groupField, router],
  );

  const timelineItems = useMemo(
    () =>
      visible.map(({ row }) => ({
        id: row.id,
        name: row.name,
        startDate: row.sendDate,
        endDate: row.sendDate,
        subtitle: statusView(row.status)?.label,
      })),
    [visible],
  );

  const newButton = (slot: string) => (
    <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
      <Button
        size="sm"
        disabled={demo}
        className={demo ? disabledWriteClassName : undefined}
        onClick={() => {
          select(NEW_EMAIL_CAMPAIGN);
        }}
        data-slot={slot}
      >
        New email campaign
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Email Campaigns</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Email Campaigns</h1>
          {newButton('new-email-campaign')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="email-campaign-count">{countLabel(items.length, visible.length)}</span> —
          every planned email, SMS and push send, with its copy and design deadlines.
        </p>
      </header>

      <section aria-labelledby="email-campaigns-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="email-campaigns-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, status, assignee or link"
              aria-label="Search email campaigns"
              data-slot="email-campaign-search"
              className="h-8 w-full sm:w-72"
            />
            <ColumnNotices
              slotPrefix="email-campaign"
              unconfigured={unconfiguredColumns}
              missing={grid.missing}
              registryName="EMAIL_CAMPAIGN_RENDERERS in email-campaigns-workspace.tsx"
            />
            {activeView === 'kanban' ? (
              <Select
                value={groupField}
                onValueChange={(value) => {
                  changeGroup(value as EmailCampaignGroupField);
                }}
              >
                <SelectTrigger
                  className="h-8 w-40"
                  aria-label="Group by"
                  data-slot="email-campaign-group-by"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAP.kanbanFields.map((field) => (
                    <SelectItem key={field.field} value={field.field}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <ViewSwitcher
              tableKey={CAP.tableKey}
              supportedViews={[...CAP.supportedViews]}
              activeView={activeView}
              onViewChange={changeView}
              kanbanGroupByField={activeView === 'kanban' ? groupField : null}
            />
          </div>
        </div>

        {activeView === 'kanban' ? (
          <div className="flex flex-col gap-2" data-slot="email-campaigns-kanban">
            {moveError === null ? null : <p className="text-xs text-bad">{moveError}</p>}
            <KanbanBoard
              items={kanbanItems}
              columns={kanbanColumns}
              columnLabels={kanbanLabels}
              onMove={onMove}
              demo={demo}
              onCardClick={(item) => {
                select(item.id);
              }}
            />
          </div>
        ) : activeView === 'timeline' ? (
          <div data-slot="email-campaigns-timeline">
            <TimelineView items={timelineItems} />
          </div>
        ) : (
          <AirtableGrid
            tableKey={CAP.tableKey}
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.row.id}
            rowLabel={(item) => item.row.name}
            rowAttributes={(item) => ({ 'data-email-campaign-id': item.row.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.row.id);
            }}
            tableSlot="email-campaigns-table"
            rowSlot="email-campaign-row"
            empty={
              <div
                data-slot="email-campaigns-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No email campaigns yet. Start with the next send on the calendar.'
                    : `Nothing matches “${term}”. Try a name, a status or an assignee.`}
                </p>
                {items.length === 0 ? (
                  newButton('empty-new-email-campaign')
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
        <EmailCampaignPanel
          key={selection}
          emailCampaign={creating ? null : open}
          campaignOptions={campaignOptions}
          productOptions={productOptions}
          collectionOptions={collectionOptions}
          assigneeOptions={assigneeOptions}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
