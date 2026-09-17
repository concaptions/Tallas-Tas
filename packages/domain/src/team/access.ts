/**
 * Who may open `/app/team` (PRD §11, ticket criterion 7).
 *
 * §11 gives the Admin "Everything, all brands" and the Client Success Manager "all brands assigned
 * to them — they work across the whole client base". Those two are the only people whose job spans
 * the roster, so the roster page is theirs. A strategist, a video editor, a designer or a media
 * buyer sees the brands they are on, not the people; a `client` must never see the agency's staff
 * list at all.
 *
 * PURE AND SESSION-FREE. The actor is a parameter: this module reads no cookie, calls no Clerk API
 * and imports nothing from `apps/web`. That is what lets `page.tsx` decide access on the server from
 * `currentActor()` and lets a future Server Action re-check the same rule without either of them
 * writing `role === 'admin'` by hand. The decision lives here once (CLAUDE.md non-negotiable 2's
 * sibling rule: business logic lives in `packages/domain`).
 */

import { roleLabel, type AgencyRole, type BrandRole } from '../roles';

/**
 * The two roles §11 puts on this page, in the order the access note reads them.
 *
 * Exported so the note, the guard and any later test all count from one list. `admin` is an agency
 * role and `csm` is a brand role, which is precisely why the actor below carries both kinds: an
 * admin holds no `brand_assignments` rows at all, so a guard that only looked at brand roles would
 * lock out the one person who has everything.
 */
export const TEAM_ACCESS_ROLES: readonly [AgencyRole, BrandRole] = ['admin', 'csm'];

/**
 * What the guard needs to know about the person asking. Deliberately narrower than any session
 * object: two fields, both optional, so a caller with a partially-loaded actor still type-checks and
 * still gets a safe answer.
 *
 * `agencyRole` is the Clerk organisation role on the TAS org (`null` for somebody outside it, such
 * as a client). `brandRoles` is every per-brand membership the person holds, across all brands —
 * a CSM qualifies by holding `csm` on any brand, because §11 scopes a CSM by brand list, not by the
 * brand currently selected in the switcher.
 */
export interface TeamPageActor {
  readonly agencyRole?: AgencyRole | null;
  readonly brandRoles?: readonly BrandRole[] | null;
}

/**
 * True only for an agency admin or a CSM. Everything else — including a missing actor — is false.
 *
 * DENY BY DEFAULT: `null`, `undefined`, an empty actor and an unknown role all return false, so a
 * caller that fails to resolve a session cannot accidentally fall through to an open page. The one
 * case that is *not* decided here is demo mode, where there is no session to ask at all: the page
 * stands the stub actor in for an admin and says so in the note (criterion 7), and it does that by
 * handing this function an admin actor rather than by skipping the check.
 */
export function canSeeTeamPage(actor: TeamPageActor | null | undefined): boolean {
  if (!actor) {
    return false;
  }
  if (actor.agencyRole === 'admin') {
    return true;
  }
  return actor.brandRoles?.includes('csm') ?? false;
}

/**
 * The sentence above the table (criterion 6): "Admin and Client Success Managers only."
 *
 * Built from `roleLabel` over `TEAM_ACCESS_ROLES` rather than typed as a literal, so renaming a role
 * rewrites the note and the note can never promise access the guard does not grant. The plural is
 * applied to the second role only, because English: one Admin, many Client Success Managers.
 */
export function teamAccessNote(): string {
  const [agency, brand] = TEAM_ACCESS_ROLES;
  return `${roleLabel(agency)} and ${roleLabel(brand)}s only.`;
}

/**
 * The extra sentence demo mode appends, where there is no identity provider to ask and the stub
 * actor stands in for an admin. A constant so the page does not compose the explanation itself.
 */
export const DEMO_TEAM_ACCESS_NOTE =
  'Demo mode signs you in as an Admin, so the full roster shows.';

/** The actor demo mode hands the guard: an agency admin with no brand memberships. */
export const DEMO_TEAM_ACTOR: TeamPageActor = { agencyRole: 'admin', brandRoles: [] };
