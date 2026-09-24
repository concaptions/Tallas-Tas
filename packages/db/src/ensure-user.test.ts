import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { ensureAgencyUser } from './ensure-user';
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
