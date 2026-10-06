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
 * Who may configure the client interface (`/app/interface-config`).
 *
 * Oct 6/7 Talal ruling: this surface is wider than `canSeePropagationPage` on purpose — a CSM owns
 * the client relationship (§11: "they work across the whole client base"), so curating which pages
 * and tabs that client reaches is part of their day. An Admin keeps the ability as the superset of
 * everyone else. Everybody else — strategist, editor, designer, media buyer, client, member —
 * stays out.
 *
 * The existing `canSeePropagationPage` continues to gate the TEMPLATE write (approving a
 * propagation request writes the parent every brand inherits), which is why that rule stays
 * strictly Admin and this one widens by one role; the two decisions disagree deliberately.
 */
export function canConfigureInterface(actor: TeamPageActor | null | undefined): boolean {
  if (!actor) {
    return false;
  }
  if (actor.agencyRole === 'admin') {
    return true;
  }
  return actor.brandRoles?.includes('csm') ?? false;
}

/** What a reader who fails `canConfigureInterface` is told, in the same voice as the siblings above. */
export const INTERFACE_CONFIG_NOT_PERMITTED_NOTE =
  'Only an agency Admin or a Client Success Manager can change which pages and tabs the client ' +
  'interface shows.';

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

/* ------------------------------------------------------------------------------------------------
 * WHICH SECTIONS A ROLE MAY OPEN (AI-57 / AI-65, PRD §11 with §9, §12 and §13)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The role a viewer holds for the brand they are looking at: an agency `admin`, or one of the six
 * per-brand roles. Structurally identical to `@tas/db`'s `DashboardRole`, declared here because
 * this package may not import the database layer and because the rule below is the reason the type
 * exists at all — the Overview's cards and the sidebar's sections are two readings of one answer.
 *
 * `null` is "we could not resolve one". It is a real case: a signed-in person with no
 * `brand_assignments` row on the active brand. It is treated as the narrowest role there is, not
 * the widest — see `canSeeNavSection`.
 */
export type ViewerRole = AgencyRole | BrandRole;

/**
 * Every section of the product, keyed the way `apps/web/src/components/shell/nav.ts` keys them.
 *
 * Listed here, in `packages/domain`, and not derived from the nav module, because the direction of
 * the dependency decides who owns the rule: the sidebar asks the domain what a role may see, the
 * domain never asks a React component. A section added to the nav without a line here fails the
 * nav test that cross-checks the two lists (`nav.test.ts`), which is the reminder to make the
 * access decision rather than inherit one.
 */
export const NAV_SECTION_KEYS = [
  'overview',
  'products',
  'collections',
  'personas',
  'angles',
  'themes',
  'concepts',
  'creative-modules',
  'ai-characters',
  'competitive-research',
  'briefs',
  'creative-sheet',
  'ugc',
  'client-assets',
  'assets',
  'upload-links',
  'copywriting',
  'youtube-copywriting',
  'campaigns',
  'email-campaigns',
  'email-flows',
  'sm-campaign-feed',
  'performance',
  'creative-reporting',
  'ad-spy',
  'creator-ranking',
  'copy-types',
  'creative-dimensions',
  'internal-queue',
  'client-queue',
  'team',
  'interface-config',
  'notifications',
  'propagation',
  'column-admin',
  'onboarding-forms',
  'onboard',
  'design-system',
] as const;

export type NavSectionKey = (typeof NAV_SECTION_KEYS)[number];

