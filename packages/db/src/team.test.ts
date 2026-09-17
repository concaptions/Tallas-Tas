import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  DEMO_ACTOR_ID,
  DEMO_ADMIN_ACTOR_ID,
  DEMO_TEAM_DUAL_ROLE_NAME,
  demoTeam,
} from './demo-data';
import { agencies, brandAssignments, brands, memberships, users } from './schema';
import { seed } from './seed';
import { listTeam, listTeamMembers, type TeamListRow } from './team';
import { testDb, type PgliteDb } from './testing';

/** A fresh database with every migration applied and the demo agency, brands and people seeded. */
async function seeded(): Promise<{ db: PgliteDb; agencyId: string; childBrandId: string }> {
  const db = await testDb();
  const { agency, childBrand } = await seed(db);
  return { db, agencyId: agency.id, childBrandId: childBrand.id };
}

/** The seeded row for one person, past `noUncheckedIndexedAccess`. */
function person(rows: TeamListRow[], fullName: string): TeamListRow {
  const row = rows.find((candidate) => candidate.fullName === fullName);
  if (row === undefined) throw new Error(`no team row for ${fullName}`);
  return row;
}

/**
 * A second agency with its own brand, its own member and an assignment — the rows that must never
 * appear in, or leak a brand name into, the first agency's team. Returns what the leak assertions
 * need to name.
 */
async function rivalAgency(db: PgliteDb): Promise<{ agencyId: string; brandId: string }> {
  const [agency] = await db
    .insert(agencies)
    .values({ name: 'Rival Creative', slug: 'rival-creative' })
    .returning();
  if (agency === undefined) throw new Error('rival agency insert returned no row');
  const [brand] = await db
    .insert(brands)
    .values({ agencyId: agency.id, name: 'Aardvark Coffee', slug: 'aardvark-coffee' })
    .returning();
  if (brand === undefined) throw new Error('rival brand insert returned no row');
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: 'user_rival_member',
      email: 'rival@rivalcreative.example',
      fullName: 'Aaron Rivalson',
    })
    .returning();
  if (user === undefined) throw new Error('rival user insert returned no row');
  await db.insert(memberships).values({ userId: user.id, agencyId: agency.id, role: 'member' });
  await db
    .insert(brandAssignments)
    .values({ userId: user.id, brandId: brand.id, role: 'strategist' });
  return { agencyId: agency.id, brandId: brand.id };
}

