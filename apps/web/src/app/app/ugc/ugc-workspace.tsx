'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tas/ui';
import { getTableCapability, type ViewType } from '@tas/domain';

import {
  KanbanBoard,
  GalleryView,
  ListView,
  type KanbanItem,
  type ListChip,
  coverFieldOptions,
  useTableView,
  ViewToolbar,
  galleryItemsFrom,
} from '@/components/views';
import { ColumnNotices } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { applyFilters } from '@/components/views/airtable-grid-logic';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import {
  BoolCell,
  ChipCell,
  ChipListCell,
  CountCell,
  DateCell,
  LinkCell,
  MoneyCell,
  TextCell,
} from '@/components/views/grid-cells';
import { ageBracketLabel, creatorPlatformLabel } from '@tas/domain/creators';

import { CreatorPanel, type CreatorVideo, type LinkOption } from './creator-panel';
import { PartnershipTable } from './partnership-table';
import {
  creatorCountLabel,
  creatorInitials,
  creatorTracks,
  DEFAULT_TAB,
  filteredCountLabel,
  identityLine,
  matchesQuery,
  partnershipActivityChip,
  NEW_CREATOR_SOON_HINT,
  NO_CREATORS_NOTE,
  NO_MATCH_NOTE,
  NO_PARTNERSHIPS_NOTE,
  partnershipCountLabel,
  SEARCH_PARAM,
  TAB_PARAM,
  UGC_TABS,
  type CollabRow,
  type CreatorCardRow,
  type PartnershipRow,
  type UgcTabKey,
} from './fields';

const CREATORS_CAP = getTableCapability('creators') as NonNullable<
  ReturnType<typeof getTableCapability>
>;

export interface UgcWorkspaceProps {
  /** The brand's ordered, labelled, visible creators columns, from `loadCreatorColumns`. */
  readonly columns: readonly ResolvedColumnView[];
  /** True when `columns` is the parent master-set fallback because the brand resolved none. */
  readonly unconfiguredColumns?: boolean;
  readonly creators: readonly CreatorCardRow[];
  readonly partnerships: readonly PartnershipRow[];
  readonly concepts: readonly LinkOption[];
  readonly products: readonly LinkOption[];
  readonly demo: boolean;
  readonly initialTab: UgcTabKey;
  readonly initialSearch: string;
  readonly initialSelection: string | null;
  readonly initialCollabs: readonly CollabRow[];
  readonly initialView?: ViewType;
  /** The open creator's showcase videos (Sprint 7, UGC media). */
  readonly initialVideos?: readonly CreatorVideo[];
  /** Whether this deployment can take a video upload (R2 configured and not demo mode). */
  readonly uploadsEnabled?: boolean;
  /** The viewer's saved views of this table (VIEWS-01); `userId` null in demo mode. */
  readonly userViews: UserViewsResult;
}

