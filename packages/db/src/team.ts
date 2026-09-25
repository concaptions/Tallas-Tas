import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  brandAssignments,
  brandRoles,
  brands,
  memberships,
  users,
  type AgencyRole,
  type BrandRole,
  type User,
} from './schema';

/**
 * The Team page's data access (PRD §11: "Each person gets their own account", §3: "TAS Digital
 * should be added in a team dashboard, with their role and names"). One read, `listTeam`, because
 * the page is a table with no detail panel and no writes — inviting, editing and removing a member
 * are out of this ticket.
 *
 * Deliberately NOT `withBrand`, and that is the point. The question the page asks is "who works
 * here, and on which brands" — a question no single brand's scope can answer, the same shape as
 * `themes.brandCounts` counting distinct brands across the platform. `users` and `memberships` are
 * not `BrandedTable`s at all (their `brand_id` stays nullable, so `withBrand(...).select(users)`
 * deliberately does not compile), and `brand_assignments` is read across brands ON PURPOSE: it is
 * the tenancy edge itself, and listing a person's brands means reading every row they hold. The
 * boundary that replaces the brand scope here is the AGENCY: pass `agencyId` and no other agency's
 * people, and no other agency's brand names, can appear. Route-level `requireAdmin` /
 * `requireBrandRole` stay the second line of defence, as CLAUDE.md sets out.
 *
 * Every read carries `deleted_at IS NULL` on each table it touches — the half of the scope that
 * still means something agency-wide.
 */

/** A role as the Team table labels it: the agency role for an admin, otherwise the brand roles. */
export type TeamRole = AgencyRole | BrandRole;

/**
 * A team member as the table renders it: the user row plus the roles they hold and the names of the
 * brands they are assigned to.
 *
 * `roles` is an ARRAY because a five-person agency covers six PRD §11 roles — someone wears two hats
 * (the CSM who also runs the ad accounts), and the table shows both chips rather than silently
 * dropping one. `role` is the first of them in vocabulary order, the single chip a caller that wants
 * one shows; it is never undefined, because a member with no brand assignment falls back to their
 * agency role (`member`).
 *
 * `brandNames` is alphabetical and de-duplicated: someone holding two roles on one brand names that
 * brand once. An admin is agency-wide and holds no `brand_assignments` rows, so their array is empty
 * — the page reads that as "All brands", and an empty array on a non-admin as "No brands". It is
 * names, not ids, because the cell is plain comma-separated text and nothing on this page links to a
 * brand.
 *
 * `lastActiveAt` comes straight from the user row and is null for someone who has never signed in.
 *
 * `demoTeam` satisfies `TeamListRow[]`, so the page reads demo fixtures and database rows through
 * one type.
 */
export type TeamListRow = User & {
  role: TeamRole;
  roles: TeamRole[];
  brandNames: string[];
};

/**
 * The roles one row shows, in the fixed vocabulary order of `brandRoles`, never the order the
 * assignments happened to be inserted in.
 *
 * An admin shows exactly `admin`: the agency role outranks anything else, and an admin is defined by
 * holding no brand assignments at all. A member with no assignment yet falls back to their agency
 * role, so the Role cell is never empty and the caller never has to handle an empty array.
 */
function rolesFor(
  agencyRole: AgencyRole,
  assigned: ReadonlySet<BrandRole>,
): [TeamRole, ...TeamRole[]] {
  if (agencyRole === 'admin') return ['admin'];
  const [first, ...rest] = brandRoles.filter((role) => assigned.has(role));
  return first === undefined ? [agencyRole] : [first, ...rest];
}

