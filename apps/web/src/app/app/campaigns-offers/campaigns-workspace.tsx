'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CampaignOffer } from '@tas/db';
import type { ViewType } from '@tas/domain';
import { getTableCapability } from '@tas/domain';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  StatusChip,
} from '@tas/ui';

import { ColumnNotices, TimelineView, type TimelineItem, ViewSwitcher } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';

import { CampaignPanel, NEW_CAMPAIGN, type LinkOption } from './campaigns-panel';
import {
  countLabel,
  EM_DASH,
  formatDate,
  matchesCampaignSearch,
  type LinkedRecord,
} from './fields';

const CAMPAIGNS_CAP = getTableCapability('campaigns') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

/**
 * One campaign with everything its GRID row and its panel show: the scalar columns on the row
 * itself, and every record linked from the other side of a junction or foreign key, resolved to
 * names by `page.tsx` in one pass over the sibling modules' already-loaded rows — never a per-row
 * query. GRATSI-MATCH campaigns_offers (2026-10-04): the reverse links are read-only columns here
 * because the Gratsi base displays them as fields.
 */
export interface CampaignItem {
  readonly campaign: CampaignOffer;
  /** The linked product's name, resolved by the page; null when `product_id` is null. */
  readonly productName: string | null;
  /** Names of the collections whose `campaign_id` points here (the base's `Collections`). */
  readonly collections: readonly string[];
  /** `email_campaign_campaigns`, from the email side (the base's `Email Campaigns`). */
  readonly emailCampaigns: readonly LinkedRecord[];
  /** `email_flow_campaigns` — the FLOWS side, despite the base label `Email Campaigns Management copy`. */
  readonly emailFlows: readonly LinkedRecord[];
  /** `youtube_copy_campaigns` (the base's `COPY`). */
  readonly youtubeCopy: readonly LinkedRecord[];
  /** `copywriting_campaigns` (the base's `Ads Copywriting copy`). */
  readonly metaCopy: readonly LinkedRecord[];
  /** `campaign_concepts` — CONCEPTS, despite the base label `Angles` (schema/campaign-links.ts). */
  readonly concepts: readonly LinkedRecord[];
}

