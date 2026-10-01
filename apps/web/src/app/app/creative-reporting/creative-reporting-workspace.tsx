'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTableCapability, type ViewType } from '@tas/domain';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  PropagationBadge,
  StatusChip,
} from '@tas/ui';

import { ViewSwitcher } from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';

import {
  CreativeReportingPanel,
  NEW_CREATIVE_REPORT,
  type CreativeReportBriefOption,
} from './creative-reporting-panel';
import {
  countLabel,
  EM_DASH,
  matchesCreativeReportSearch,
  type CreativeReportItem,
} from './fields';

/**
 * The Creative Reporting workspace: the Airtable-style grid (the base's only view), the header
 * actions and the side panel. The panel is NOT a modal: it is fixed to the right edge and the grid
 * stays clickable beside it. The open row (`?creativeReport=`) and the filter (`?q=`) are URL state
 * written with the History API, so a refresh restores them and either is a link you can send.
 */
export type { CreativeReportItem };

interface CreativeReportingWorkspaceProps {
  readonly items: readonly CreativeReportItem[];
  readonly briefOptions: readonly CreativeReportBriefOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

const CAP = getTableCapability('creative-reporting') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

type UrlKey = 'creativeReport' | 'q';

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

/** A metric the server already formatted: right-aligned, in the mono face, or the dash. */
function Metric({ label }: { label: string }) {
  return label === EM_DASH ? <Dash /> : <span className="font-mono text-xs">{label}</span>;
}

/**
 * The grid columns: the frozen name carries the propagation badge; the Creative is the brief's
 * auto-generated name in the mono face; every metric is right-aligned mono; Difference CPA is the
 * base's formula as a chip and says so in its cell title; the ad link shows its host and keeps the
 * full URL in the title.
 */
const COLUMNS: readonly GridColumn<CreativeReportItem>[] = [
  {
    key: 'nameAngleOffer',
    header: 'Name + Angle + Offer',
    frozen: true,
    minWidth: 240,
    sortValue: (item) => item.row.nameAngleOffer,
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.row.nameAngleOffer}
        <PropagationBadge
          templateRowId={item.row.templateRowId}
          overriddenFields={item.row.overriddenFields}
        />
      </span>
    ),
  },
  {
    key: 'creative',
    header: 'Creative',
    sortValue: (item) => item.row.briefName,
    render: (item) =>
      item.row.briefName === null ? (
        <Dash />
      ) : (
        <span className="font-mono text-xs">{item.row.briefName}</span>
      ),
  },
  {
    key: 'ctr',
    header: 'CTR (%)',
    align: 'right',
    sortValue: (item) => (item.row.ctr === null ? null : Number(item.row.ctr)),
    render: (item) => <Metric label={item.ctrLabel} />,
  },
  {
    key: 'thumbStopRate',
    header: 'Thumb-stop rate',
    align: 'right',
    sortValue: (item) => (item.row.thumbStopRate === null ? null : Number(item.row.thumbStopRate)),
    render: (item) => <Metric label={item.thumbStopLabel} />,
  },
  {
    key: 'results',
    header: 'Results',
    align: 'right',
    sortValue: (item) => (item.row.results === null ? null : Number(item.row.results)),
    render: (item) => <Metric label={item.resultsLabel} />,
  },
  {
    key: 'cpa',
    header: 'CPA',
    align: 'right',
    sortValue: (item) => (item.row.cpa === null ? null : Number(item.row.cpa)),
    render: (item) => <Metric label={item.cpaLabel} />,
  },
  {
    key: 'targetCpa',
    header: 'Target CPA',
    align: 'right',
    sortValue: (item) => (item.row.targetCpa === null ? null : Number(item.row.targetCpa)),
    render: (item) => <Metric label={item.targetCpaLabel} />,
  },
  {
    key: 'differenceCpa',
    header: 'Difference CPA',
    align: 'right',
    sortValue: (item) => item.row.differenceCpa,
    cellTitle: () => 'CPA − Target CPA (formula, read-only)',
    render: (item) =>
      item.differenceCpa === null ? (
        <Dash />
      ) : (
        <StatusChip tone={item.differenceCpa.tone} label={item.differenceCpa.label} />
      ),
  },
  {
    key: 'roas',
    header: 'ROAS',
    align: 'right',
    sortValue: (item) => (item.row.roas === null ? null : Number(item.row.roas)),
    render: (item) => <Metric label={item.roasLabel} />,
  },
  {
    key: 'targetRoas',
    header: 'Target ROAS',
    align: 'right',
    sortValue: (item) => (item.row.targetRoas === null ? null : Number(item.row.targetRoas)),
    render: (item) => <Metric label={item.targetRoasLabel} />,
  },
  {
    key: 'adLink',
    header: 'Ad link',
    cellTitle: (item) => item.row.adLink ?? undefined,
    render: (item) => item.adLinkHost ?? <Dash />,
  },
  {
    key: 'updated',
    header: 'Updated',
    sortValue: (item) => item.updatedTitle,
    cellTitle: (item) => item.updatedTitle,
    render: (item) => <span className="text-text3">{item.updatedLabel}</span>,
  },
];

export function CreativeReportingWorkspace({
  items,
  briefOptions,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
}: CreativeReportingWorkspaceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView);

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('creativeReport', id);
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
    () =>
      query === '' ? items : items.filter((item) => matchesCreativeReportSearch(item.row, query)),
    [items, query],
  );

  const open = items.find((item) => item.row.id === selection)?.row ?? null;
  const creating = selection === NEW_CREATIVE_REPORT;

  const newButton = (slot: string) => (
    <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
      <Button
        size="sm"
        disabled={demo}
        className={demo ? disabledWriteClassName : undefined}
        onClick={() => {
          select(NEW_CREATIVE_REPORT);
        }}
        data-slot={slot}
      >
        New report
      </Button>
    </DisabledWrite>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          Creative Reporting
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Creative Reporting</h1>
          {newButton('new-creative-report')}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="creative-report-count">{countLabel(items.length, visible.length)}</span>{' '}
          — the hand-kept numbers behind every launched ad, against their targets.
        </p>
      </header>

      <section aria-labelledby="creative-reporting-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="creative-reporting-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                filter(event.target.value);
              }}
              placeholder="Search name, creative, notes or link"
              aria-label="Search creative reports"
              data-slot="creative-report-search"
              className="h-8 w-full sm:w-72"
            />
            <ViewSwitcher
              tableKey={CAP.tableKey}
              supportedViews={[...CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField={null}
            />
          </div>
        </div>

        <AirtableGrid
          tableKey={CAP.tableKey}
          columns={COLUMNS}
          rows={visible}
          rowId={(item) => item.row.id}
          rowLabel={(item) => item.row.nameAngleOffer}
          rowAttributes={(item) => ({ 'data-creative-report-id': item.row.id })}
          selectedId={selection}
          onRowClick={(item) => {
            select(item.row.id);
          }}
          tableSlot="creative-reporting-table"
          rowSlot="creative-report-row"
          empty={
            <div
              data-slot="creative-reporting-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              <p className="text-sm text-text2">
                {items.length === 0
                  ? 'No reports yet. Start with the last ad you launched.'
                  : `Nothing matches “${term}”. Try a name, a creative or a note.`}
              </p>
              {items.length === 0 ? (
                newButton('empty-new-creative-report')
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
      </section>

      {creating || open !== null ? (
        <CreativeReportingPanel
          key={selection}
          report={creating ? null : open}
          briefOptions={briefOptions}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
