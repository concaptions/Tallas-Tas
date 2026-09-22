'use client';

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import { TimelineView, type TimelineItem, ViewSwitcher } from '@/components/views';

import { CampaignPanel, NEW_CAMPAIGN, type LinkOption } from './campaigns-panel';
import { countLabel, EM_DASH, formatDate, matchesCampaignSearch } from './fields';

const CAMPAIGNS_CAP = getTableCapability('campaigns') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

export interface CampaignItem {
  readonly campaign: CampaignOffer;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

interface CampaignsWorkspaceProps {
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

export function CampaignsWorkspace({
  items,
  products,
  demo,
  initialSelection,
  initialSearch,
  initialView,
}: CampaignsWorkspaceProps) {
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

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(id);
    }
  };

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () =>
      query === '' ? items : items.filter((item) => matchesCampaignSearch(item.campaign, query)),
    [items, query],
  );

  const open = items.find((item) => item.campaign.id === selection)?.campaign ?? null;
  const creating = selection === NEW_CAMPAIGN;

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) map.set(p.id, p.name);
    return map;
  }, [products]);

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

        {activeView === 'timeline' ? (
          <TimelineView items={timelineItems} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <Table data-slot="campaigns-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3">Name</TableHead>
                  <TableHead className="px-3">Holiday</TableHead>
                  <TableHead className="px-3">Offer</TableHead>
                  <TableHead className="px-3">Code</TableHead>
                  <TableHead className="px-3">Official Date</TableHead>
                  <TableHead className="px-3">Ads Launch</TableHead>
                  <TableHead className="px-3">Ads End</TableHead>
                  <TableHead className="px-3">Confirmed</TableHead>
                  <TableHead className="px-3">Launched</TableHead>
                  <TableHead className="px-3">Product</TableHead>
                  <TableHead className="px-3">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={11} className="px-3 py-10">
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
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map(({ campaign, updatedLabel, updatedTitle }) => (
                    <TableRow
                      key={campaign.id}
                      data-slot="campaign-row"
                      data-campaign-id={campaign.id}
                      data-state={campaign.id === selection ? 'selected' : undefined}
                      role="button"
                      tabIndex={0}
                      aria-label={campaign.name}
                      onClick={() => {
                        select(campaign.id);
                      }}
                      onKeyDown={(event) => {
                        onRowKey(event, campaign.id);
                      }}
                      className="cursor-pointer"
                    >
                      <TableCell className="px-3 py-1.5 font-mono text-xs font-medium whitespace-nowrap text-text">
                        {campaign.name}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap">
                        {campaign.holiday ?? <span className="text-text4">{EM_DASH}</span>}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap">
                        {campaign.discountOffer ?? <span className="text-text4">{EM_DASH}</span>}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">
                        {campaign.code ?? <span className="text-text4">{EM_DASH}</span>}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap text-text2">
                        {formatDate(campaign.officialDate)}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap text-text2">
                        {formatDate(campaign.adsLaunchDate)}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap text-text2">
                        {formatDate(campaign.adsEndDate)}
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <StatusChip
                          tone={campaign.confirmedByClient ? 'ok' : 'mute'}
                          label={campaign.confirmedByClient ? 'Yes' : 'No'}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-1.5">
                        <StatusChip
                          tone={campaign.launched ? 'ok' : 'mute'}
                          label={campaign.launched ? 'Yes' : 'No'}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-1.5 whitespace-nowrap">
                        {campaign.productId !== null ? (
                          <StatusChip
                            tone="info"
                            label={productMap.get(campaign.productId) ?? EM_DASH}
                          />
                        ) : (
                          <span className="text-text4">{EM_DASH}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-1.5 text-text3" title={updatedTitle}>
                        {updatedLabel}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {creating || open !== null ? (
        <CampaignPanel
          key={selection}
          campaign={creating ? null : open}
          products={products}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