interface CampaignsWorkspaceProps {
  /** The brand's ordered, labelled, visible columns, from `loadCampaignColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly items: readonly CampaignItem[];
  readonly products: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialSelection: string | null;
  readonly initialSearch: string;
  readonly initialView?: ViewType;
}

function syncUrl(key: 'campaign' | 'q', value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null || value.trim() === '') {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** The em-dash every empty cell renders, so blank never means "forgot to draw". */
function emptyCell() {
  return <span className="text-text4">{EM_DASH}</span>;
}

/** A plain text cell, truncated with the full value as the tooltip. */
function textCell(value: string | null) {
  return value === null || value === '' ? (
    emptyCell()
  ) : (
    <span className="block max-w-[22rem] truncate">{value}</span>
  );
}

/**
 * A read-only linked-records cell: the far rows' names, comma-joined and truncated, the full list
 * in the tooltip. `mono` marks generated system titles (Copy #s, Batch-Angle-Theme names), which
 * always render in `font-mono` (CLAUDE.md non-negotiable 6).
 */
function linkedNamesCell(labels: readonly string[], mono = false) {
  if (labels.length === 0) return emptyCell();
  return (
    <span className={`block max-w-[20rem] truncate ${mono ? 'font-mono text-xs' : ''}`}>
      {labels.join(', ')}
    </span>
  );
}

const linkedTitle = (labels: readonly string[]) =>
  labels.length === 0 ? undefined : labels.join(', ');

/**
 * THE Campaigns & Offers renderer registry, keyed by the resolver's `column_key`. Every key either
 * base can resolve has an entry, so the "Configured but not drawn here" notice never fires: the
 * parent's thirteen (the stored columns, `collections` and `product_id`) and Gratsi's six
 * junction-backed reverse links.
 */
const CAMPAIGN_RENDERERS: ColumnRegistry<CampaignItem> = {
  name: {
    // The generated Holiday-Offer-Code name: system output, always font-mono (non-negotiable 6).
    render: (item) => (
      <span className="font-mono text-xs font-medium whitespace-nowrap text-text">
        {item.campaign.name}
      </span>
    ),
    sortValue: (item) => item.campaign.name,
  },
  holiday: {
    render: (item) => item.campaign.holiday ?? emptyCell(),
    sortValue: (item) => item.campaign.holiday,
  },
  official_date: {
    render: (item) => (
      <span className="whitespace-nowrap text-text2">{formatDate(item.campaign.officialDate)}</span>
    ),
    sortValue: (item) => item.campaign.officialDate,
  },
  country: {
    render: (item) => item.campaign.country ?? emptyCell(),
    sortValue: (item) => item.campaign.country,
  },
  description: {
    render: (item) => textCell(item.campaign.description),
    cellTitle: (item) => item.campaign.description ?? undefined,
    minWidth: 220,
  },
  promotional_ideas: {
    render: (item) => textCell(item.campaign.promotionalIdeas),
    cellTitle: (item) => item.campaign.promotionalIdeas ?? undefined,
    minWidth: 200,
  },
  confirmed_by_client: {
    render: (item) => (
      <StatusChip
        tone={item.campaign.confirmedByClient ? 'ok' : 'mute'}
        label={item.campaign.confirmedByClient ? 'Yes' : 'No'}
      />
    ),
    sortValue: (item) => (item.campaign.confirmedByClient ? 1 : 0),
  },
  launched: {
    render: (item) => (
      <StatusChip
        tone={item.campaign.launched ? 'ok' : 'mute'}
        label={item.campaign.launched ? 'Yes' : 'No'}
      />
    ),
    sortValue: (item) => (item.campaign.launched ? 1 : 0),
  },
  ads_launch_date: {
    render: (item) => (
      <span className="whitespace-nowrap text-text2">
        {formatDate(item.campaign.adsLaunchDate)}
      </span>
    ),
    sortValue: (item) => item.campaign.adsLaunchDate,
  },
  ads_end_date: {
    render: (item) => (
      <span className="whitespace-nowrap text-text2">{formatDate(item.campaign.adsEndDate)}</span>
    ),
    sortValue: (item) => item.campaign.adsEndDate,
  },
  discount_offer: {
    render: (item) => item.campaign.discountOffer ?? emptyCell(),
    sortValue: (item) => item.campaign.discountOffer,
  },
  code: {
    render: (item) =>
      item.campaign.code === null ? (
        emptyCell()
      ) : (
        <span className="font-mono text-xs whitespace-nowrap">{item.campaign.code}</span>
      ),
    sortValue: (item) => item.campaign.code,
  },
  // The reverse of `collections.campaign_id`: the collections running on this campaign, read-only.
  collections: {
    render: (item) => linkedNamesCell(item.collections),
    sortValue: (item) => item.collections.length,
    cellTitle: (item) => linkedTitle(item.collections),
  },
  product_id: {
    render: (item) =>
      item.productName === null ? emptyCell() : <StatusChip tone="info" label={item.productName} />,
    sortValue: (item) => item.productName,
  },
  // Gratsi's `COPY`: youtube_copy_campaigns, generated Copy # titles in font-mono.
  youtube_copy_campaigns: {
    render: (item) =>
      linkedNamesCell(
        item.youtubeCopy.map((link) => link.label),
        true,
      ),
    sortValue: (item) => item.youtubeCopy.length,
    cellTitle: (item) => linkedTitle(item.youtubeCopy.map((link) => link.label)),
  },
  // Gratsi's `Angles`, which links CONCEPTS: generated Batch-Angle-Theme names, font-mono.
  campaign_concepts: {
    render: (item) =>
      linkedNamesCell(
        item.concepts.map((link) => link.label),
        true,
      ),
    sortValue: (item) => item.concepts.length,
    cellTitle: (item) => linkedTitle(item.concepts.map((link) => link.label)),
  },
  email_campaign_campaigns: {
    render: (item) => linkedNamesCell(item.emailCampaigns.map((link) => link.label)),
    sortValue: (item) => item.emailCampaigns.length,
    cellTitle: (item) => linkedTitle(item.emailCampaigns.map((link) => link.label)),
  },
  // The FLOWS side: Gratsi labels it `Email Campaigns Management copy`.
  email_flow_campaigns: {
    render: (item) => linkedNamesCell(item.emailFlows.map((link) => link.label)),
    sortValue: (item) => item.emailFlows.length,
    cellTitle: (item) => linkedTitle(item.emailFlows.map((link) => link.label)),
  },
  copywriting_campaigns: {
    render: (item) =>
      linkedNamesCell(
        item.metaCopy.map((link) => link.label),
        true,
      ),
    sortValue: (item) => item.metaCopy.length,
    cellTitle: (item) => linkedTitle(item.metaCopy.map((link) => link.label)),
  },
};

export function CampaignsWorkspace({
  columns,
  unconfiguredColumns = false,
  items,
  products,
  demo,
  initialSelection,
  initialSearch,
  initialView,
}: CampaignsWorkspaceProps) {
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, CAMPAIGN_RENDERERS, { freezeFirst: true, frozenMinWidth: 200 }),
    [columns],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [search, setSearch] = useState(initialSearch);
  const [activeView, setActiveView] = useState<ViewType>(initialView ?? 'grid');

