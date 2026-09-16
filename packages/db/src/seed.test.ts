import { describe, expect, it } from 'vitest';

import { agencies, brandAssignments, brands, healthCheck, memberships, users } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

describe('seed', () => {
  it('applies the migrations, inserts one health_check row and reads it back', async () => {
    const db = await testDb();

    const { healthCheck: seeded } = await seed(db);
    const rows = await db.select().from(healthCheck);

    expect(rows).toEqual([seeded]);
    expect(seeded.note).toBe('seeded by @tas/db db:seed');
  });

  it('fills the shared columns from their defaults', async () => {
    const db = await testDb();

    const { healthCheck: row } = await seed(db);

    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect(row).toMatchObject({ brandId: null, createdBy: null, updatedBy: null, deletedAt: null });
  });

  it('seeds one agency, a template brand and a child brand pointing at it', async () => {
    const db = await testDb();

    const { agency, templateBrand, childBrand } = await seed(db);

    expect(await db.select().from(agencies)).toEqual([agency]);
    expect(agency).toMatchObject({ slug: 'tas-digital', clerkOrgId: null, brandId: null });
    expect(await db.select().from(brands)).toHaveLength(2);
    expect(templateBrand).toMatchObject({
      agencyId: agency.id,
      isTemplate: true,
      templateBrandId: null,
      status: 'active',
      brandId: null,
    });
    expect(childBrand).toMatchObject({
      agencyId: agency.id,
      isTemplate: false,
      templateBrandId: templateBrand.id,
      website: 'https://niagarasleep.example',
      status: 'active',
      brandId: null,
    });
  });

  it('seeds an admin with a membership and a strategist assigned to the child brand', async () => {
    const db = await testDb();

    const { agency, childBrand, admin, strategist, adminMembership, strategistAssignment } =
      await seed(db);

    expect(await db.select().from(users)).toHaveLength(2);
    expect(await db.select().from(memberships)).toEqual([adminMembership]);
    expect(adminMembership).toMatchObject({ userId: admin.id, agencyId: agency.id, role: 'admin' });
    expect(await db.select().from(brandAssignments)).toEqual([strategistAssignment]);
    expect(strategistAssignment).toMatchObject({
      userId: strategist.id,
      brandId: childBrand.id,
      role: 'strategist',
    });
  });
});