/**
 * Every live member of the agency, ordered by full name, each with their roles and brand names.
 *
 * Two statements rather than one row-multiplying join, the same shape as `listPersonas`: a join of
 * users to assignments returns a row per assignment, and collapsing that back into one row per
 * person in SQL would mean an aggregate whose ordering is harder to read than the two index scans it
 * saves over a table with a few dozen rows. The brand names arrive already sorted by
 * `order by brands.name`, so nothing re-sorts them afterwards.
 *
 * `memberships` is joined INNER, which is what makes this the team and not the address book: a
 * client has brand assignments and no membership, so they never appear here.
 *
 * `agencyId` is optional only because the platform runs one agency today; passing it is the
 * boundary, and both statements carry it — the second through `brands.agency_id`, so a stray
 * assignment on another agency's brand cannot put that brand's name in a row.
 */
export async function listTeam(db: Db, agencyId?: string): Promise<TeamListRow[]> {
  const inAgency = agencyId === undefined ? undefined : eq(memberships.agencyId, agencyId);
  const brandInAgency = agencyId === undefined ? undefined : eq(brands.agencyId, agencyId);

  const [people, assignments] = await Promise.all([
    db
      .select({ user: users, agencyRole: memberships.role })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(and(isNull(users.deletedAt), isNull(memberships.deletedAt), inAgency))
      .orderBy(asc(users.fullName)),
    db
      .select({
        userId: brandAssignments.userId,
        role: brandAssignments.role,
        brandName: brands.name,
      })
      .from(brandAssignments)
      .innerJoin(brands, eq(brands.id, brandAssignments.brandId))
      .where(and(isNull(brandAssignments.deletedAt), isNull(brands.deletedAt), brandInAgency))
      .orderBy(asc(brands.name)),
  ]);

  const assignedRoles = new Map<string, Set<BrandRole>>();
  const assignedBrands = new Map<string, string[]>();
  for (const assignment of assignments) {
    const roles = assignedRoles.get(assignment.userId) ?? new Set<BrandRole>();
    roles.add(assignment.role);
    assignedRoles.set(assignment.userId, roles);
    const names = assignedBrands.get(assignment.userId) ?? [];
    if (!names.includes(assignment.brandName)) names.push(assignment.brandName);
    assignedBrands.set(assignment.userId, names);
  }

  return people.map(({ user, agencyRole }) => {
    const roles = rolesFor(agencyRole, assignedRoles.get(user.id) ?? new Set<BrandRole>());
    return {
      ...user,
      role: roles[0],
      roles: [...roles],
      brandNames: assignedBrands.get(user.id) ?? [],
    };
  });
}

/**
 * `listTeam` under the name the Team ticket's app layer calls it. One function, two names: the page
 * asks for team MEMBERS, the table is the TEAM. Kept as an alias rather than a second query so there
 * is only ever one statement to audit.
 */
export const listTeamMembers = listTeam;

/** `TeamListRow` under the row-shaped name; see `listTeamMembers`. */
export type TeamMemberRow = TeamListRow;

/** The role the Overview dashboard is drawn for: agency Admin, or a per-brand role, or none. */
export type DashboardRole = BrandRole | 'admin';

/**
 * The current user's role for the active brand, for the role-aware Overview (Sprint 12). An agency
 * Admin (a `memberships.role = 'admin'` row) sees the Admin dashboard on every brand; otherwise the
 * `brand_assignments` role on THIS brand decides. Null when the user has no row here — the caller
 * falls back to the Admin (all-cards) view, so nobody is left with a blank Overview. Not `withBrand`:
 * it resolves who the caller IS before any brand scope, from the Clerk id the session already holds.
 */
export async function getActiveBrandRole(
  db: Db,
  brandId: string,
  clerkUserId: string,
): Promise<DashboardRole | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)))
    .limit(1);
  if (user === undefined) return null;

  const [admin] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        eq(memberships.role, 'admin'),
        isNull(memberships.deletedAt),
      ),
    )
    .limit(1);
  if (admin !== undefined) return 'admin';

  const [assignment] = await db
    .select({ role: brandAssignments.role })
    .from(brandAssignments)
    .where(
      and(
        eq(brandAssignments.userId, user.id),
        eq(brandAssignments.brandId, brandId),
        isNull(brandAssignments.deletedAt),
      ),
    )
    .limit(1);
  return assignment?.role ?? null;
}
