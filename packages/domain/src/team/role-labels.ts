/**
 * The Team page's role vocabulary (PRD §11): one merged label map and one fixed chip tone per role.
 *
 * `listTeam` in `@tas/db` returns one row per person with a `role` that is an agency role for an
 * admin and a brand role for everybody else, so the Team table is the one caller that genuinely
 * holds a key of either kind and cannot know in advance which map it came from. That is what
 * `ROLE_LABELS` is for. The two source maps in `../roles` stay separate, because everywhere else in
 * the platform the distinction matters: `agencyRoles` are Clerk organisation roles, `brandRoles` are
 * per-brand memberships, and a route guard that confuses the two is a security bug.
 *
 * Nothing here reads the database, the session or the clock. The page and the Server Actions both
 * call these functions; neither reimplements the mapping and no component writes a role string.
 */

import { AGENCY_ROLE_LABELS, BRAND_ROLE_LABELS, type Role } from '../roles';
import type { ChipTone } from '../state/creative-status';

/**
 * Every agency role and every brand role, keyed to its PRD §11 label.
 *
 * Spread from the two maps rather than retyped, so a rename in `../roles` lands here automatically
 * and the Team page can never drift from the rest of the platform by one stale label. The key type
 * is the full `Role` union, so a role added to either tuple fails the build until it has a label.
 *
 * The two vocabularies do not overlap — `admin`/`member` are agency-only, the six brand roles are
 * brand-only — so the spread order cannot shadow anything.
 */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ...AGENCY_ROLE_LABELS,
  ...BRAND_ROLE_LABELS,
};

/** True when `value` is a role this module knows — the guard behind a `text` column read. */
export function isRole(value: string): value is Role {
  return Object.hasOwn(ROLE_LABELS, value);
}

const ROLE_TONES: Readonly<Record<Role, ChipTone>> = {
  admin: 'accent',
  member: 'mute',
  csm: 'info',
  strategist: 'info',
  video_editor: 'mute',
  designer: 'mute',
  media_buyer: 'warn',
  client: 'ok',
};

/**
 * The chip tone for a role, in the same six-tone `ChipTone` vocabulary every status chip in the
 * platform uses. ONE FIXED TONE PER ROLE (ticket criterion 3) — the Team page's chips are an
 * identity, not a state, so nothing here depends on a row, a date or a workflow status.
 *
 * The assignment is the org chart read as colour, and it is deliberate rather than decorative:
 *
 *   - `admin` → `accent`, the one role with everything and all brands, and the only one that gets
 *     the brand accent on this page.
 *   - `csm` and `strategist` → `info`, the two roles that own client outcomes and are the two names
 *     §12 routes almost every notification to.
 *   - `video_editor` and `designer` → `mute`, the production roles: the largest group, and the one
 *     where a loud chip on every second row would drown out the rest of the table.
 *   - `media_buyer` → `warn`, because §11 gives that role the launch button — the only internal role
 *     that can put spend behind a creative — and `warn` is the palette's "look twice" tone.
 *   - `client` → `ok`, external and read-only; nothing internal is at stake on a client row.
 *   - `member` → `mute`, the Clerk default for somebody with no brand assignment yet. It is the
 *     absence of a role, so it gets the palette's "no opinion" tone rather than a colour of its own.
 *
 * Total on `string` for the same reason `roleLabel` is: the key arrives from a `text` column, and an
 * unrecognised one lands on `mute` instead of throwing inside a render.
 */
export function roleTone(role: string): ChipTone {
  return isRole(role) ? ROLE_TONES[role] : 'mute';
}
