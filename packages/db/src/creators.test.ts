import { sql } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  getCreatorById,
  insertCreator,
  listCreators,
  listPartnershipCreators,
  updateCreator,
  type CreatorInput,
  type CreatorListRow,
} from './creators';
import {
  DEMO_BRAND_ID,
  PARTNERSHIP_REFERENCE_DATE,
  demoCreators,
  demoPartnershipCreators,
} from './demo-data';
import { creators, type Creator } from './schema';
import { seed } from './seed';
import { testDb, type PgliteDb } from './testing';

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/** One demo creator by name, past `noUncheckedIndexedAccess`. */
function demoCreator(name: string): CreatorListRow {
  const row = demoCreators.find((creator) => creator.name === name);
  if (row === undefined) throw new Error(`demoCreators has no ${name}`);
  return row;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `PARTNERSHIP_REFERENCE_DATE` until a fixture's permission lapses, computed here
 * from the three stored inputs. Deliberately a local four-line helper and NOT an import: the real
 * implementation is `partnershipExpiresOn` / `daysUntilPartnershipExpiry` in `packages/domain`, and
 * `@tas/db` does not depend on `@tas/domain` (the edge runs the other way everywhere in this repo).
 * These tests assert what the FIXTURES say, so the domain's own tests and this one cannot both be
 * wrong in the same direction.
 */
function daysLeft(row: CreatorListRow): number {
  const activated = row.partnershipActivatedAt;
  if (activated === null || row.partnershipPeriodDays === null) {
    throw new Error(`${row.name} has no partnership to measure`);
  }
  const lapses = activated.getTime() + (row.partnershipPeriodDays + row.extensionDays) * DAY_MS;
  return Math.round((lapses - PARTNERSHIP_REFERENCE_DATE.getTime()) / DAY_MS);
}

describe('migration 0008 on PGlite', () => {
  it('creates creators with the §5.8 status defaults and the §5.8.1 partnership columns', async () => {
    const { db, brandId } = await seeded();

    const bare = await insertCreator(db, brandId, { name: 'Freshly added creator' }, 'user_test');

    // The three tracks each start at their first domain state, and the qualifier starts off.
    expect(bare).toMatchObject({
      internalCreatorStatus: 'request',
      clientStatus: 'pending_for_approval',
      internalAssetsStatus: 'pending_for_cs_approval',
      forPartnershipAds: false,
      partnershipActivity: 'not_active',
      extensionDays: 0,
    });
    // Every optional column comes back as a clean null, never undefined and never a stray default:
    // a creator added with only a name is the ordinary create, not a degraded row.
    expect(bare).toMatchObject({
      ageBracket: null,
      gender: null,
      profilePicUrl: null,
      platform: [],
      dateOfManagement: null,
      deadline: null,
      budgetPer60s: null,
      creatorCost: null,
      clientNote: null,
      instagramUsername: null,
      partnershipActivatedAt: null,
      partnershipPeriodDays: null,
      continueWorkingWith: null,
      partnershipPricePer30Days: null,
      partnershipNotes: null,
      facebookProfileUrl: null,
    });
  });

  it('seeds the five creator fixtures into the child brand, identical to `demoCreators`', async () => {
    const { db, brandId } = await seeded();

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(await listCreators(db, brandId)).toEqual(demoCreators);
    expect(demoCreators).toHaveLength(5);
  });
});

describe('creator queries', () => {
  it('lists the brand’s five creators, newest edit first', async () => {
    const { db, brandId } = await seeded();

    const rows = await listCreators(db, brandId);

    expect(rows.map((row) => row.name)).toEqual([
      'Danielle Okonkwo',
      'Marcus Delacroix',
      'Priya Raghunathan',
      'Tomás Ferreira',
      'Hannah Whitcombe',
    ]);
    // Ordered by updated_at desc, not by insertion order.
    const updated = rows.map((row) => row.updatedAt.getTime());
    expect(updated).toEqual([...updated].sort((a, b) => b - a));
  });

  it('returns nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const danielle = demoCreator('Danielle Okonkwo');

    expect(await listCreators(db, otherBrandId)).toEqual([]);
    expect(await listPartnershipCreators(db, otherBrandId)).toEqual([]);
    expect(await getCreatorById(db, otherBrandId, danielle.id)).toBeNull();

    await db
      .update(creators)
      .set({ deletedAt: new Date() })
      .where(sql`${creators.id} = ${danielle.id}`);

    expect(await listCreators(db, brandId)).toHaveLength(4);
    expect(await listPartnershipCreators(db, brandId)).toHaveLength(2);
    expect(await getCreatorById(db, brandId, danielle.id)).toBeNull();
  });

  it('another brand’s partnership creator never leaks into this brand’s §5.8.1 list', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    const theirs = await insertCreator(
      db,
      otherBrandId,
      { name: 'Mattress Central’s whitelisted creator', forPartnershipAds: true },
      'user_other',
    );

    expect(theirs.brandId).toBe(otherBrandId);
    expect((await listPartnershipCreators(db, otherBrandId)).map((row) => row.id)).toEqual([
      theirs.id,
    ]);
    expect((await listPartnershipCreators(db, brandId)).map((row) => row.id)).not.toContain(
      theirs.id,
    );
    expect(await getCreatorById(db, brandId, theirs.id)).toBeNull();
  });

  it('lists only the three partnership creators, newest edit first', async () => {
    const { db, brandId } = await seeded();

    const rows = await listPartnershipCreators(db, brandId);

    expect(rows).toEqual(demoPartnershipCreators);
    expect(rows.map((row) => row.name)).toEqual([
      'Danielle Okonkwo',
      'Marcus Delacroix',
      'Priya Raghunathan',
    ]);
    expect(rows.every((row) => row.forPartnershipAds)).toBe(true);
    // The two creators who were never whitelisted are absent from the list, present in the grid.
    expect(await listCreators(db, brandId)).toHaveLength(5);
  });

  it('follows the qualifier: flipping `forPartnershipAds` moves a creator in and out of the list', async () => {
    const { db, brandId } = await seeded();
    const tomas = demoCreator('Tomás Ferreira');

    await updateCreator(
      db,
      brandId,
      tomas.id,
      { forPartnershipAds: true, instagramUsername: '@tomas.ferreira.ugc' },
      'user_test',
    );

    const rows = await listPartnershipCreators(db, brandId);
    expect(rows).toHaveLength(4);
    // He was just edited, so he is now the newest and sorts first.
    expect(rows[0]?.name).toBe('Tomás Ferreira');

    await updateCreator(db, brandId, tomas.id, { forPartnershipAds: false }, 'user_test');
    expect(await listPartnershipCreators(db, brandId)).toHaveLength(3);
  });

  it('reads one creator by id, with the null picture and null partnership reading back cleanly', async () => {
    const { db, brandId } = await seeded();
    const tomas = demoCreator('Tomás Ferreira');

    const row = await getCreatorById(db, brandId, tomas.id);

    expect(row).toEqual(tomas);
    expect(row).toMatchObject({
      profilePicUrl: null,
      videoIntroUrl: null,
      instagramUsername: null,
      partnershipActivatedAt: null,
      partnershipPeriodDays: null,
      continueWorkingWith: null,
    });
  });

  it('insertCreator forces brand_id to the scope, whatever the payload says', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    // The type has no `brandId`; the cast is the smuggling attempt a parsed CSV row would make.
    const smuggled = {
      name: 'Smuggled creator',
      brandId: otherBrandId,
      platform: ['Billo'],
    } as unknown as CreatorInput;

    const row = await insertCreator(db, brandId, smuggled, 'user_test');

    expect(row).toMatchObject({
      brandId,
      name: 'Smuggled creator',
      platform: ['Billo'],
      createdBy: 'user_test',
      updatedBy: 'user_test',
    });
    expect(await listCreators(db, brandId)).toHaveLength(6);
    expect(await listCreators(db, otherBrandId)).toEqual([]);
  });

  it('updateCreator cannot touch another brand’s row', async () => {
    const { db, brandId, otherBrandId } = await seeded();
    const target = demoCreator('Marcus Delacroix');

    const escaped = await updateCreator(db, otherBrandId, target.id, { creatorCost: 1 }, 'thief');
    const own = await updateCreator(db, brandId, target.id, { extensionDays: 60 }, 'user_test');

    expect(escaped).toBeNull();
    expect(own).toMatchObject({
      id: target.id,
      brandId,
      extensionDays: 60,
      updatedBy: 'user_test',
    });
    expect(own?.updatedAt.getTime()).toBeGreaterThan(target.updatedAt.getTime());
  });
});

