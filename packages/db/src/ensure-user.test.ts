import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { ensureAgencyUser, isAgencyUserProvisioned } from './ensure-user';
import { agencies, memberships, users } from './schema';
import { testDb } from './testing';

async function seedAgency(db: Awaited<ReturnType<typeof testDb>>, clerkOrgId: string | null) {
  const [agency] = await db
    .insert(agencies)
    .values({ name: 'TAS Digital', slug: `tas-${clerkOrgId ?? 'none'}`, clerkOrgId })
    .returning();
  if (agency === undefined) {
    throw new Error('seed agency failed');
  }
  return agency.id;
}

describe('ensureAgencyUser', () => {
  it('creates a users row and an agency membership on first sight, in the org role', async () => {
    const db = await testDb();
    const agencyId = await seedAgency(db, 'org_abc');

    const result = await ensureAgencyUser(db, {
      clerkUserId: 'user_1',
      email: 'admin@tas.test',
      fullName: 'Ada Admin',
      clerkOrgId: 'org_abc',
      isOrgAdmin: true,
    });

    expect(result.userCreated).toBe(true);
    expect(result.membershipCreated).toBe(true);
    expect(result.agencyId).toBe(agencyId);

    const userRow = await db.select().from(users).where(eq(users.clerkUserId, 'user_1'));
    expect(userRow[0]?.email).toBe('admin@tas.test');
    expect(userRow[0]?.fullName).toBe('Ada Admin');

    const membershipRow = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, result.userId), eq(memberships.agencyId, agencyId)));
    expect(membershipRow[0]?.role).toBe('admin');
  });

  it('gives a non-admin org member the least-privilege member role', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');

    const result = await ensureAgencyUser(db, {
      clerkUserId: 'user_2',
      email: 'member@tas.test',
      fullName: 'Moe Member',
      clerkOrgId: 'org_abc',
      isOrgAdmin: false,
    });

    const membershipRow = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, result.userId));
    expect(membershipRow[0]?.role).toBe('member');
  });

  it('is idempotent: a second sign-in adds no second row and does not overwrite', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');

    await ensureAgencyUser(db, {
      clerkUserId: 'user_1',
      email: 'admin@tas.test',
      fullName: 'Ada Admin',
      clerkOrgId: 'org_abc',
      isOrgAdmin: true,
    });
    const second = await ensureAgencyUser(db, {
      clerkUserId: 'user_1',
      email: 'admin@tas.test',
      fullName: 'Renamed In Clerk',
      clerkOrgId: 'org_abc',
      isOrgAdmin: true,
    });

    expect(second.userCreated).toBe(false);
    expect(second.membershipCreated).toBe(false);

    const allUsers = await db.select().from(users).where(eq(users.clerkUserId, 'user_1'));
    expect(allUsers).toHaveLength(1);
    // The in-product name is not clobbered by a later sign-in.
    expect(allUsers[0]?.fullName).toBe('Ada Admin');

    const allMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, second.userId));
    expect(allMemberships).toHaveLength(1);
  });

  it('creates the user but NO membership when the active org maps to no agency', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc'); // a different org exists, but not the caller's

    const result = await ensureAgencyUser(db, {
      clerkUserId: 'stranger',
      email: 'stranger@example.com',
      fullName: 'Random Person',
      clerkOrgId: 'org_unmapped',
      isOrgAdmin: true,
    });

    expect(result.agencyId).toBeNull();
    expect(result.membershipCreated).toBe(false);
    const membershipRows = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, result.userId));
    expect(membershipRows).toHaveLength(0);
  });

  it('creates the user but no membership when the session carries no org', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');

    const result = await ensureAgencyUser(db, {
      clerkUserId: 'user_3',
      email: 'noorg@tas.test',
      fullName: 'No Org',
      clerkOrgId: null,
      isOrgAdmin: false,
    });

    expect(result.userCreated).toBe(true);
    expect(result.agencyId).toBeNull();
    expect(result.membershipCreated).toBe(false);
  });
});

/**
 * The steady-state check `ensureUser` runs on every request before it would fetch the Clerk profile.
 * It must say "provisioned" exactly when `ensureAgencyUser` would have nothing to write — never
 * earlier, or a real user is left without the membership the Team guard reads.
 */
describe('isAgencyUserProvisioned', () => {
  const admin = {
    clerkUserId: 'user_1',
    email: 'admin@tas.test',
    fullName: 'Ada Admin',
    clerkOrgId: 'org_abc',
    isOrgAdmin: true,
  };

  it('is false for a user never seen, so the first visit still provisions', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');

    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: 'org_abc' }),
    ).resolves.toBe(false);
  });

  it('is true once the user row and the membership both exist', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');
    await ensureAgencyUser(db, admin);

    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: 'org_abc' }),
    ).resolves.toBe(true);
  });

  it('is false when the user row exists but the membership for the active org does not', async () => {
    const db = await testDb();
    await seedAgency(db, 'org_abc');
    // First seen with no active org: a users row, no membership.
    await ensureAgencyUser(db, { ...admin, clerkOrgId: null });

    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: 'org_abc' }),
    ).resolves.toBe(false);
  });

  it('is true for an org that maps to no agency, where there is no membership to create', async () => {
    const db = await testDb();
    await ensureAgencyUser(db, { ...admin, clerkOrgId: 'org_unmapped' });

    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: 'org_unmapped' }),
    ).resolves.toBe(true);
  });

  it('with no active org, is true exactly when the users row exists', async () => {
    const db = await testDb();

    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: null }),
    ).resolves.toBe(false);
    await ensureAgencyUser(db, { ...admin, clerkOrgId: null });
    await expect(
      isAgencyUserProvisioned(db, { clerkUserId: 'user_1', clerkOrgId: null }),
    ).resolves.toBe(true);
  });
});
