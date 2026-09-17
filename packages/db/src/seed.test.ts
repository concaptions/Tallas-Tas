import { describe, expect, it } from 'vitest';

import { demoBrandAssignments, demoBrands, demoMemberships, demoUsers } from './demo-data';
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
    expect(await db.select().from(brands)).toHaveLength(1 + demoBrands.length);
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

    expect(await db.select().from(users)).toHaveLength(demoUsers.length);
    expect(await db.select().from(memberships)).toHaveLength(demoMemberships.length);
    expect(adminMembership).toMatchObject({ userId: admin.id, agencyId: agency.id, role: 'admin' });
    expect(await db.select().from(brandAssignments)).toHaveLength(demoBrandAssignments.length);
    expect(strategistAssignment).toMatchObject({
      userId: strategist.id,
      brandId: childBrand.id,
      role: 'strategist',
    });
    // The admin is agency-wide: everything they can see comes from the membership, never a row here.
    expect(
      (await db.select().from(brandAssignments)).filter((row) => row.userId === admin.id),
    ).toEqual([]);
  });

  it('seeds the team, the roster brands and their assignments from the fixtures, ids included', async () => {
    const db = await testDb();

    const { rosterBrands } = await seed(db);

    // Every fixture row is in the database unchanged: same ids, same fixed timestamps, no extras.
    expect(await db.select().from(users)).toEqual(expect.arrayContaining(demoUsers));
    expect(rosterBrands.map((brand) => brand.name).sort()).toEqual([
      'Funky Painting',
      'Gratsi',
      'Mattress Central',
    ]);
    expect(rosterBrands.every((brand) => brand.templateBrandId !== null)).toBe(true);
    const assignments = await db.select().from(brandAssignments);
    for (const fixture of demoBrandAssignments) {
      expect(assignments).toContainEqual(expect.objectContaining(fixture));
    }
  });
});