describe('the partnership fixtures', () => {
  it('are pinned to `PARTNERSHIP_REFERENCE_DATE`: 3 days, 20 days and long lapsed', () => {
    expect(daysLeft(demoCreator('Danielle Okonkwo'))).toBe(3);
    expect(daysLeft(demoCreator('Marcus Delacroix'))).toBe(20);
    expect(daysLeft(demoCreator('Priya Raghunathan'))).toBeLessThan(0);
  });

  it('spend the extension: Marcus was whitelisted first and still lapses last', () => {
    const danielle = demoCreator('Danielle Okonkwo');
    const marcus = demoCreator('Marcus Delacroix');

    expect(marcus.partnershipActivatedAt?.getTime()).toBeLessThan(
      danielle.partnershipActivatedAt?.getTime() ?? 0,
    );
    expect(marcus.extensionDays).toBe(30);
    expect(danielle.extensionDays).toBe(0);
    expect(daysLeft(marcus)).toBeGreaterThan(daysLeft(danielle));
  });

  it('carry the three activity states and never call the clock at module scope', () => {
    expect(demoPartnershipCreators.map((row) => row.partnershipActivity)).toEqual([
      'active',
      'active',
      'ended',
    ]);
    // Every id is a hardcoded uuid, so the seed's rows and the fixtures are the same rows.
    for (const row of demoCreators) {
      expect(row.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(row.brandId).toBe(DEMO_BRAND_ID);
    }
  });

  it('render offline: every picture is an inline data URI, and exactly one creator has none', () => {
    const pictures = demoCreators.map((row) => row.profilePicUrl);

    expect(pictures.filter((url) => url === null)).toHaveLength(1);
    for (const url of pictures.filter((value) => value !== null)) {
      expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(url).not.toMatch(/^https?:/);
    }
  });

  it('cover five client-facing states, five age brackets and every sourcing platform', () => {
    expect(new Set(demoCreators.map((row) => row.clientStatus)).size).toBe(5);
    expect(new Set(demoCreators.map((row) => row.ageBracket)).size).toBe(5);
    expect(demoCreators.map((row) => row.platform)).toEqual([
      ['Direct Management'],
      ['Insense'],
      ['Billo'],
      ['Fiverr'],
      ['Backstage'],
    ]);
    expect(new Set(demoCreators.map((row) => row.gender)).size).toBeGreaterThan(2);
  });
});

describe('the creator row type', () => {
  it('is one type for demo fixtures and database rows', async () => {
    const { db, brandId } = await seeded();

    expectTypeOf(demoCreators).toEqualTypeOf<CreatorListRow[]>();
    expectTypeOf(await listCreators(db, brandId)).toEqualTypeOf<CreatorListRow[]>();
    expectTypeOf(await listPartnershipCreators(db, brandId)).toEqualTypeOf<CreatorListRow[]>();
    expectTypeOf<CreatorListRow>().toExtend<Creator>();
    // `brand_id` and the audit columns are the scope's, never the form's.
    expectTypeOf<CreatorInput>().not.toHaveProperty('brandId');
    expectTypeOf<CreatorInput>().not.toHaveProperty('createdBy');
    expectTypeOf<CreatorInput>().toHaveProperty('forPartnershipAds');
    expectTypeOf<CreatorInput>().toHaveProperty('partnershipPeriodDays');
  });
});
