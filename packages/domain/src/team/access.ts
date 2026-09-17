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

/**
 * Who may open `/app/propagation` (PRD §5, ticket `propagation` criterion 3).
 *
 * §5: "request comes in to the ADMIN dashboard to approve everything." ADMIN ONLY, and strictly
 * narrower than `canSeeTeamPage` above: a CSM belongs on the roster because §11 scopes them across
 * the whole client base, but approving a promotion writes into the TEMPLATE and every brand inherits
 * the result, so it is not a per-brand job however many brands the person holds. The two guards
 * disagree on purpose; `../propagation/review` is where the reason is written at length.
 *
 * It lives in this file, beside `canSeeTeamPage`, because the actor type and every other access rule
 * are here and because the reviewing half of the rule (`canReviewPromotion`) must be the SAME
 * function, not a second one that agrees today: the page shows nothing but the pending queue and the
 * Approve/Reject buttons, so a page that opened wider than the buttons would render controls it
 * refuses to honour. `../propagation/review` re-exports this under the name the action path calls it
 * by; the edge runs `propagation -> team` and never back.
 *
 * DENY BY DEFAULT, like its sibling: `null`, `undefined`, `{}`, a member, a client and an unknown
 * role are all false, so a page that fails to resolve a session cannot fall through to the queue.
 * Demo mode passes `DEMO_TEAM_ACTOR` rather than skipping the call (criterion 3).
 */
export function canSeePropagationPage(actor: TeamPageActor | null | undefined): boolean {
  return actor?.agencyRole === 'admin';
}

/**
 * The note above the table, `data-slot="admin-note"` (criterion 2). One short paragraph; the page
 * wraps it in a `rounded-card` `border-line` `bg-surface2` block in `text-text3`, so no colour or
 * radius decision leaks into this package.
 *
 * It says the same thing the guard enforces, in the order a reader needs it: who the page is for,
 * what a request is, and who settles it. The last clause is CLAUDE.md's non-negotiable in the user's
 * own words — nothing auto-promotes.
 */
export const PROPAGATION_ADMIN_NOTE =
  'This page is admin only. A change made in one brand can request promotion to the template, ' +
  'and an agency admin approves or rejects it here — nothing is promoted automatically.';

/**
 * The extra sentence demo mode appends, where there is no identity provider to ask. It says the
 * check is STUBBED rather than absent, because the check does still run: the page hands
 * `DEMO_TEAM_ACTOR` to `canSeePropagationPage` and gets a real answer from a stand-in actor.
 */
export const DEMO_PROPAGATION_ACCESS_NOTE =
  'Demo mode signs you in as an Admin, so the pending queue shows; the role check is stubbed, ' +
  'not skipped.';

/**
 * What `data-slot="not-admin"` says instead of the table when the guard refuses (criterion 3). It
 * names the role that can act, so the reader knows who to go to rather than only that they cannot.
 */
export const PROPAGATION_NOT_ADMIN_NOTE =
  'Only an agency Admin can review promotion requests. Ask your Admin to approve or reject this ' +
  'change.';
