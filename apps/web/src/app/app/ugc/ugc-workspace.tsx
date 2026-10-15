'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RegistryBrandHistoryRow } from '@tas/db';
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
  clientApprovalLabel,
  clientApprovalTone,
  CREATOR_INTERNAL_STATUS,
  CREATOR_STATUS,
} from '@tas/domain/state';

import {
  GridSelectionOverlay,
  GroupSortableContext,
  KanbanBoard,
  ListView,
  type KanbanItem,
  type ListChip,
  type SelectionStatusTrack,
  coverFieldOptions,
  SortableGroupHeader,
  useGridSelection,
  useGroupOrder,
  useGroupOrderIo,
  useTableView,
  ViewToolbar,
  galleryItemsFrom,
} from '@/components/views';
import { ColumnNotices } from '@/components/views';
import { AirtableGrid } from '@/components/views/airtable-grid';
import { applyFilters, groupableFields, groupRows } from '@/components/views/airtable-grid-logic';
import {
  gridColumnsFrom,
  type ColumnRegistry,
  type ResolvedColumnView,
} from '@/components/views/resolved-columns';
import type { UserViewConfig } from '@tas/domain';
import type { UserViewsResult } from '@/lib/user-view-actions';
import {
  BoolCell,
  booleanGroupLabel,
  ChipCell,
  ChipListCell,
  CountCell,
  DateCell,
  LinkCell,
  MoneyCell,
  statusGroupHeader,
  TextCell,
} from '@/components/views/grid-cells';
import { ageBracketLabel, creatorPlatformLabel } from '@tas/domain/creators';
import { clientStatusRequiresNote } from '@/lib/client-status-vocabulary';
import { ugcPath } from '@/lib/routes';

import { bulkMoveCreatorsAction, deleteCreatorsAction } from './bulk-actions';
import { CreatorGalleryCard, type CreatorAssetThumb } from './creator-gallery-card';
import { CreatorPanel, type CreatorVideo, type LinkOption } from './creator-panel';
import { CreatorPool } from './creator-pool';
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
  /** Assets grouped by creatorId, for the gallery card's 2x2 thumbnail grid and count badge. */
  readonly creatorAssets?: Readonly<Record<string, readonly CreatorAssetThumb[]>>;
  /** The current brand's display name, shown in "Add to {brandName}" on the Creator Pool tab. */
  readonly brandName?: string;
  /** Agency admin only: whether the panel's performance rating is editable (Oct 8 Talal ask). */
  readonly canRate?: boolean;
  /** The request's one clock, for the rating receipt's "3 days ago"; never a component's own. */
  readonly now: Date;
  /**
   * The OTHER brands the open creator's registry row is in — the two-way link to the Creator Pool
   * (Ticket 13 Phase B1, PRD §5.8, Oct 8 Talal sync). Empty when the open row has no registry link
   * yet or no selection is open. The current brand is never in this list (the page filters it out).
   */
  readonly otherBrands?: readonly { readonly brandId: string; readonly brandName: string }[];
  /**
   * The full brand history for the open creator (Ticket 14 Phase B1). The page preloads it via
   * `loadRegistryBrandHistory`; the panel's own timeline reads it as-is. Empty when no creator is
   * open or when the open row has no registry link.
   */
  readonly brandHistory?: readonly RegistryBrandHistoryRow[];
}

/** The grid selection's row identity, module-level so the hook's prune effect keeps one function. */
const creatorRowId = (creator: CreatorCardRow): string => creator.id;
const creatorRowLabel = (creator: CreatorCardRow): string => creator.name;

/**
 * The bulk Change-status picker's TWO tracks (lead's Ticket 8 answer 5): the internal review and
 * the client-facing creator track, each over its own domain vocabulary so the picker cannot drift
 * from what the Server Action re-checks. The client track leaves out its note-required keys
 * (`revisions_needed`, `disapproved` — the Oct 6 Talal ruling): a bulk move has no per-row reason
 * to store, so those are set one creator at a time through the panel, and the action refuses them
 * server-side either way.
 */
