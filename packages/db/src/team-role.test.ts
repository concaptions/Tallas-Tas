import { describe, expect, it } from 'vitest';

import { getActiveBrandRole } from './team';
import { agencies, brandAssignments, brands, memberships, users } from './schema';
import { testDb, type PgliteDb } from './testing';

async function fixture(db: PgliteDb) {
  const [agency] = await db.insert(agencies).values({ name: 'TAS', slug: 'tas' }).returning();
  if (agency === undefined) throw new Error('agency');
  const [brandA, brandB] = await db
    .insert(brands)
    .values([
      { agencyId: agency.id, name: 'Niagara', slug: 'niagara' },
      { agencyId: agency.id, name: 'Gratsi', slug: 'gratsi' },
    ])
    .returning();
  if (brandA === undefined || brandB === undefined) throw new Error('brands');

  const [admin, buyer] = await db
    .insert(users)
    .values([
      { clerkUserId: 'clerk_admin', email: 'admin@tas.test', fullName: 'Ada Admin' },
      { clerkUserId: 'clerk_buyer', email: 'buyer@tas.test', fullName: 'Ben Buyer' },
    ])
    .returning();
  if (admin === undefined || buyer === undefined) throw new Error('users');

  await db.insert(memberships).values({ userId: admin.id, agencyId: agency.id, role: 'admin' });
  await db.insert(memberships).values({ userId: buyer.id, agencyId: agency.id, role: 'member' });
  await db
    .insert(brandAssignments)
    .values({ brandId: brandA.id, userId: buyer.id, role: 'media_buyer' });

  return { db, brandA: brandA.id, brandB: brandB.id };
}

describe('getActiveBrandRole', () => {
  it('is admin for an agency admin, on any brand', async () => {
    const { db, brandA, brandB } = await fixture(await testDb());
    expect(await getActiveBrandRole(db, brandA, 'clerk_admin')).toBe('admin');
    expect(await getActiveBrandRole(db, brandB, 'clerk_admin')).toBe('admin');
  });

  it("is the user's brand-assignment role on the brand they are assigned to", async () => {
    const { db, brandA } = await fixture(await testDb());
    expect(await getActiveBrandRole(db, brandA, 'clerk_buyer')).toBe('media_buyer');
  });

  it('is null on a brand the user has no assignment for', async () => {
    const { db, brandB } = await fixture(await testDb());
    expect(await getActiveBrandRole(db, brandB, 'clerk_buyer')).toBeNull();
  });

  it('is null for a Clerk id with no user row', async () => {
    const { db, brandA } = await fixture(await testDb());
    expect(await getActiveBrandRole(db, brandA, 'clerk_ghost')).toBeNull();
  });
});