/**
 * The sections an agency Admin keeps to themselves. PRD §11 row 1 gives the Admin "Everything, all
 * brands"; these five are the ones where "everything" is the whole POINT of the page, so nobody
 * else belongs on them:
 *
 * - `propagation` and `column-admin` — CLAUDE.md non-negotiable 2: a child's change can only
 *   *request* promotion, and approving one writes the parent template that every brand inherits.
 * - `interface-config` — PRD §10's per-brand page and field switches, which decide what a client
 *   sees.
 * - `onboard` / `onboarding-forms` — PRD §3 brand onboarding, which is where the team assignment
 *   that routes every notification (§12) is set.
 *
 * `propagation`, `column-admin` and `interface-config` ALREADY refuse a non-admin at the route:
 * all three pages call `canSeePropagationPage` before they render a row. Listing them here is what
 * stops the sidebar offering a link to a page that is going to say no — the nav and the route now
 * give the same answer instead of disagreeing.
 */
const ADMIN_ONLY_SECTIONS: readonly NavSectionKey[] = [
  'propagation',
  'column-admin',
  'interface-config',
  'onboarding-forms',
  'onboard',
];

/**
 * What a Video Editor or a Designer sees. PRD §11 scopes them to "only the brands assigned to
 * them" and says nothing about modules, so the module list is read off the two sections that
 * describe their actual job:
 *
 * - §9's internal track is theirs from "Sent to Designer / Sent to Video Editor" to "Ad Submitted",
 *   and §12's first trigger is "Brief assigned to an editor/designer → DM the assignee". That is
 *   `briefs` (Creative Design) and `creative-sheet`, which §5.10 names as the same artefact
 *   ("Creative Briefs (which is called in our Airtable: Creative Sheet)").
 * - §8 is the delivery standard they deliver against — variations and dimension sets — so
 *   `creative-dimensions` is the lookup they produce from, and `assets` / `client-assets` are the
 *   material they produce with. `upload-links` is how a finished file comes back in.
 * - §13 wants a dashboard "per team member, as of what their assigned, and pending tasks", so
 *   `overview` stays.
 * - `notifications` stays because CLAUDE.md non-negotiable 7 makes email a PER-USER toggle: the
 *   person who gets the DMs is the only one who can set their own preference.
 *
 * Everything else is somebody else's desk: strategy (§5.4-5.7), copy (§5.11), campaigns, reporting
 * (§13's media-buyer formula), the approval queues (§9's reviewer half) and the settings pages.
 */
const EDITOR_SECTIONS: readonly NavSectionKey[] = [
  'overview',
  'briefs',
  'creative-sheet',
  'client-assets',
  'assets',
  'upload-links',
  'creative-dimensions',
  'notifications',
];

/**
 * Who may open a section.
 *
 * ONE TABLE, SIX ROLES, DENY BY DEFAULT. A role missing from this record cannot compile (it is
 * keyed `Record<ViewerRole, ...>` over both tuples), and an unresolved role is not in it at all, so
 * it falls through to nothing — see `canSeeNavSection`.
 *
 * - `admin` — every section. PRD §11: "Everything, all brands".
 * - `csm`, `strategist`, `media_buyer` — every section except the Admin's five. §11 scopes these
 *   three by BRAND, not by module: a CSM "works across the whole client base", a strategist and a
 *   media buyer see "the brands assigned to them". Narrowing their modules would be a product
 *   decision the PRD does not make, so this keeps the breadth they have today and nothing more.
 * - `video_editor`, `designer` — `EDITOR_SECTIONS`. §11 pairs the two roles on one row
 *   ("Video Editor / Designer"), so they get one list.
 * - `client` — NOTHING. §11: "Their own brand's interface only", and CLAUDE.md non-negotiable 10:
 *   clients see zero internal data. The client's product is `/client/<brand>`, a different route
 *   tree with its own layout; no part of `/app` is theirs, which is why this entry is empty rather
 *   than short.
 * - `member` — NOTHING. It is the Clerk organisation default for anybody in the TAS org who is not
 *   an admin, which is to say "we know you are staff, we do not yet know your job". The PRD has no
 *   such product role: §11 decides by the brand assignment. Somebody whose assignment has not been
 *   made yet gets the empty list and an Admin fixes it on the Team page — the one direction of
 *   error that cannot leak a brand's data.
 */