  const select = useCallback((id: string | null) => {
    setSelection(id);
    syncUrl('campaign', id);
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
      query === '' ? items : items.filter((item) => matchesCampaignSearch(item.campaign, query)),
    [items, query],
  );

  const openItem = items.find((item) => item.campaign.id === selection) ?? null;
  const open = openItem?.campaign ?? null;
  const creating = selection === NEW_CAMPAIGN;

  const timelineItems: TimelineItem[] = useMemo(
    () =>
      visible.map(({ campaign }) => ({
        id: campaign.id,
        name: campaign.name,
        startDate: campaign.adsLaunchDate,
        endDate: campaign.adsEndDate,
        subtitle: campaign.holiday ?? undefined,
      })),
    [visible],
  );

  const newCampaign = (
    <Button
      size="sm"
      disabled={demo}
      className={demo ? disabledWriteClassName : undefined}
      onClick={() => {
        select(NEW_CAMPAIGN);
      }}
      data-slot="new-campaign"
    >
      New campaign
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          Campaigns &amp; Offers
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Campaigns &amp; Offers
          </h1>
          <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
            {newCampaign}
          </DisabledWrite>
        </div>
        <p className="text-sm text-text2">
          <span data-slot="campaign-count">{countLabel(items.length, visible.length)}</span> — ecomm
          offers, holidays and discount codes.
        </p>
      </header>

      <section aria-labelledby="campaigns-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="campaigns-heading" className="text-sm font-medium text-text2">
            Library
          </h2>
          <ViewSwitcher
            tableKey="campaigns"
            supportedViews={[...CAMPAIGNS_CAP.supportedViews]}
            activeView={activeView}
            onViewChange={setActiveView}
            kanbanGroupByField={null}
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name, holiday or code"
            aria-label="Search campaigns"
            data-slot="campaign-search"
            className="h-8 w-full sm:w-72"
          />
        </div>

        <ColumnNotices
          slotPrefix="campaign"
          unconfigured={unconfiguredColumns}
          missing={grid.missing}
          registryName="CAMPAIGN_RENDERERS in campaigns-workspace.tsx"
        />

        {activeView === 'timeline' ? (
          <TimelineView items={timelineItems} />
        ) : (
          <AirtableGrid
            tableKey="campaigns"
            columns={grid.columns}
            rows={visible}
            rowId={(item) => item.campaign.id}
            rowLabel={(item) => item.campaign.name}
            rowAttributes={(item) => ({ 'data-campaign-id': item.campaign.id })}
            selectedId={selection}
            onRowClick={(item) => {
              select(item.campaign.id);
            }}
            tableSlot="campaigns-table"
            rowSlot="campaign-row"
            empty={
              <div
                data-slot="campaigns-empty"
                className="flex flex-col items-center gap-3 text-center"
              >
                <p className="text-sm text-text2">
                  {items.length === 0
                    ? 'No campaigns yet. Create your first offer to start planning ads.'
                    : `Nothing matches "${term}". Try a campaign name, holiday or code.`}
                </p>
                {items.length === 0 ? (
                  <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
                    <Button
                      size="sm"
                      disabled={demo}
                      className={demo ? disabledWriteClassName : undefined}
                      onClick={() => {
                        select(NEW_CAMPAIGN);
                      }}
                      data-slot="empty-new-campaign"
                    >
                      New campaign
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
        <CampaignPanel
          key={selection}
          campaign={creating ? null : open}
          products={products}
          linkedCollections={openItem?.collections ?? []}
          linkedEmailCampaigns={openItem?.emailCampaigns ?? []}
          linkedEmailFlows={openItem?.emailFlows ?? []}
          linkedYoutubeCopy={openItem?.youtubeCopy ?? []}
          linkedMetaCopy={openItem?.metaCopy ?? []}
          linkedConcepts={openItem?.concepts ?? []}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
