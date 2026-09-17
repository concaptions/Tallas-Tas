'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  Input,
  SoonChip,
  disabledWriteClassName,
} from '@tas/ui';

import {
  INVITE_SOON_HINT,
  TEAM_ACCESS_ENFORCEMENT_NOTE,
  TEAM_ACCESS_NOTE,
  teamCountLabel,
  type TeamItem,
} from './fields';
import { TeamTable } from './team-table';

/**
 * The Team roster and its one header action (PRD §11, §3).
 *
 * No panel and no row click: the only interactive thing on the page is the filter, which is
 * URL-backed in `?q=` exactly as the Products table's is. That is deliberate — it makes "here is
 * everyone on Gratsi" and "here are the video editors" links you can paste into Slack, a refresh
 * keeps the rows you had narrowed to, and it is also the only way to reach the empty state, which
 * says so in words and offers the way out.
 *
 * `demo` decides which sentence the access note ends with and which tooltip the disabled Invite
 * button carries. It never decides whether the page renders: that is `canSeeTeamPage`, on the
 * server, in `page.tsx`.
 */
export interface TeamWorkspaceProps {
  readonly items: readonly TeamItem[];
  readonly demo: boolean;
  /** The `?q=` filter the page was opened with; `''` when there is none. */
  readonly initialSearch: string;
  /** The extra sentence demo mode appends to the access note, or null in live mode. */
  readonly demoAccessNote: string | null;
}

/**
 * Writes the filter to the URL without a server round trip; Next.js reads the History API back.
 * An empty value is removed rather than written as `?q=`, so a cleared filter leaves a clean URL.
 */
function syncUrl(value: string): void {
  const url = new URL(window.location.href);
  if (value.trim() === '') {
    url.searchParams.delete('q');
  } else {
    url.searchParams.set('q', value);
  }
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

/**
 * The Invite member button (criterion 8). Disabled in BOTH modes and honest about why in each: in
 * demo mode there is no session to write with, and in live mode the action behind it records an
 * intent and sends nothing, so the control carries a `SoonChip` instead of pretending to work.
 */
function InviteMember({ demo, slot }: { demo: boolean; slot: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <DisabledWrite hint={demo ? DEMO_WRITE_HINT : INVITE_SOON_HINT}>
        <Button
          type="button"
          size="sm"
          disabled
          className={disabledWriteClassName}
          data-slot={slot}
        >
          Invite member
        </Button>
      </DisabledWrite>
      {demo ? null : <SoonChip />}
    </span>
  );
}

export function TeamWorkspace({ items, demo, initialSearch, demoAccessNote }: TeamWorkspaceProps) {
  const [search, setSearch] = useState(initialSearch);

  const filter = useCallback((next: string) => {
    setSearch(next);
    syncUrl(next);
  }, []);

  const term = search.trim();
  const query = term.toLowerCase();
  const visible = useMemo(
    () => (query === '' ? items : items.filter((item) => item.search.includes(query))),
    [items, query],
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">Team</h1>
          <InviteMember demo={demo} slot="invite-member" />
        </div>
        <p className="text-sm text-text2">
          <span data-slot="team-count">{teamCountLabel(visible.length, items.length)}</span> — who
          works here, and on which brands.
        </p>
        <p
          data-slot="team-access-note"
          className="rounded-card border border-line bg-surface2 p-3 text-sm text-text3"
        >
          {TEAM_ACCESS_NOTE} {TEAM_ACCESS_ENFORCEMENT_NOTE}
          {demoAccessNote === null ? null : <> {demoAccessNote}</>}
        </p>
      </header>

      <section aria-labelledby="team-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="team-heading" className="text-sm font-medium text-text2">
            Roster
          </h2>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              filter(event.target.value);
            }}
            placeholder="Search name, email or role"
            aria-label="Search the team by name, email or role"
            data-slot="team-search"
            className="h-8 w-full sm:w-64"
          />
        </div>

        <TeamTable
          items={visible}
          emptyState={
            <div data-slot="team-empty" className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-text2">
                {items.length === 0
                  ? 'Nobody is on this team yet. Invite the first person to see them here.'
                  : `Nobody matches “${term}”. Try a name, an email address or a role.`}
              </p>
              {items.length === 0 ? (
                <InviteMember demo={demo} slot="empty-invite-member" />
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
    </div>
  );
}
