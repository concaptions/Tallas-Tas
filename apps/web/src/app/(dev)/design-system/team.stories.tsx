import type { TeamListRow } from '@tas/db';
import { Button } from '@tas/ui';

import { TeamTable } from '@/app/app/team/team-table';
import { toTeamItem } from '@/app/app/team/fields';

/**
 * The shapes the Team route introduces (CLAUDE.md UI governance rule 4): the four-column roster row
 * with its name-over-email cell, one role chip per role a person holds, the two worded Brands
 * fallbacks, the Never cell, the client row's access warning, and the table's own empty state.
 *
 * Nothing is re-drawn here. `TeamTable` is the route's own component, mounted with plain rows rather
 * than database ones, and every label, tone and phrase is resolved by the same `toTeamItem` the page
 * calls. A tone shown here is the tone the page shows.
 *
 * `NOW` is fixed so the Last active column reads the same on any day this page is opened — the story
 * demonstrates the ladder (hours, days, weeks, Never), not today's date.
 */
const NOW = new Date('2026-09-17T12:00:00.000Z');

const AT = (iso: string) => new Date(iso);

/** The base every sample row spreads: the audit columns a `users` row carries and nobody reads here. */
function base(id: string) {
  return {
    id,
    brandId: null,
    createdAt: AT('2025-01-06T09:00:00.000Z'),
    updatedAt: AT('2026-09-01T09:00:00.000Z'),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    slackUserId: null,
  };
}

const SAMPLE_ROWS: readonly TeamListRow[] = [
  {
    ...base('ds-team-1'),
    clerkUserId: 'ds_admin',
    fullName: 'Marguerite Alaoui',
    email: 'marguerite@tasdigital.example',
    lastActiveAt: AT('2026-09-17T08:41:00.000Z'),
    role: 'admin',
    roles: ['admin'],
    brandNames: [],
  },
  {
    ...base('ds-team-2'),
    clerkUserId: 'ds_csm',
    fullName: 'Callum Ashworth',
    email: 'callum@tasdigital.example',
    lastActiveAt: AT('2026-09-10T14:30:00.000Z'),
    role: 'csm',
    roles: ['csm', 'media_buyer'],
    brandNames: ['Funky Painting', 'Gratsi', 'Mattress Central', 'Niagara Sleep Solutions'],
  },
  {
    ...base('ds-team-3'),
    clerkUserId: 'ds_member',
    fullName: 'Priya Raghunathan',
    email: 'priya@tasdigital.example',
    lastActiveAt: null,
    role: 'member',
    roles: ['member'],
    brandNames: [],
  },
  {
    ...base('ds-team-4'),
    clerkUserId: 'ds_client',
    fullName: 'Ola Bergström',
    email: 'ola@gratsi.example',
    lastActiveAt: AT('2026-09-16T17:20:00.000Z'),
    role: 'client',
    roles: ['client'],
    brandNames: ['Gratsi'],
  },
];

/**
 * The roster, four rows chosen for the four things the cell logic has to get right: an admin with no
 * assignments reading "All brands", a two-hat row carrying two chips, an invited member who has
 * never signed in reading "Never" on a "No brands" row, and a client — who must never look like a
 * colleague, so the row states that their access is the client interface for their brand only.
 */
export function TeamTableStory() {
  return <TeamTable items={SAMPLE_ROWS.map((row) => toTeamItem(row, NOW))} />;
}

/**
 * The same table with nothing in it. The empty state is a real state, not a blank panel: it says
 * what is missing in words and offers the way out, which here is the filter that emptied it.
 */
export function TeamEmptyStory() {
  return (
    <TeamTable
      items={[]}
      emptyState={
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-text2">
            Nobody matches “bergström”. Try a name, an email address or a role.
          </p>
          <Button type="button" variant="outline" size="sm">
            Clear search
          </Button>
        </div>
      }
    />
  );
}