function syncUrl(tab: UgcTabKey, search: string, creator: string | null): void {
  const url = new URL(window.location.href);
  url.searchParams.set(TAB_PARAM, tab);
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  if (creator === null || creator === '') {
    url.searchParams.delete('creator');
  } else {
    url.searchParams.set('creator', creator);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/** One of the three approval tracks, drawn from the resolver's key for it. */
function trackRenderer(trackKey: 'internal' | 'client' | 'assets') {
  return {
    render: (creator: CreatorCardRow) => {
      const entry = creatorTracks(creator).find((candidate) => candidate.key === trackKey);
      return (
        <span data-slot="creator-track" data-track={trackKey}>
          <ChipCell
            chip={entry === undefined ? null : { label: entry.statusLabel, tone: entry.tone }}
          />
        </span>
      );
    },
    sortValue: (creator: CreatorCardRow) =>
      creatorTracks(creator).find((entry) => entry.key === trackKey)?.statusLabel ?? null,
  };
}

/**
 * THE UGC creators renderer registry, keyed by the resolver's `column_key`.
 *
 * This replaces the hand-written `CREATOR_COLUMNS` array — the widest on the platform at 33 columns.
 * No header string and no ordering live here: labels, order and visibility arrive as data from
 * `column_definitions`, and this says only how a cell is DRAWN. The frozen name cell keeps its
 * avatar (the profile picture, or initials on `bg-surface3` when there is none OR the URL is dead —
 * image), the three status tracks keep their `data-track` hooks, and costs stay `MoneyCell`.
 *
 * Costs and payments are INTERNAL figures (CLAUDE.md non-negotiable 10). This grid is the team
 * workspace; the client interface is a different page and never reads this registry.
 *
 * Four template columns have no entry, because this grid has never drawn them as columns:
 * `profile_pic_url` (it renders inside the name cell), `deadline`, `for_partnership_ads` and
 * `client_note`. They come back in `missing` and are stated on the page.
 */
/**
 * The avatar, surviving a dead URL (AI-26). `null` is not the only way to have no picture: 27 of
 * production's 31 stored profile pictures are airtableusercontent links that answer 410 Gone, so a
 * failed load flips to the same initials tile a missing URL gets. The grid's "never a broken
 * image" promise holds for the data that exists, not only for the data that is absent.
 */
function CreatorAvatar({ creator }: { readonly creator: CreatorCardRow }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement | null>(null);
  // A URL that died BEFORE hydration never fires onError at React: the browser fetched it while
  // the HTML was still streaming, so by the time handlers attach the error is history. The mount
  // check reads what the element already knows — complete with no pixels is a failed load.
  useEffect(() => {
    const node = image.current;
    if (node !== null && node.complete && node.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);
  if (creator.profilePicUrl === null || failed) {
    return (
      <span
        data-slot="creator-avatar"
        data-fallback="initials"
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-card border border-line bg-surface3 font-mono text-[10px] text-text3"
      >
        {creatorInitials(creator.name)}
      </span>
    );
  }
  return (
    <img
      ref={image}
      data-slot="creator-avatar"
      src={creator.profilePicUrl}
      alt=""
      width={28}
      height={28}
      className="size-7 shrink-0 rounded-card border border-line bg-surface3 object-cover"
      onError={() => {
        setFailed(true);
      }}
    />
  );
}

const CREATOR_RENDERERS: ColumnRegistry<CreatorCardRow> = {
  name: {
    render: (creator) => (
      <span className="flex items-center gap-2">
        <CreatorAvatar creator={creator} />
        <span className="font-medium" data-slot="creator-name">
          {creator.name}
        </span>
      </span>
    ),
    sortValue: (creator) => creator.name,
  },
  // Fidelity flip 2026-10-04: the base's SECOND Concepts link (0/70 filled) — the row's own
  // stored ids, never the creator_concepts junction (AI-41 stands). The em dash on every row today.
  concept_ids: {
    render: (creator) => (
      <TextCell
        value={
          creator.legacyConceptIds.length === 0
            ? null
            : `${String(creator.legacyConceptIds.length)} linked`
        }
      />
    ),
  },
  internal_creator_status: trackRenderer('internal'),
  client_status: trackRenderer('client'),
  internal_assets_status: trackRenderer('assets'),
  gender: {
    render: (creator) => <TextCell value={creator.gender} />,
    sortValue: (creator) => creator.gender,
  },
  age_bracket: {
    render: (creator) =>
      creator.ageBracket === null || creator.ageBracket === '' ? (
        <TextCell value={null} />
      ) : (
        <span data-slot="creator-identity">{ageBracketLabel(creator.ageBracket)}</span>
      ),
    sortValue: (creator) => creator.ageBracket,
  },
  ethnicity: { render: (creator) => <TextCell value={creator.ethnicity} /> },
  platform: {
    render: (creator) => (
      <ChipListCell
        chips={creator.platform.map((entry) => ({
          label: creatorPlatformLabel(entry),
          tone: 'mute',
        }))}
      />
    ),
  },
  creator_link: { render: (creator) => <LinkCell value={creator.creatorLink} /> },
  instagram_username: {
    render: (creator) => <TextCell value={creator.instagramUsername} mono />,
    sortValue: (creator) => creator.instagramUsername ?? null,
  },
  facebook_profile_url: { render: (creator) => <LinkCell value={creator.facebookProfileUrl} /> },
  // Junctions, as counts. `withLinks` overrides these from `creator_concepts` / `creator_products`,
  // because the identically named jsonb columns on the row are dead.
  creator_concepts: {
    render: (creator) => <CountCell count={creator.conceptIds.length} noun="concept" />,
    sortValue: (creator) => creator.conceptIds.length,
  },
  creator_products: {
    render: (creator) => <CountCell count={creator.productIds.length} noun="product" />,
    sortValue: (creator) => creator.productIds.length,
  },
  internal_brief: { render: (creator) => <TextCell value={creator.internalBrief} /> },
  creator_info_request: { render: (creator) => <TextCell value={creator.creatorInfoRequest} /> },
  raw_assets_url: { render: (creator) => <LinkCell value={creator.rawAssetsUrl} /> },
  video_intro_url: { render: (creator) => <LinkCell value={creator.videoIntroUrl} /> },
  shipping_location: { render: (creator) => <TextCell value={creator.shippingLocation} /> },
  tracking_number: { render: (creator) => <TextCell value={creator.trackingNumber} mono /> },
  date_of_management: {
    render: (creator) => <DateCell value={creator.dateOfManagement} />,
    sortValue: (creator) => creator.dateOfManagement?.toISOString() ?? null,
  },
  budget_per_60s: {
    render: (creator) => <MoneyCell value={creator.budgetPer60s} />,
    sortValue: (creator) => creator.budgetPer60s ?? null,
    align: 'right',
  },
  creator_cost: {
    render: (creator) => <MoneyCell value={creator.creatorCost} />,
    sortValue: (creator) => creator.creatorCost ?? null,
    align: 'right',
  },
  // GRATSI-MATCH 2026-10-04: the base's two FORMULA fields, virtual columns computed on the
  // server (page.tsx, one `now` per request) — the cells only print what arrived on the row.
  creator_cost_with_fee: {
    render: (creator) =>
      creator.costWithFee === null || creator.costWithFee === undefined ? (
        <TextCell value={null} />
      ) : (
        <span className="font-mono text-xs">${creator.costWithFee.toFixed(2)}</span>
      ),
    sortValue: (creator) => creator.costWithFee ?? null,
    align: 'right',
  },
  notify_flag: {
    render: (creator) => (
      <ChipCell chip={creator.notifyFlag === 'YES' ? { label: 'YES', tone: 'warn' } : null} />
    ),
    sortValue: (creator) => (creator.notifyFlag === 'YES' ? 1 : 0),
    align: 'center',
  },
  cost_usd: {
    render: (creator) => <MoneyCell value={creator.costUsd} />,
    sortValue: (creator) => creator.costUsd,
    align: 'right',
  },
  payment_date: {
    render: (creator) => <DateCell value={creator.paymentDate} />,
    sortValue: (creator) => creator.paymentDate?.toISOString() ?? null,
  },
  partnership_activity: {
    render: (creator) => {
      const chip = partnershipActivityChip(creator.partnershipActivity);
      return <ChipCell chip={chip.key === '' ? null : { label: chip.label, tone: chip.tone }} />;
    },
    sortValue: (creator) => creator.partnershipActivity ?? null,
  },
  partnership_activated_at: {
    render: (creator) => <DateCell value={creator.partnershipActivatedAt} />,
    sortValue: (creator) => creator.partnershipActivatedAt?.toISOString() ?? null,
  },
  partnership_period_days: {
    render: (creator) =>
      creator.partnershipPeriodDays === null || creator.partnershipPeriodDays === undefined ? (
        <TextCell value={null} />
      ) : (
        <span className="font-mono text-xs">{String(creator.partnershipPeriodDays)}</span>
      ),
    sortValue: (creator) => creator.partnershipPeriodDays ?? null,
    align: 'right',
  },
  extension_days: {
    render: (creator) =>
      (creator.extensionDays ?? 0) === 0 ? (
        <TextCell value={null} />
      ) : (
        <span className="font-mono text-xs">{String(creator.extensionDays)}</span>
      ),
    sortValue: (creator) => creator.extensionDays ?? 0,
    align: 'right',
  },
  partnership_price_per_30_days: {
    render: (creator) => <MoneyCell value={creator.partnershipPricePer30Days} />,
    sortValue: (creator) => creator.partnershipPricePer30Days,
    align: 'right',
  },
  continue_working_with: {
    render: (creator) =>
      creator.continueWorkingWith === null || creator.continueWorkingWith === undefined ? (
        <TextCell value={null} />
      ) : (
        <BoolCell value={creator.continueWorkingWith} />
      ),
    align: 'center',
  },
  partnership_notes: { render: (creator) => <TextCell value={creator.partnershipNotes} /> },
  slack_notified: {
    render: (creator) => <BoolCell value={creator.slackNotified} />,
    align: 'center',
  },
  client_note: { render: (creator) => <TextCell value={creator.clientNote} /> },
};

export function UgcWorkspace({
  creators,
  partnerships,
  concepts,
  products,
  demo,
  initialTab,
  initialSearch,
  initialSelection,
  initialCollabs,
  initialView,
  initialVideos = [],
  uploadsEnabled = false,
  userViews,
  columns,
  unconfiguredColumns = false,
}: UgcWorkspaceProps) {
  const router = useRouter();
  // Label and order from the resolver, rendering from the registry, joined by the ONE adapter.
  const grid = useMemo(
    () => gridColumnsFrom(columns, CREATOR_RENDERERS, { freezeFirst: true, frozenMinWidth: 240 }),
    [columns],
  );
  /** Every column key the Fields popover can toggle, and its label, in resolved order (VIEWS-01). */
  const fieldKeys = useMemo(() => grid.columns.map((column) => column.key), [grid]);
  const fieldOptions = useMemo(
    () => grid.columns.map((column) => ({ key: column.key, label: column.header })),
    [grid],
  );
  const [tab, setTab] = useState<UgcTabKey>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [selection, setSelection] = useState<string | null>(initialSelection);

  const select = useCallback(
    (id: string | null) => {
      setSelection(id);
      syncUrl(tab, search, id);
    },
    [tab, search],
  );

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

  const pickTab = useCallback(
    (next: string) => {
      const chosen = UGC_TABS.find((entry) => entry.key === next)?.key ?? DEFAULT_TAB;
      setTab(chosen);
      syncUrl(chosen, search, selection);
    },
    [search, selection],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(tab, next, selection);
    },
    [tab, selection],
  );

  const adoptView = useCallback(
    (config: UserViewConfig) => {
      filter(config.filter);
    },
    [filter],
  );

  const tableView = useTableView({
    tableKey: 'creators',
    userId: userViews.userId,
    initialViews: userViews.views,
    defaultViewType: 'grid',
    initialViewType: initialView ?? null,
    fieldKeys,
    onActivate: adoptView,
  });
  const activeView = tableView.viewType;
  const setActiveView = tableView.setViewType;
  const onSearch = useCallback(
    (next: string) => {
      filter(next);
      tableView.setFilter(next);
    },
    [filter, tableView],
  );

  const clearSearch = useCallback(() => {
    onSearch('');
  }, [onSearch]);

  const query = search.trim().toLowerCase();
  const visibleCreators = useMemo(
    () => creators.filter((creator) => matchesQuery(creator.name, query)),
    [creators, query],
  );
  const visiblePartnerships = useMemo(
    () => partnerships.filter((row) => matchesQuery(row.name, query)),
    [partnerships, query],
  );

  /**
   * The view's field conditions applied once, here, so the grid, the board, the gallery and the
   * list all read the SAME narrowed row set (AI-32): `visibleCreators` already passed the search,
   * the grid sorts afterwards. With no conditions this is the same array back. The Partnership
   * Ads tab is a different dataset and deliberately not touched by a creators-table lens.
   */
  const filteredCreators = useMemo(
    () => applyFilters(visibleCreators, tableView.config.filters, grid.columns),
    [visibleCreators, grid, tableView.config.filters],
  );

  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return filteredCreators.map((creator) => ({
      id: creator.id,
      name: creator.name,
      groupValue: creator.internalCreatorStatus,
      subtitle: identityLine(creator) || undefined,
    }));
  }, [filteredCreators]);

  const kanbanColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const item of kanbanItems) {
      if (item.groupValue !== '') seen.add(item.groupValue);
    }
    return [...seen];
  }, [kanbanItems]);

  const kanbanLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const col of kanbanColumns) {
      labels[col] = col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return labels;
  }, [kanbanColumns]);

  /** The list rows wear the creator's INTERNAL status — the same track the board groups by. */
  const listChips = useMemo(() => {
    const chips: Record<string, ListChip> = {};
    for (const creator of filteredCreators) {
      const entry = creatorTracks(creator).find((candidate) => candidate.key === 'internal');
      if (entry !== undefined) chips[creator.id] = { label: entry.statusLabel, tone: entry.tone };
    }
    return chips;
  }, [filteredCreators]);

  /**
   * The cover columns a viewer may pick between here (action item 16): the two media columns the
   * creators capability declares, narrowed to the ones this brand actually resolves and labelled
   * with the brand's own labels. `profile_pic_url` is in the resolved COLUMN SET but has no grid
   * renderer (it draws inside the frozen name cell), which is exactly why the options come from
   * `columns` rather than from `grid.columns`.
   */
  const coverFields = useMemo(
    () => coverFieldOptions(columns, CREATORS_CAP.galleryFields),
    [columns],
  );

  // The card image is the creator's profile picture by default (Sprint 7 gallery) and whichever
  // media column the viewer chose when they have chosen one; a creator with neither shows their
  // initials rather than a broken image.
  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(
        filteredCreators,
        grid.columns,
        (creator) => ({
          id: creator.id,
          name: creator.name,
          imageUrl: creator.profilePicUrl,
          subtitle: identityLine(creator) || undefined,
          covers: {
            profile_pic_url: { url: creator.profilePicUrl, mediaType: 'image' },
            video_intro_url: { url: creator.videoIntroUrl, mediaType: 'video' },
          },
        }),
        {
          coverField: tableView.config.coverField,
          fieldOrder: tableView.config.fieldOrder,
        },
      ),
    [filteredCreators, grid.columns, tableView.config.coverField, tableView.config.fieldOrder],
  );

  const handleKanbanMove = useCallback(() => {
    // will be wired to updateCreatorAction in a follow-up
  }, []);

  const narrowed = query !== '';
  /**
   * The creators tab is narrowed by the search OR by the view's field filters (AI-32): the count
   * line and the empty state must tell the truth about either. The Partnership Ads tab only has
   * the search — a creators-table lens does not reach it — so it keeps the query test alone.
   */
  const creatorsNarrowed = narrowed || filteredCreators.length !== creators.length;
  const count =
    tab === 'creators'
      ? creatorsNarrowed
        ? filteredCountLabel(filteredCreators.length, creatorCountLabel(creators.length))
        : creatorCountLabel(creators.length)
      : narrowed
        ? filteredCountLabel(visiblePartnerships.length, partnershipCountLabel(partnerships.length))
        : partnershipCountLabel(partnerships.length);

  const open = creators.find((c) => c.id === selection) ?? null;

  const newCreator = (
    <DisabledWrite active hint={demo ? DEMO_WRITE_HINT : NEW_CREATOR_SOON_HINT}>
      <Button size="sm" disabled className={disabledWriteClassName} data-slot="new-creator">
        New creator
      </Button>
    </DisabledWrite>
  );

  const emptyPanel = (slot: string, note: string, isNarrowed: boolean) => (
    <div
      data-slot={slot}
      className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
    >
      <p className="text-sm text-text2">{isNarrowed ? NO_MATCH_NOTE : note}</p>
      {isNarrowed ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSearch}
          data-slot="clear-search"
        >
          Clear search
        </Button>
      ) : (
        newCreator
      )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">UGC Management</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">UGC Management</h1>
          {newCreator}
        </div>
        <p className="text-sm text-text2">
          <span data-slot="ugc-count">{count}</span> — the creators we hire, and the handles we are
          whitelisted to run ads from.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={pickTab}
        data-slot="ugc-tabs"
        className="flex min-w-0 flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            {UGC_TABS.map((entry) => (
              <TabsTrigger key={entry.key} value={entry.key} data-tab={entry.key}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
            }}
            placeholder="Search creators"
            aria-label="Search creators by name"
            data-slot="ugc-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <TabsContent value="creators" className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <ViewToolbar
              tableKey="creators"
              supportedViews={[...CREATORS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="internalCreatorStatus"
              views={tableView.views}
              activeViewId={tableView.activeView?.id ?? null}
              onActivateView={tableView.activateView}
              onCreateView={tableView.createView}
              onRenameView={tableView.renameView}
              onDeleteView={tableView.deleteView}
              fields={fieldOptions}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              viewConfig={tableView.config}
              onFreezeChange={tableView.setFrozenFields}
              onMoveField={tableView.moveField}
              onFiltersChange={tableView.setFilters}
              onGroupChange={tableView.setGroupBy}
              coverFields={coverFields}
              onCoverChange={tableView.setCoverField}
              error={tableView.error}
            />
          </div>
          <ColumnNotices
            slotPrefix="creator"
            unconfigured={unconfiguredColumns}
            missing={grid.missing}
            registryName="CREATOR_RENDERERS in ugc-workspace.tsx"
          />
          {filteredCreators.length === 0 ? (
            emptyPanel('creators-empty', NO_CREATORS_NOTE, creatorsNarrowed)
          ) : activeView === 'kanban' ? (
            <KanbanBoard
              items={kanbanItems}
              columns={kanbanColumns}
              columnLabels={kanbanLabels}
              onMove={handleKanbanMove}
              demo={demo}
            />
          ) : activeView === 'gallery' ? (
            <GalleryView
              items={galleryItems}
              visibleFields={tableView.config.visibleFields}
              selectedId={selection}
              cardSlot="creator-gallery-card"
              onItemClick={(item) => {
                select(item.id);
              }}
            />
          ) : activeView === 'list' ? (
            <ListView
              items={galleryItems}
              visibleFields={tableView.config.visibleFields}
              selectedId={selection}
              rowSlot="creator-list-row"
              chips={listChips}
              onItemClick={(item) => {
                select(item.id);
              }}
            />
          ) : (
            <AirtableGrid
              tableKey="creators"
              view={tableView.config}
              onSortChange={tableView.setSort}
              columns={grid.columns}
              rows={filteredCreators}
              rowId={(creator) => creator.id}
              rowLabel={(creator) => creator.name}
              rowAttributes={(creator) => ({ 'data-creator-id': creator.id })}
              selectedId={selection}
              onRowClick={(creator) => {
                select(creator.id);
              }}
              tableSlot="creators-table"
              rowSlot="creator-row"
            />
          )}
        </TabsContent>

        <TabsContent value="partnerships" className="flex min-w-0 flex-col gap-4">
          {visiblePartnerships.length === 0 ? (
            emptyPanel('partnerships-empty', NO_PARTNERSHIPS_NOTE, narrowed)
          ) : (
            <PartnershipTable rows={visiblePartnerships} />
          )}
        </TabsContent>
      </Tabs>

      {open !== null ? (
        <CreatorPanel
          key={selection}
          creator={open}
          concepts={concepts}
          products={products}
          collabs={initialCollabs}
          videos={initialVideos}
          uploadsEnabled={uploadsEnabled}
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