describe('listTeam', () => {
  it('returns exactly the demo fixtures for a seeded database', async () => {
    const { db, agencyId } = await seeded();

    expect(await listTeam(db, agencyId)).toEqual(demoTeam);
  });

  it('orders by full name and never by insertion order', async () => {
    const { db, agencyId } = await seeded();

    const rows = await listTeam(db, agencyId);

    expect(rows.map((row) => row.fullName)).toEqual([
      'Callum Ashworth',
      'Dorian Vance',
      'Imogen Bardsley',
      'Marguerite Alaoui',
      'Rhiannon Okafor',
    ]);
  });

  it('gives the admin no brand assignments, so the page can read that as every brand', async () => {
    const { db, agencyId } = await seeded();

    const rows = await listTeam(db, agencyId);
    const admin = person(rows, 'Marguerite Alaoui');

    expect(admin.clerkUserId).toBe(DEMO_ADMIN_ACTOR_ID);
    expect(admin.role).toBe('admin');
    expect(admin.roles).toEqual(['admin']);
    expect(admin.brandNames).toEqual([]);
  });

  it('gives a member only their own brands, alphabetical and de-duplicated', async () => {
    const { db, agencyId } = await seeded();

    const rows = await listTeam(db, agencyId);

    expect(person(rows, 'Dorian Vance')).toMatchObject({
      clerkUserId: DEMO_ACTOR_ID,
      role: 'strategist',
      roles: ['strategist'],
      brandNames: ['Gratsi', 'Mattress Central', 'Niagara Sleep Solutions'],
    });
    expect(person(rows, 'Rhiannon Okafor').brandNames).toEqual([
      'Mattress Central',
      'Niagara Sleep Solutions',
    ]);
  });

  it('returns both roles of the person who wears two hats, in vocabulary order, brands once each', async () => {
    const { db, agencyId } = await seeded();

    const dual = person(await listTeam(db, agencyId), DEMO_TEAM_DUAL_ROLE_NAME);

    expect(dual.roles).toEqual(['csm', 'media_buyer']);
    expect(dual.role).toBe('csm');
    // Two roles on Gratsi and on Mattress Central, and each brand named once all the same.
    expect(dual.brandNames).toEqual([
      'Funky Painting',
      'Gratsi',
      'Mattress Central',
      'Niagara Sleep Solutions',
    ]);
  });

  it('never leaks another agency: not its people, and not its brand names on a shared person', async () => {
    const { db, agencyId } = await seeded();
    const rival = await rivalAgency(db);
    const dorian = person(await listTeam(db, agencyId), 'Dorian Vance');
    // The same person moonlighting on the other agency's brand — the row that would leak a name.
    await db
      .insert(brandAssignments)
      .values({ userId: dorian.id, brandId: rival.brandId, role: 'strategist' });

    const rows = await listTeam(db, agencyId);

    expect(rows.map((row) => row.fullName)).not.toContain('Aaron Rivalson');
    expect(person(rows, 'Dorian Vance').brandNames).toEqual([
      'Gratsi',
      'Mattress Central',
      'Niagara Sleep Solutions',
    ]);
    // And the other way round: the rival's team is only their own person.
    expect((await listTeam(db, rival.agencyId)).map((row) => row.fullName)).toEqual([
      'Aaron Rivalson',
    ]);
  });

  it('falls back to the agency role for a member with no assignment, and reads the join as empty', async () => {
    const { db, agencyId } = await seeded();
    const [newcomer] = await db
      .insert(users)
      .values({
        clerkUserId: 'user_seed_newcomer',
        email: 'newcomer@tasdigital.example',
        fullName: 'Aoife Brennan',
      })
      .returning();
    if (newcomer === undefined) throw new Error('newcomer insert returned no row');
    await db.insert(memberships).values({ userId: newcomer.id, agencyId, role: 'member' });

    const row = person(await listTeam(db, agencyId), 'Aoife Brennan');

    expect(row.brandNames).toEqual([]);
    expect(row.roles).toEqual(['member']);
    expect(row.role).toBe('member');
    // Invited and never signed in: the null the Team page renders as "Never", not a zero date.
    expect(row.lastActiveAt).toBeNull();
  });

  it('skips a user with no membership, so a client never appears in the team', async () => {
    const { db, agencyId, childBrandId } = await seeded();
    const [client] = await db
      .insert(users)
      .values({
        clerkUserId: 'user_seed_client',
        email: 'buyer@niagarasleep.example',
        fullName: 'Aled Pritchard',
      })
      .returning();
    if (client === undefined) throw new Error('client insert returned no row');
    await db
      .insert(brandAssignments)
      .values({ userId: client.id, brandId: childBrandId, role: 'client' });

    expect((await listTeam(db, agencyId)).map((row) => row.fullName)).not.toContain(
      'Aled Pritchard',
    );
  });

  it('drops a soft-deleted person, and a soft-deleted assignment drops only that brand', async () => {
    const { db, agencyId } = await seeded();
    const rows = await listTeam(db, agencyId);
    const imogen = person(rows, 'Imogen Bardsley');
    const rhiannon = person(rows, 'Rhiannon Okafor');
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, rhiannon.id));
    const [gratsi] = await db.select().from(brands).where(eq(brands.name, 'Gratsi'));
    if (gratsi === undefined) throw new Error('no Gratsi brand');
    await db
      .update(brandAssignments)
      .set({ deletedAt: new Date() })
      .where(eq(brandAssignments.brandId, gratsi.id));

    const after = await listTeam(db, agencyId);

    expect(after.map((row) => row.fullName)).not.toContain('Rhiannon Okafor');
    expect(person(after, 'Imogen Bardsley').brandNames).toEqual([
      'Funky Painting',
      'Niagara Sleep Solutions',
    ]);
    expect(imogen.brandNames).toContain('Gratsi');
  });

  it('is `listTeamMembers` under its other name', async () => {
    const { db, agencyId } = await seeded();

    expect(listTeamMembers).toBe(listTeam);
    expect(await listTeamMembers(db, agencyId)).toEqual(demoTeam);
  });
});
