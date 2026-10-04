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

import { ColumnNotices, ViewSwitcher } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { CountCell, EmptyCell, MetricCell, TextCell } from '@/components/views/grid-cells';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import {
  CreativeReportingPanel,
  NEW_CREATIVE_REPORT,
  type CreativeReportBriefOption,
} from './creative-reporting-panel';
import { countLabel, matchesCreativeReportSearch, type CreativeReportItem } from './fields';

/**
 * The Creative Reporting workspace: the Airtable-style grid (the base's only view), the header
 * actions and the side panel. The panel is NOT a modal: it is fixed to the right edge and the grid
 * stays clickable beside it. The open row (`?creativeReport=`) and the filter (`?q=`) are URL state
 * written with the History API, so a refresh restores them and either is a link you can send.
 */
export type { CreativeReportItem };

interface CreativeReportingWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCreativeReportColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
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

/**
 * THE Creative Reporting renderer registry, keyed by the resolver's `column_key`.
 *
 * `difference_cpa` is VIRTUAL — CPA minus target CPA, the base's own formula, with no Postgres
 * column behind it — and says so in its cell title. `brief_id` is the opposite and worth naming: a
 * REAL stored foreign key that no Airtable field maps to, because the base's `Creative Name` is a
 * formula and `Creative Name (from Creative)` is a lookup; it renders the brief's generated name.
 *
 * The seven metric cells are the shared `MetricCell` now, which replaced this file's private
 * `Metric`/`Dash` pair — the duplication `grid-cells.tsx` exists to end, so an empty value reads the
 * same on every table.
 */
const CREATIVE_REPORT_RENDERERS: ColumnRegistry<CreativeReportItem> = {
  name_angle_offer: {
    render: (item) => (
      <span className="flex items-center gap-1.5 font-medium">
        {item.row.nameAngleOffer}
        <PropagationBadge
          templateRowId={item.row.templateRowId}
          overriddenFields={item.row.overriddenFields}
        />
      </span>
    ),
    sortValue: (item) => item.row.nameAngleOffer,
  },
  brief_id: {
    render: (item) => <MetricCell label={item.row.briefName} />,
    sortValue: (item) => item.row.briefName,
  },
  // GRATSI-MATCH 2026-10-04: the base's `Creative Name (from Creative)` lookup, VIRTUAL — the
  // linked brief's §7 name, which the row already carries; `creativeNameFromCreative` is the one
  // reading of it and the cell prints the same `briefName` the Creative link column shows.
  creative_name_from_creative: {
    render: (item) => <MetricCell label={item.row.briefName} />,
    sortValue: (item) => item.row.briefName,
    cellTitle: (item) => item.row.briefName ?? undefined,
  },
  notes: { render: (item) => <TextCell value={item.row.notes} /> },
  ad_design: {
    render: (item) => <CountCell count={item.row.adDesign?.length ?? 0} noun="file" />,
    sortValue: (item) => item.row.adDesign?.length ?? 0,
  },
  ad_link: {
    render: (item) => item.adLinkHost ?? <EmptyCell />,
    cellTitle: (item) => item.row.adLink ?? undefined,
  },
  ctr: {
    render: (item) => <MetricCell label={item.ctrLabel} />,
    sortValue: (item) => (item.row.ctr === null ? null : Number(item.row.ctr)),
    align: 'right',
  },
  thumb_stop_rate: {
    render: (item) => <MetricCell label={item.thumbStopLabel} />,
    sortValue: (item) => (item.row.thumbStopRate === null ? null : Number(item.row.thumbStopRate)),
    align: 'right',
  },
  results: {
    render: (item) => <MetricCell label={item.resultsLabel} />,
    sortValue: (item) => (item.row.results === null ? null : Number(item.row.results)),
    align: 'right',
  },
  cpa: {
    render: (item) => <MetricCell label={item.cpaLabel} />,
    sortValue: (item) => (item.row.cpa === null ? null : Number(item.row.cpa)),
    align: 'right',
  },
  target_cpa: {
    render: (item) => <MetricCell label={item.targetCpaLabel} />,
    sortValue: (item) => (item.row.targetCpa === null ? null : Number(item.row.targetCpa)),
    align: 'right',
  },
  // The virtual one: nothing stored, and the cell title says where the number comes from.
  difference_cpa: {
    render: (item) =>
      item.differenceCpa === null ? (
        <EmptyCell />
      ) : (
        <StatusChip tone={item.differenceCpa.tone} label={item.differenceCpa.label} />
      ),
    sortValue: (item) => item.row.differenceCpa,
    cellTitle: () => 'CPA − Target CPA (formula, read-only)',
    align: 'right',
  },
  roas: {
    render: (item) => <MetricCell label={item.roasLabel} />,
    sortValue: (item) => (item.row.roas === null ? null : Number(item.row.roas)),
    align: 'right',
  },
  target_roas: {
    render: (item) => <MetricCell label={item.targetRoasLabel} />,
    sortValue: (item) => (item.row.targetRoas === null ? null : Number(item.row.targetRoas)),
    align: 'right',
  },
};

export function CreativeReportingWorkspace({
  items,
  briefOptions,
  demo,
  initialSelection,
  initialSearch,
  initialView = 'grid',
  columns,
  unconfiguredColumns = false,
}: CreativeReportingWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () =>
      gridColumnsFrom(columns, CREATIVE_REPORT_RENDERERS, {
        freezeFirst: true,
        frozenMinWidth: 240,
      }),
    [columns],
  );
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

        <ColumnNotices
          slotPrefix="creative-report"

          unconfigured={unconfiguredColumns}

          missing={grid.missing}

          registryName="CREATIVE_REPORT_RENDERERS in creative-reporting-workspace.tsx"
        />

        <AirtableGrid
          tableKey={CAP.tableKey}
          columns={grid.columns}
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
