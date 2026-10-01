'use client';

import { useCallback, useMemo, useState } from 'react';
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
  type KanbanItem,
  useTableView,
  ViewToolbar,
  galleryItemsFrom,
} from '@/components/views';
import { AirtableGrid, type GridColumn } from '@/components/views/airtable-grid';
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

/**
 * The Airtable-style grid columns for UGC creators: the frozen name cell carries the avatar (the
 * profile picture, or initials on `bg-surface3` when there is none — never a broken image), then
 * the three labelled status tracks and every other stored column of `creators`, in the panel's
 * order. Costs and payments are internal figures (CLAUDE.md non-negotiable 10); this grid is the
 * team workspace, never the client interface.
 */
const CREATOR_COLUMNS: readonly GridColumn<CreatorCardRow>[] = [
  {
    key: 'name',
    header: 'Name',
    frozen: true,
    minWidth: 240,
    sortValue: (creator) => creator.name,
    render: (creator) => (
      <span className="flex items-center gap-2">
        {creator.profilePicUrl === null ? (
          <span
            data-slot="creator-avatar"
            data-fallback="initials"
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-card border border-line bg-surface3 font-mono text-[10px] text-text3"
          >
            {creatorInitials(creator.name)}
          </span>
        ) : (
          <img
            data-slot="creator-avatar"
            src={creator.profilePicUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-card border border-line bg-surface3 object-cover"
          />
        )}
        <span className="font-medium" data-slot="creator-name">
          {creator.name}
        </span>
      </span>
    ),
  },
  ...creatorTracks({
    internalCreatorStatus: '',
    clientStatus: '',
    internalAssetsStatus: '',
  }).map((track): GridColumn<CreatorCardRow> => ({
    key: `status-${track.key}`,
    header: `${track.label} Status`,
    sortValue: (creator) =>
      creatorTracks(creator).find((entry) => entry.key === track.key)?.statusLabel ?? null,
    render: (creator) => {
      const entry = creatorTracks(creator).find((candidate) => candidate.key === track.key);
      return (
        <span data-slot="creator-track" data-track={track.key}>
          <ChipCell
            chip={entry === undefined ? null : { label: entry.statusLabel, tone: entry.tone }}
          />
        </span>
      );
    },
  })),
  {
    key: 'gender',
    header: 'Gender',
    sortValue: (creator) => creator.gender,
    render: (creator) => <TextCell value={creator.gender} />,
  },
  {
    key: 'ageBracket',
    header: 'Age Bracket',
    sortValue: (creator) => creator.ageBracket,
    render: (creator) =>
      creator.ageBracket === null || creator.ageBracket === '' ? (
        <TextCell value={null} />
      ) : (
        <span data-slot="creator-identity">{ageBracketLabel(creator.ageBracket)}</span>
      ),
  },
  {
    key: 'ethnicity',
    header: 'Ethnicity',
    render: (creator) => <TextCell value={creator.ethnicity} />,
  },
  {
    key: 'platform',
    header: 'Platform',
    render: (creator) => (
      <ChipListCell
        chips={creator.platform.map((entry) => ({
          label: creatorPlatformLabel(entry),
          tone: 'mute',
        }))}
      />
    ),
  },
  {
    key: 'creatorLink',
    header: 'Creator Link',
    render: (creator) => <LinkCell value={creator.creatorLink} />,
  },
  {
    key: 'instagramUsername',
    header: 'Instagram Username',
    sortValue: (creator) => creator.instagramUsername ?? null,
    render: (creator) => <TextCell value={creator.instagramUsername} mono />,
  },
  {
    key: 'facebookProfileUrl',
    header: 'Facebook Profile',
    render: (creator) => <LinkCell value={creator.facebookProfileUrl} />,
  },
  {
    key: 'concepts',
    header: 'Linked Concepts',
    sortValue: (creator) => creator.conceptIds.length,
    render: (creator) => <CountCell count={creator.conceptIds.length} noun="concept" />,
  },
  {
    key: 'products',
    header: 'Linked Products',
    sortValue: (creator) => creator.productIds.length,
    render: (creator) => <CountCell count={creator.productIds.length} noun="product" />,
  },
  {
    key: 'internalBrief',
    header: 'Internal Brief',
    render: (creator) => <TextCell value={creator.internalBrief} />,
  },
  {
    key: 'clientNote',
    header: "Client's Note",
    render: (creator) => <TextCell value={creator.clientNote} />,
  },
  {
    key: 'creatorInfoRequest',
    header: 'Creator Info Request',
    render: (creator) => <TextCell value={creator.creatorInfoRequest} />,
  },
  {
    key: 'rawAssetsUrl',
    header: 'Raw Assets URL',
    render: (creator) => <LinkCell value={creator.rawAssetsUrl} />,
  },
  {
    key: 'videoIntroUrl',
    header: 'Video Intro',
    render: (creator) => <LinkCell value={creator.videoIntroUrl} />,
  },
  {
    key: 'shippingLocation',
    header: 'Shipping Location',
    render: (creator) => <TextCell value={creator.shippingLocation} />,
  },
  {
    key: 'trackingNumber',
    header: 'Tracking Number',
    render: (creator) => <TextCell value={creator.trackingNumber} mono />,
  },
  {
    key: 'dateOfManagement',
    header: 'Date of Management',
    sortValue: (creator) => creator.dateOfManagement?.toISOString() ?? null,
    render: (creator) => <DateCell value={creator.dateOfManagement} />,
  },
  {
    key: 'budgetPer60s',
    header: 'Budget per 60sec Video',
    align: 'right',
    sortValue: (creator) => creator.budgetPer60s ?? null,
    render: (creator) => <MoneyCell value={creator.budgetPer60s} />,
  },
  {
    key: 'creatorCost',
    header: 'Creator Cost (USD)',
    align: 'right',
    sortValue: (creator) => creator.creatorCost ?? null,
    render: (creator) => <MoneyCell value={creator.creatorCost} />,
  },
  {
    key: 'costUsd',
    header: 'Paid by TAS (USD)',
    align: 'right',
    sortValue: (creator) => creator.costUsd,
    render: (creator) => <MoneyCell value={creator.costUsd} />,
  },
  {
    key: 'paymentDate',
    header: 'Payment Date',
    sortValue: (creator) => creator.paymentDate?.toISOString() ?? null,
    render: (creator) => <DateCell value={creator.paymentDate} />,
  },
  {
    key: 'partnershipActivity',
    header: 'Partnership Activity',
    sortValue: (creator) => creator.partnershipActivity ?? null,
    render: (creator) => {
      const chip = partnershipActivityChip(creator.partnershipActivity);
      return <ChipCell chip={chip.key === '' ? null : { label: chip.label, tone: chip.tone }} />;
    },
  },
  {
    key: 'partnershipActivatedAt',
    header: 'Date of Partnership Activation',
    sortValue: (creator) => creator.partnershipActivatedAt?.toISOString() ?? null,
    render: (creator) => <DateCell value={creator.partnershipActivatedAt} />,
  },
  {
    key: 'partnershipPeriodDays',
    header: 'Partnership Period (days)',
    align: 'right',
    sortValue: (creator) => creator.partnershipPeriodDays ?? null,
    render: (creator) =>
      creator.partnershipPeriodDays === null || creator.partnershipPeriodDays === undefined ? (
        <TextCell value={null} />
      ) : (
        <span className="font-mono text-xs">{String(creator.partnershipPeriodDays)}</span>
      ),
  },
  {
    key: 'extensionDays',
    header: 'Extension (days)',
    align: 'right',
    sortValue: (creator) => creator.extensionDays ?? 0,
    render: (creator) =>
      (creator.extensionDays ?? 0) === 0 ? (
        <TextCell value={null} />
      ) : (
        <span className="font-mono text-xs">{String(creator.extensionDays)}</span>
      ),
  },
  {
    key: 'partnershipPricePer30Days',
    header: 'Partnership Price per 30 Days',
    align: 'right',
    sortValue: (creator) => creator.partnershipPricePer30Days,
    render: (creator) => <MoneyCell value={creator.partnershipPricePer30Days} />,
  },
  {
    key: 'continueWorkingWith',
    header: 'Continue Working With?',
    align: 'center',
    render: (creator) =>
      creator.continueWorkingWith === null || creator.continueWorkingWith === undefined ? (
        <TextCell value={null} />
      ) : (
        <BoolCell value={creator.continueWorkingWith} />
      ),
  },
  {
    key: 'partnershipNotes',
    header: 'Partnership Notes',
    render: (creator) => <TextCell value={creator.partnershipNotes} />,
  },
  {
    key: 'slackNotified',
    header: 'Slack Notified',
    align: 'center',
    render: (creator) => <BoolCell value={creator.slackNotified} />,
  },
];

/** Every column key the Fields popover can toggle, and its label, in grid order (VIEWS-01). */
const FIELD_KEYS: readonly string[] = CREATOR_COLUMNS.map((column) => column.key);
const FIELD_OPTIONS = CREATOR_COLUMNS.map((column) => ({ key: column.key, label: column.header }));

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
}: UgcWorkspaceProps) {
  const router = useRouter();
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
    fieldKeys: FIELD_KEYS,
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

  const kanbanItems: readonly KanbanItem[] = useMemo(() => {
    return visibleCreators.map((creator) => ({
      id: creator.id,
      name: creator.name,
      groupValue: creator.internalCreatorStatus,
      subtitle: identityLine(creator) || undefined,
    }));
  }, [visibleCreators]);

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

  // The card image is the creator's profile picture (Sprint 7 gallery); none shows their initials.
  const galleryItems = useMemo(
    () =>
      galleryItemsFrom(visibleCreators, CREATOR_COLUMNS, (creator) => ({
        id: creator.id,
        name: creator.name,
        imageUrl: creator.profilePicUrl,
        subtitle: identityLine(creator) || undefined,
      })),
    [visibleCreators],
  );

  const handleKanbanMove = useCallback(() => {
    // will be wired to updateCreatorAction in a follow-up
  }, []);

  const narrowed = query !== '';
  const count =
    tab === 'creators'
      ? narrowed
        ? filteredCountLabel(visibleCreators.length, creatorCountLabel(creators.length))
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

  const emptyPanel = (slot: string, note: string) => (
    <div
      data-slot={slot}
      className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-4 py-10 text-center"
    >
      <p className="text-sm text-text2">{narrowed ? NO_MATCH_NOTE : note}</p>
      {narrowed ? (
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
              fields={FIELD_OPTIONS}
              isFieldVisible={tableView.isFieldVisible}
              onToggleField={tableView.toggleField}
              error={tableView.error}
            />
          </div>
          {visibleCreators.length === 0 ? (
            emptyPanel('creators-empty', NO_CREATORS_NOTE)
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
          ) : (
            <AirtableGrid
              tableKey="creators"
              view={tableView.config}
              onSortChange={tableView.setSort}
              columns={CREATOR_COLUMNS}
              rows={visibleCreators}
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
            emptyPanel('partnerships-empty', NO_PARTNERSHIPS_NOTE)
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
