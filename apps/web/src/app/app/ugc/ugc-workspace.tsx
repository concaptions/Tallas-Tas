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
  ViewSwitcher,
  KanbanBoard,
  GalleryView,
  type KanbanItem,
  type GalleryItem,
} from '@/components/views';
import { CreatorCard } from './creator-card';
import { CreatorPanel, type LinkOption } from './creator-panel';
import { PartnershipTable } from './partnership-table';
import {
  creatorCountLabel,
  DEFAULT_TAB,
  filteredCountLabel,
  identityLine,
  matchesQuery,
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
}: UgcWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<UgcTabKey>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [selection, setSelection] = useState<string | null>(initialSelection);
  const [activeView, setActiveView] = useState<ViewType>(initialView ?? 'grid');

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

  const clearSearch = useCallback(() => {
    filter('');
  }, [filter]);

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

  const galleryItems: readonly GalleryItem[] = useMemo(() => {
    return visibleCreators
      .filter((c) => c.profilePicUrl !== null || c.videoIntroUrl !== null)
      .map((creator) => ({
        id: creator.id,
        name: creator.name,
        imageUrl: creator.profilePicUrl ?? creator.videoIntroUrl,
        mediaType:
          creator.videoIntroUrl !== null && creator.profilePicUrl === null ? 'video' : 'image',
        subtitle: identityLine(creator) || undefined,
      }));
  }, [visibleCreators]);

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
              filter(event.target.value);
            }}
            placeholder="Search creators"
            aria-label="Search creators by name"
            data-slot="ugc-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <TabsContent value="creators" className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <ViewSwitcher
              tableKey="creators"
              supportedViews={[...CREATORS_CAP.supportedViews]}
              activeView={activeView}
              onViewChange={setActiveView}
              kanbanGroupByField="internalCreatorStatus"
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
            <GalleryView items={galleryItems} />
          ) : (
            <div
              data-slot="creator-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {visibleCreators.map((creator) => (
                <CreatorCard
                  key={creator.id}
                  creator={creator}
                  selected={creator.id === selection}
                  onClick={() => {
                    select(creator.id);
                  }}
                />
              ))}
            </div>
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
          demo={demo}
          onClose={close}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}
