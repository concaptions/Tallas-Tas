'use client';

import { useCallback, useMemo, useState } from 'react';
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

import { CreatorCard } from './creator-card';
import { PartnershipTable } from './partnership-table';
import {
  creatorCountLabel,
  DEFAULT_TAB,
  filteredCountLabel,
  matchesQuery,
  NEW_CREATOR_SOON_HINT,
  NO_CREATORS_NOTE,
  NO_MATCH_NOTE,
  NO_PARTNERSHIPS_NOTE,
  partnershipCountLabel,
  SEARCH_PARAM,
  TAB_PARAM,
  UGC_TABS,
  type CreatorCardRow,
  type PartnershipRow,
  type UgcTabKey,
} from './fields';

/**
 * UGC Management (PRD §5.8 and §5.8.1): the creator roster and the whitelisting partnerships struck
 * with a few of them, as two tabs and nothing else.
 *
 * TWO TABS, ONE READ. The page loaded both lists in a single call, so switching is instant and
 * neither half re-queries; the tab is only which one is on screen. Both pieces of state are
 * URL-backed exactly as the Themes grid does it — `?tab=` and `?q=`, written with the History API —
 * so a link opens the right tab with the right search and a reload restores both.
 *
 * ONE SEARCH, BOTH TABS. `?q=` reads creator names, which is the one thing both halves have in
 * common and the only way the empty state is reachable on either: filtering to nothing says so in
 * words and offers to clear the search, so neither tab is ever a blank rectangle.
 *
 * NOTHING IS RESOLVED HERE. Statuses, tones, countdowns and the near-expiry highlight were all
 * resolved on the server against the single `now` the page read; this component filters an array
 * and renders what it was handed. It holds no clock and compares no status to a literal.
 */
export interface UgcWorkspaceProps {
  readonly creators: readonly CreatorCardRow[];
  readonly partnerships: readonly PartnershipRow[];
  readonly demo: boolean;
  /** The `?tab=` the page was opened with, already narrowed to the known vocabulary. */
  readonly initialTab: UgcTabKey;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
}

/**
 * Writes both page parameters without a server round trip; Next.js reads the History API back.
 * A parameter at its default is removed rather than written, so a clean view leaves a clean URL —
 * except `tab`, which is written even for the default so that switching back to Creators is as
 * shareable as switching away from it.
 */
function syncUrl(tab: UgcTabKey, search: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(TAB_PARAM, tab);
  if (search.trim() === '') {
    url.searchParams.delete(SEARCH_PARAM);
  } else {
    url.searchParams.set(SEARCH_PARAM, search);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

export function UgcWorkspace({
  creators,
  partnerships,
  demo,
  initialTab,
  initialSearch,
}: UgcWorkspaceProps) {
  const [tab, setTab] = useState<UgcTabKey>(initialTab);
  const [search, setSearch] = useState(initialSearch);

  const pickTab = useCallback(
    (next: string) => {
      const chosen = UGC_TABS.find((entry) => entry.key === next)?.key ?? DEFAULT_TAB;
      setTab(chosen);
      syncUrl(chosen, search);
    },
    [search],
  );

  const filter = useCallback(
    (next: string) => {
      setSearch(next);
      syncUrl(tab, next);
    },
    [tab],
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

  const narrowed = query !== '';
  const count =
    tab === 'creators'
      ? narrowed
        ? filteredCountLabel(visibleCreators.length, creatorCountLabel(creators.length))
        : creatorCountLabel(creators.length)
      : narrowed
        ? filteredCountLabel(visiblePartnerships.length, partnershipCountLabel(partnerships.length))
        : partnershipCountLabel(partnerships.length);

  /**
   * "New creator" is a write. In demo mode it carries the standard reason; in live mode it carries
   * its own, because the intake form is a later ticket and the button would have nothing to submit.
   * Either way it is wrapped in `DisabledWrite` so the disabled control can still explain itself.
   */
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
          {visibleCreators.length === 0 ? (
            emptyPanel('creators-empty', NO_CREATORS_NOTE)
          ) : (
            <div
              data-slot="creator-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {visibleCreators.map((creator) => (
                <CreatorCard key={creator.id} creator={creator} />
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
    </div>
  );
}
