import { auth } from '@clerk/nextjs/server';
import type { TeamListRow, TeamRole } from '@tas/db';
import {
  DEMO_TEAM_ACTOR,
  agencyRoles,
  brandRoles,
  type AgencyRole,
  type BrandRole,
  type TeamPageActor,
} from '@tas/domain';

import { isDemoMode } from './demo-mode';

/**
 * Who is asking for the Team roster, in the shape the domain guard takes (PRD §11, ticket
 * criterion 7).
 *
 * ONE MAPPING, TWO CALLERS. `page.tsx` asks it before it renders a row and `inviteMemberAction`
 * asks it again before it accepts a write; the rule itself — who may see this page — stays in
 * `canSeeTeamPage` in `@tas/domain`, and neither caller writes `role === 'admin'` by hand. This
 * module only turns a roster row into the two fields that guard needs, and answers the session.
 *
 * DEMO MODE never reaches Clerk. There is no identity provider configured, so `auth()` would throw
 * without a `ClerkProvider` and middleware; the stub actor stands in for an admin instead
 * (`DEMO_TEAM_ACTOR`), exactly as `currentActor()` returns `DEMO_ACTOR` for the shell, and the page
 * says so in its note rather than silently skipping the check.
 */

/**
 * A roster row reshaped for the guard.
 *
 * `TeamListRow.roles` merges the two vocabularies into one array, because the table renders them as
 * one row of chips; the guard keeps them apart, because an admin holds no brand assignments at all
 * and a guard that only read brand roles would lock out the one person who has everything.
 */
export function teamPageActorFrom(row: TeamListRow | undefined): TeamPageActor | null {
  if (row === undefined) {
    return null;
  }
  const isAgencyRole = (role: TeamRole): role is AgencyRole =>
    (agencyRoles as readonly string[]).includes(role);
  const isBrandRole = (role: TeamRole): role is BrandRole =>
    (brandRoles as readonly string[]).includes(role);
  return {
    agencyRole: row.roles.find(isAgencyRole) ?? null,
    brandRoles: row.roles.filter(isBrandRole),
  };
}

/**
 * Seams, for tests only. Production calls with no `deps`: `demoMode` reads the environment through
 * `@tas/env` and `session` is Clerk's `auth()`.
 */
export interface TeamActorDeps {
  readonly demoMode?: () => boolean;
  readonly session?: () => Promise<{ userId: string | null }>;
}

/**
 * The actor behind the current request, found in rows the caller has already read.
 *
 * Taking the roster as an argument rather than querying for one person is what keeps the page to a
 * single database read: the table needs every row anyway, and the person asking is one of them.
 * Somebody with no roster row — a client, or an account outside the agency — resolves to `null`,
 * which `canSeeTeamPage` denies.
 */
export async function currentTeamActor(
  rows: readonly TeamListRow[],
  deps: TeamActorDeps = {},
): Promise<TeamPageActor | null> {
  if ((deps.demoMode ?? isDemoMode)()) {
    return DEMO_TEAM_ACTOR;
  }
  const { userId } = await (deps.session ?? auth)();
  if (userId === null) {
    return null;
  }
  return teamPageActorFrom(rows.find((row) => row.clerkUserId === userId));
}