const STATUS_TRACKS: readonly SelectionStatusTrack[] = [
  {
    key: 'internalCreatorStatus',
    label: 'Internal Status',
    options: CREATOR_INTERNAL_STATUS.map(({ key, label }) => ({ key, label })),
  },
  {
    key: 'clientStatus',
    label: 'Client Status',
    options: CREATOR_STATUS.filter((entry) => !clientStatusRequiresNote('creators', entry.key)).map(
      ({ key, label }) => ({ key, label }),
    ),
  },
];

/** What a bulk delete means here (lead's Ticket 8 ruling: linked rows keep their reference). */
const DELETE_DETAIL =
  'Linked collaborations and concepts keep their creator reference and go nameless; nothing is erased.';

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
    groupHeader: statusGroupHeader,
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

export const CREATOR_RENDERERS: ColumnRegistry<CreatorCardRow> = {
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
  // The client's approval of the creator in the one client vocabulary (item 5c): seeded "Client
  // Approval", drawn here like Concepts and Copywriting draw theirs; `client_status` above is the
  // creator track's own vocabulary, not this (AUDIT-13).
  client_approval_status: {
    render: (creator) => (
      <ChipCell
        chip={
          creator.clientApprovalStatus === null || creator.clientApprovalStatus === undefined
            ? null
            : {
                label: clientApprovalLabel(creator.clientApprovalStatus),
                tone: clientApprovalTone(creator.clientApprovalStatus),
              }
        }
      />
    ),
    sortValue: (creator) =>
      creator.clientApprovalStatus === null || creator.clientApprovalStatus === undefined
        ? ''
        : clientApprovalLabel(creator.clientApprovalStatus),
    groupHeader: statusGroupHeader,
  },
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
    groupLabel: booleanGroupLabel,
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
    // The cell reads the stored key, so the group is headed by the chip's label, not `not_active`.
    groupLabel: (key) => partnershipActivityChip(key).label,
    groupHeader: statusGroupHeader,
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
  creatorAssets = {},
  brandName = 'this brand',
  canRate = false,
  now,
  otherBrands = [],
  brandHistory = [],
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
  /** The columns the grid can bucket under — the Group popover offers these alone (Ticket 7). */
  const groupFields = useMemo(() => groupableFields(grid.columns), [grid]);
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

  /**
   * Phase B5 commit 3 — per-user group ordering, wired for the UGC Creator Pool TABLE view (the
   * grid under the Creators tab; the pool-tab card list is a separate component and intentionally
   * untouched). The DAO scope is the live `creators` table keyed by the active column key
   * (`internal_creator_status`, `client_status`, `client_approval_status` for the status columns)
   * and the viewer's active user view id. The controller resolves the status-enum default order
   * through `statusEnumOrderFor`; non-status columns fall back to alpha.
   */
  const groupByField = tableView.config.groupBy;
  const groupViewId = tableView.activeView?.id ?? null;
  const naturalGroupOrder = useMemo<readonly string[]>(() => {
    if (groupByField === null) return [];
    const groups = groupRows(filteredCreators, groupByField, grid.columns);
    return groups === null ? [] : groups.map((entry) => entry.value);
  }, [filteredCreators, grid, groupByField]);
  const [groupOrderNotice, setGroupOrderNotice] = useState<string | null>(null);
  const groupOrderIo = useGroupOrderIo(
    { tableKey: 'creators', fieldKey: groupByField ?? '', viewId: groupViewId },
    { demo },
  );
  const groupOrderController = useGroupOrder({
    fieldKey: groupByField ?? '',
    naturalOrder: naturalGroupOrder,
    io: groupOrderIo,
    onError: setGroupOrderNotice,
  });

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  /** A confirmed delete that took the open row with it closes the panel instead of 404-ing it. */
  const onDeleted = useCallback(
    (ids: readonly string[]) => {
      if (selection !== null && ids.includes(selection)) select(null);
    },
    [select, selection],
  );

  /** "Copy link" carries the absolute URL a refresh reopens: the creators tab with the panel. */
  const linkFor = useCallback(
    (id: string) => `${window.location.origin}${ugcPath}?tab=creators&creator=${id}`,
    [],
  );

  /**
   * Multi-select + right-click (Ticket 8), on the CREATORS GRID ALONE: the shared hook over the
   * SAME narrowed rows the grid draws, so select-all never ticks a filtered-off row. Delete and
   * Change status (both tracks) are the two bulk Server Actions; Open is the row click's own
   * `select`, Copy link writes nothing. No Duplicate: creator names are typed, not
   * formula-generated (PRD §7). The Partnership Ads table and the Creator Pool are not grids.
   */
  const gridSelection = useGridSelection<CreatorCardRow>({
    // Sheet parity (Ticket 8 review): prune only on real row-set changes (deletes, server
    // refreshes), never on local search typing — so a selection the user ticked survives a filter.
    rows: creators,
    rowId: creatorRowId,
    rowLabel: creatorRowLabel,
    demo,
    noun: 'creator',
    linkFor,
    open: { label: 'Open', onOpen: select },
    remove: { detail: DELETE_DETAIL, run: deleteCreatorsAction, onDeleted },
    status: { tracks: STATUS_TRACKS, run: bulkMoveCreatorsAction },
    refresh,
  });

  // Leaving the creators tab clears the selection: the bar belongs to that grid and must not
  // float over Partnership Ads or the Creator Pool.
  const { clearSelection } = gridSelection;
  useEffect(() => {
    if (tab !== 'creators') clearSelection();
  }, [tab, clearSelection]);

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
              groupFields={groupFields}
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
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              data-slot="creator-gallery-view"
            >
              {filteredCreators.map((creator) => (
                <CreatorGalleryCard
                  key={creator.id}
                  creator={creator}
                  assets={creatorAssets[creator.id] ?? []}
                  selected={creator.id === selection}
                  onClick={() => {
                    select(creator.id);
                  }}
                />
              ))}
            </div>
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
            <GroupSortableContext
              orderedValues={groupOrderController.orderedValues}
              onReorder={groupOrderController.reorder}
            >
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
                groupOrder={groupByField === null ? undefined : groupOrderController.orderedValues}
                onGroupContextMenu={
                  groupByField === null ? undefined : groupOrderController.openContextMenu
                }
                renderGroupHeader={
                  groupByField === null
                    ? undefined
                    : ({ value, label, count }) => (
                        <SortableGroupHeader
                          value={value}
                          label={label}
                          count={count}
                          pinned={
                            groupOrderController.saved?.some(
                              (entry) => entry.value === value && entry.pinned,
                            ) ?? false
                          }
                        />
                      )
                }
                {...gridSelection.gridProps}
              />
              {groupOrderController.menu}
              {groupOrderNotice === null ? null : (
                <p className="text-xs text-bad" role="alert" data-slot="ugc-group-order-error">
                  {groupOrderNotice}
                </p>
              )}
            </GroupSortableContext>
          )}
        </TabsContent>

        <TabsContent value="partnerships" className="flex min-w-0 flex-col gap-4">
          {visiblePartnerships.length === 0 ? (
            emptyPanel('partnerships-empty', NO_PARTNERSHIPS_NOTE, narrowed)
          ) : (
            <PartnershipTable rows={visiblePartnerships} />
          )}
        </TabsContent>

        <TabsContent value="pool" className="flex min-w-0 flex-col gap-4">
          <CreatorPool
            brandName={brandName}
            demo={demo}
            onAdded={() => {
              router.refresh();
            }}
          />
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
          canRate={canRate}
          now={now}
          otherBrands={otherBrands}
          brandHistory={brandHistory}
          onClose={close}
          onSaved={saved}
        />
      ) : null}

      <GridSelectionOverlay state={gridSelection} noun="creator" />
    </div>
  );
}
