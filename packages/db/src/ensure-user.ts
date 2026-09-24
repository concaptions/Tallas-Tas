import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import { agencies, memberships, users } from './schema';

/**
 * Just-in-time provisioning for a Clerk-authenticated user (2D).
 *
 * A person signs in through Clerk, but nothing in the product knows them until a `users` row and an
 * agency `membership` exist: `team-actor.ts` matches the session against roster rows by
 * `clerk_user_id`, so a real admin with no row is denied the Team page and the promotion queue.
 * This creates the row on first sight, from the Clerk profile the caller has already read.
 *
 * WHAT AUTHORISES THE MEMBERSHIP is Clerk organisation membership, nothing weaker. The user is
 * linked ONLY to the agency whose `clerk_org_id` equals the session's active org — the agency the
 * Clerk admin invited them into. A signed-in user whose active org maps to no agency gets a `users`
 * row but NO membership and therefore no agency data, so a stranger who merely has a Clerk account
 * cannot provision themselves into a tenant. The role mirrors the Clerk org role: the org's admin
 * becomes an agency `admin`, everyone else a `member` (least privilege), which the agency admin can
 * change on the Team page.
 *
 * Idempotent and race-safe: both writes are `onConflictDoNothing` against the unique keys
 * (`users.clerk_user_id`, `memberships (user_id, agency_id)`), so concurrent first requests settle
 * to one row. It never updates an existing row — a name or role edited in-product is not overwritten
 * by a later sign-in.
 */
export interface EnsureAgencyUserInput {
  readonly clerkUserId: string;
  readonly email: string;
  readonly fullName: string;
  /** The session's active Clerk organisation, or null when none is selected. */
  readonly clerkOrgId: string | null;
  /** True when the session's Clerk org role is admin; decides the membership role on creation. */
  readonly isOrgAdmin: boolean;
}

export interface EnsureAgencyUserResult {
  readonly userId: string;
  /** The agency the user was linked to, or null when the org maps to none. */
  readonly agencyId: string | null;
  readonly userCreated: boolean;
  readonly membershipCreated: boolean;
}

/**
 * True when `ensureAgencyUser` would have nothing to do: the users row exists and, if the session's
 * org maps to an agency, the membership does too. ONE query — users LEFT JOIN the org's agency LEFT
 * JOIN the membership — so the steady state (every request after the first) costs a single round trip
 * on the request's connection instead of a Clerk profile fetch plus four sequential queries.
 *
 * "The org maps to no agency" counts as provisioned: `ensureAgencyUser` would create no membership in
 * that case either, so there is no work to skip to.
 */
export async function isAgencyUserProvisioned(
  db: Db,
  input: { readonly clerkUserId: string; readonly clerkOrgId: string | null },
): Promise<boolean> {
  if (input.clerkOrgId === null) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, input.clerkUserId))
      .limit(1);
    return rows[0] !== undefined;
  }
  const rows = await db
    .select({ userId: users.id, agencyId: agencies.id, membershipId: memberships.id })
    .from(users)
    .leftJoin(agencies, and(eq(agencies.clerkOrgId, input.clerkOrgId), isNull(agencies.deletedAt)))
    .leftJoin(
      memberships,
      and(eq(memberships.userId, users.id), eq(memberships.agencyId, agencies.id)),
    )
    .where(eq(users.clerkUserId, input.clerkUserId))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    return false;
  }
  return row.agencyId === null || row.membershipId !== null;
}

export async function ensureAgencyUser(
  db: Db,
  input: EnsureAgencyUserInput,
): Promise<EnsureAgencyUserResult> {
  const before = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, input.clerkUserId))
    .limit(1);
  const existingUser = before[0];

  if (existingUser === undefined) {
    await db
      .insert(users)
      .values({
        clerkUserId: input.clerkUserId,
        email: input.email,
        fullName: input.fullName,
        createdBy: input.clerkUserId,
        updatedBy: input.clerkUserId,
      })
      .onConflictDoNothing({ target: users.clerkUserId });
  }

  // Re-read rather than trust the insert's return: a racing request may have written the row, and
  // `onConflictDoNothing` returns nothing in that case. This read always sees the winning row.
  const after = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, input.clerkUserId))
    .limit(1);
  const user = after[0];
  if (user === undefined) {
    throw new Error('ensureAgencyUser: user row not found after upsert');
  }
  const userId = user.id;
  const userCreated = existingUser === undefined;

  if (input.clerkOrgId === null) {
    return { userId, agencyId: null, userCreated, membershipCreated: false };
  }

  const agencyRows = await db
    .select({ id: agencies.id })
    .from(agencies)
    .where(and(eq(agencies.clerkOrgId, input.clerkOrgId), isNull(agencies.deletedAt)))
    .limit(1);
  const agency = agencyRows[0];
  if (agency === undefined) {
    // The active org is not one of our agencies — a users row, but no tenant access.
    return { userId, agencyId: null, userCreated, membershipCreated: false };
  }
  const agencyId = agency.id;

  const existingMembership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.agencyId, agencyId)))
    .limit(1);

  let membershipCreated = false;
  if (existingMembership[0] === undefined) {
    await db
      .insert(memberships)
      .values({
        userId,
        agencyId,
        role: input.isOrgAdmin ? 'admin' : 'member',
        createdBy: input.clerkUserId,
        updatedBy: input.clerkUserId,
      })
      .onConflictDoNothing({ target: [memberships.userId, memberships.agencyId] });
    membershipCreated = true;
  }

  return { userId, agencyId, userCreated, membershipCreated };
}