const SECTIONS_BY_ROLE: Readonly<Record<ViewerRole, readonly NavSectionKey[]>> = {
  admin: NAV_SECTION_KEYS,
  member: [],
  csm: NAV_SECTION_KEYS.filter((key) => !ADMIN_ONLY_SECTIONS.includes(key)),
  strategist: NAV_SECTION_KEYS.filter((key) => !ADMIN_ONLY_SECTIONS.includes(key)),
  media_buyer: NAV_SECTION_KEYS.filter((key) => !ADMIN_ONLY_SECTIONS.includes(key)),
  video_editor: EDITOR_SECTIONS,
  designer: EDITOR_SECTIONS,
  client: [],
};

/**
 * Whether `role` may open the section `key` names.
 *
 * DENY BY DEFAULT, in both arguments. An unresolved role (`null`/`undefined`, the signed-in person
 * with no assignment on this brand) gets nothing, and a section key that is not in
 * `NAV_SECTION_KEYS` gets nothing either — so a page that guards itself with a misspelled key
 * closes rather than opens. This is the opposite of `loadActiveRole`'s `?? 'admin'` fallback, which
 * is a DISPLAY default for the Overview's tiles; a fallback that widens access is not a guard.
 */
export function canSeeNavSection(
  role: ViewerRole | null | undefined,
  key: string,
): key is NavSectionKey {
  // Widened to `string[]` on purpose: `key` arrives as a plain string from a route guard, and the
  // point of the predicate is to decide whether it is one of the keys, not to assume it already is.
  return (navSectionsForRole(role) as readonly string[]).includes(key);
}

/**
 * Every section `role` may open, in `NAV_SECTION_KEYS` order. Empty for a client, for a member with
 * no assignment, and for an unresolved role. The single implementation both this and
 * `canSeeNavSection` read, so the sidebar's list and a route's answer can never drift apart.
 */
export function navSectionsForRole(role: ViewerRole | null | undefined): readonly NavSectionKey[] {
  if (role === undefined || role === null) {
    return [];
  }
  return SECTIONS_BY_ROLE[role];
}

/**
 * Whether `role` belongs in the internal workspace at all (AI-65).
 *
 * `/app` is the TAS team's product; `/client/<brand>` is the client's. PRD §11 gives a `client`
 * "their own brand's interface only" and CLAUDE.md non-negotiable 10 says clients see zero internal
 * data — not a narrower `/app`, none of it. The same answer covers a `member` whose brand
 * assignment has not been made yet, and anyone the role resolver could not place.
 *
 * Derived from the table rather than written as `role !== 'client'`, so it cannot disagree with it:
 * a role with no sections has nowhere to land, and the shell refuses once instead of every section
 * refusing separately.
 */
export function canSeeInternalWorkspace(role: ViewerRole | null | undefined): boolean {
  return navSectionsForRole(role).length > 0;
}

/**
 * What a refused page says: the rule, and who to ask, in the shape the two existing refusals
 * (`PROPAGATION_NOT_ADMIN_NOTE`, `TEAM_ACCESS_NOTE`) already use. It never names the sections the
 * reader cannot see — a refusal that lists the product is a leak with good manners.
 */
export const SECTION_NOT_PERMITTED_TITLE = 'This section is not part of your role.';

export const SECTION_NOT_PERMITTED_NOTE =
  'Your role does not include this section. Ask your Client Success Manager or an Admin if you ' +
  'need access to it.';

/**
 * What the shell says to somebody who has no business under `/app` at all. It points at the client
 * product by name rather than listing what is here, because naming the modules to a client is the
 * leak non-negotiable 10 forbids.
 */
export const NO_WORKSPACE_TITLE = 'This workspace is for the TAS team.';

export const NO_WORKSPACE_NOTE =
  'Your account does not have access to the internal workspace. If you are a client, your brand ' +
  'interface is the place to review and approve work; ask your Client Success Manager for the link.';
