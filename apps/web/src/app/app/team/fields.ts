import type { TeamListRow, TeamRole } from '@tas/db';
import {
  TEAM_ACCESS_ROLES,
  brandRoles,
  hasNeverBeenActive,
  isInternalBrandRole,
  lastActiveLabel,
  roleLabel,
  roleTone,
  teamAccessNote,
} from '@tas/domain';
import type { ChipTone } from '@tas/domain/state';

import { absoluteTime } from '@/lib/relative-time';

/**
 * Everything the Team table shows about one person, resolved once on the server (PRD §11, §3).
 *
 * One module, so the page, the table and the design-system story cannot drift: the column headings,
 * the four cells and the two sentences above the table are stated here and nowhere else. Every role
 * label and every chip tone comes from `@tas/domain` — no component in this route writes a role
 * string, a label or a tone (CLAUDE.md UI governance rules 1 and 2 applied to the role vocabulary).
 *
 * Nothing here reads the clock, the session or the database: `toTeamItem` takes `now` as a
 * parameter for the same reason the Personas page formats its timestamps on the server, and only
 * TYPES are imported from `@tas/db` so the driver never reaches the browser bundle.
 */

/** The four columns, in the ticket's order. The table renders exactly these and nothing else. */
export const TEAM_COLUMNS = ['Name', 'Role', 'Brands', 'Last active'] as const;

/**
 * The agency role PRD §11 gives "Everything, all brands", taken from the domain's access list
 * rather than typed as `'admin'`. An admin holds no `brand_assignments` rows at all, so an empty
 * `brandNames` means something different on their row than on anybody else's.
 */
const [AGENCY_ADMIN_ROLE] = TEAM_ACCESS_ROLES;

/** An admin's Brands cell: they are agency-wide, so the absence of assignments means everything. */
export const ALL_BRANDS_LABEL = 'All brands';

/** Anybody else with no assignment. Never an empty cell, never a dash and never "0". */
export const NO_BRANDS_LABEL = 'No brands';

/**
 * The externally visible roles — `client` today — derived through the domain's `isInternalBrandRole`
 * rather than named, so PRD §10 ("clients see zero internal data") keeps holding if the vocabulary
 * grows a second external role.
 */
const EXTERNAL_ROLES: readonly TeamRole[] = brandRoles.filter((role) => !isInternalBrandRole(role));

/**
 * What a client's row says about their access, spelled out (PRD §10, §11).
 *
 * `demoTeam` holds five internal people and no client, and `listTeam` only returns users with an
 * agency membership, so this should never render today. It exists because "should never" is not
 * "cannot": the moment a client did appear in the roster, a row that looked like every other row
 * would imply they can see this workspace. They cannot — they see one brand's approval interface —
 * and the row has to say so rather than leave a reader to assume.
 */
export const CLIENT_ACCESS_NOTE = 'Client interface for their brand only — no workspace access.';

/** The sentence naming who may open the page (criterion 6), built from the role labels. */
export const TEAM_ACCESS_NOTE = teamAccessNote();

/**
 * The second half of the note. Hiding the sidebar link is decoration, not a control: the page
 * itself asks `canSeeTeamPage` on the server before it renders a row, and so does the invite
 * action. Saying that out loud is the point — a reader who can see the link but not the data should
 * know which of the two is the actual rule.
 */
export const TEAM_ACCESS_ENFORCEMENT_NOTE =
  'Access is decided on the server by canSeeTeamPage in @tas/domain before any row is read, not by hiding the sidebar link.';

/** What a visitor sees in live mode when the guard says no. */
export const TEAM_NOT_AUTHORISED_TITLE = 'You do not have access to the team roster.';

/** Why the Invite member button is inert outside demo mode (criterion 8): nothing sends mail yet. */
export const INVITE_SOON_HINT = 'Invitations are not sent yet, so this records nothing.';

export interface TeamRoleChip {
  readonly role: TeamRole;
  readonly label: string;
  readonly tone: ChipTone;
}

/** The Brands cell: the names, or the words that explain an empty list. */
export interface TeamBrandsCell {
  readonly text: string;
  /** True for "No brands", which reads in `text-text3` rather than in the body colour. */
  readonly muted: boolean;
}

export interface TeamItem {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly roles: readonly TeamRoleChip[];
  readonly brands: TeamBrandsCell;
  /** "3 days ago", or "Never". Formatted on the server with one `now` for the whole table. */
  readonly lastActive: string;
  /** The absolute timestamp behind it, or null for somebody who has never signed in. */
  readonly lastActiveTitle: string | null;
  readonly neverActive: boolean;
  /** True for a `client` row: their access is the client interface, not this workspace. */
  readonly external: boolean;
  /** Name, email and role, lower-cased once, for the `?q=` filter. */
  readonly search: string;
}

/** One chip per role a person holds, in the order `listTeam` returns them. */
export function roleChips(roles: readonly TeamRole[]): TeamRoleChip[] {
  return roles.map((role) => ({ role, label: roleLabel(role), tone: roleTone(role) }));
}

/**
 * The Brands cell. `brandNames` arrives alphabetical and de-duplicated from `@tas/db`, so nothing
 * sorts here; an empty list is two different facts depending on the role, and both are words.
 */
export function brandsCell(row: TeamListRow): TeamBrandsCell {
  if (row.brandNames.length > 0) {
    return { text: row.brandNames.join(', '), muted: false };
  }
  return row.roles.includes(AGENCY_ADMIN_ROLE)
    ? { text: ALL_BRANDS_LABEL, muted: false }
    : { text: NO_BRANDS_LABEL, muted: true };
}

/** True when the person's access is the client interface rather than this workspace. */
export function isExternalMember(row: TeamListRow): boolean {
  return row.roles.some((role) => EXTERNAL_ROLES.includes(role));
}

/** What `?q=` matches: the name, the email, and the role both as a label and as its key. */
export function searchText(row: TeamListRow): string {
  return [row.fullName, row.email, ...row.roles.map(roleLabel), ...row.roles]
    .join(' ')
    .toLowerCase();
}

/** One row, fully resolved. `now` is a parameter so the whole table shares a single instant. */
export function toTeamItem(row: TeamListRow, now: Date): TeamItem {
  const never = hasNeverBeenActive(row.lastActiveAt);
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    roles: roleChips(row.roles),
    brands: brandsCell(row),
    lastActive: lastActiveLabel(row.lastActiveAt, now),
    lastActiveTitle: never || row.lastActiveAt === null ? null : absoluteTime(row.lastActiveAt),
    neverActive: never,
    external: isExternalMember(row),
    search: searchText(row),
  };
}

/** "5 people", or "2 of 5 people" while the filter is narrowing. */
export function teamCountLabel(visible: number, total: number): string {
  const word = total === 1 ? 'person' : 'people';
  return visible === total
    ? `${String(total)} ${word}`
    : `${String(visible)} of ${String(total)} ${word}`;
}
