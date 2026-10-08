import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { insertRegistryCreator } from '../creator-registry-queries';
import { creatorRegistry } from '../schema';
import { testDb } from '../testing';
import type { AirtableCreatorRow } from './airtable-source-bases';
import {
  importInventory,
  type ImportSummary,
  type StorePic,
} from './import-creators-from-airtable';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const FIXD = 'appFIXD000000001';
const NIAG = 'appNIAG000000001';

const row = (over: Partial<AirtableCreatorRow>): AirtableCreatorRow => ({
  airtableId: 'recA',
  baseId: FIXD,
  brandLabel: 'FIXD',
  name: 'Ada Lovelace',
  instagramUsername: null,
  profilePicUrl: null,
  ...over,
});

const storeOk: StorePic = (id, url) =>
  Promise.resolve({ ok: true, url: `r2://creator-registry/${id}/${url.length.toString()}` });
const storeFail: StorePic = () => Promise.resolve({ ok: false, error: 'R2 not configured' });

const ZERO: ImportSummary = {
  matchedByInstagram: 0,
  matchedByName: 0,
  inserted: 0,
  brandsAppended: 0,
  totalBrandsIncremented: 0,
  picsStored: 0,
  picsPending: 0,
  skipped: 0,
  errors: [],
};

async function registryRow(db: Awaited<ReturnType<typeof testDb>>, id: string) {
  const [found] = await db.select().from(creatorRegistry).where(eq(creatorRegistry.id, id));
  if (!found) throw new Error(`registry row ${id} missing`);
  return found;
}

describe('importInventory', () => {
  it('matches by Instagram, appends the brand once and bumps totalBrands once', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, {
      name: 'A. L.',
      normalizedInstagram: 'ada',
      totalBrands: 1,
    });
    const input = [row({ instagramUsername: '@Ada' })];

    const first = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });
    const second = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });

    expect(first).toEqual({
      ...ZERO,
      matchedByInstagram: 1,
      brandsAppended: 1,
      totalBrandsIncremented: 1,
    });
    expect(second).toEqual({ ...ZERO, matchedByInstagram: 1, skipped: 1 });
    const saved = await registryRow(db, ada.id);
    expect(saved.totalBrands).toBe(2);
    expect(saved.brands).toEqual([
      { brandLabel: 'FIXD', sourceAirtableBaseId: FIXD, firstSeenAt: NOW.toISOString() },
    ]);
    expect(saved.instagramUsername).toBe('@Ada');
    expect(saved.updatedBy).toBe('script:import-creators-from-airtable');
  });

  it('matches by name only against a row with brands; a 0-brand namesake gets a new row', async () => {
    const db = await testDb();
    const veteran = await insertRegistryCreator(db, { name: 'Grace Hopper', totalBrands: 1 });
    await insertRegistryCreator(db, { name: 'John Smith', totalBrands: 0 });

    const summary = await importInventory(
      db,
      [
        row({ name: 'grace HOPPER', airtableId: 'rec1' }),
        row({ name: 'John Smith', airtableId: 'rec2' }),
      ],
      { apply: true, now: NOW, storePic: storeOk },
    );

    expect(summary).toEqual({
      ...ZERO,
      matchedByName: 1,
      inserted: 1,
      brandsAppended: 1,
      totalBrandsIncremented: 1,
    });
    expect((await registryRow(db, veteran.id)).totalBrands).toBe(2);
    const smiths = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.name, 'John Smith'));
    expect(smiths).toHaveLength(2);
  });

  it('inserts an unmatched creator as a global row carrying its brand and Airtable id', async () => {
    const db = await testDb();

    const summary = await importInventory(
      db,
      [
        row({
          instagramUsername: 'Ada_L',
          profilePicUrl: 'https://dl.airtable.com/x.jpg',
          airtableId: 'recNEW',
        }),
      ],
      { apply: true, now: NOW, storePic: storeOk },
    );

    expect(summary).toEqual({ ...ZERO, inserted: 1, picsStored: 1 });
    const [saved] = await db.select().from(creatorRegistry);
    expect(saved).toMatchObject({
      brandId: null,
      name: 'Ada Lovelace',
      instagramUsername: 'Ada_L',
      normalizedInstagram: 'ada_l',
      totalBrands: 1,
      legacyAirtableId: 'recNEW',
      createdBy: 'script:import-creators-from-airtable',
      brands: [{ brandLabel: 'FIXD', sourceAirtableBaseId: FIXD, firstSeenAt: NOW.toISOString() }],
    });
    expect(saved?.profilePicUrl).toMatch(/^r2:\/\/creator-registry\//);
  });

  it('stores a pic only when the registry has none, and counts a failed store as pending', async () => {
    const db = await testDb();
    const hasPic = await insertRegistryCreator(db, {
      name: 'P',
      normalizedInstagram: 'haspic',
      profilePicUrl: 'r2://old',
      totalBrands: 1,
    });
    const noPic = await insertRegistryCreator(db, {
      name: 'Q',
      normalizedInstagram: 'nopic',
      totalBrands: 1,
    });
    const store = vi.fn(storeFail);
    const input = [
      row({
        instagramUsername: 'haspic',
        profilePicUrl: 'https://dl.airtable.com/a.jpg',
        airtableId: 'r1',
      }),
      row({
        instagramUsername: 'nopic',
        profilePicUrl: 'https://dl.airtable.com/b.jpg',
        airtableId: 'r2',
      }),
    ];

    const pending = await importInventory(db, input, { apply: true, now: NOW, storePic: store });

    expect(pending).toMatchObject({ matchedByInstagram: 2, picsStored: 0, picsPending: 1 });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith(noPic.id, 'https://dl.airtable.com/b.jpg');
    expect((await registryRow(db, noPic.id)).profilePicUrl).toBeNull();
    expect((await registryRow(db, hasPic.id)).profilePicUrl).toBe('r2://old');

    const stored = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });
    expect(stored).toMatchObject({ picsStored: 1, picsPending: 0, brandsAppended: 0 });
    expect((await registryRow(db, noPic.id)).profilePicUrl).toMatch(/^r2:\/\/creator-registry\//);
  });

  it('is a no-op on the second run, including across two bases for one person', async () => {
    const db = await testDb();
    const input = [
      row({ instagramUsername: 'ada', airtableId: 'recF', baseId: FIXD, brandLabel: 'FIXD' }),
      row({ instagramUsername: 'ADA', airtableId: 'recN', baseId: NIAG, brandLabel: 'Niagara' }),
      row({ name: 'Solo Person', airtableId: 'recS' }),
    ];

    const first = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });
    const second = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });

    expect(first).toEqual({
      ...ZERO,
      inserted: 2,
      matchedByInstagram: 1,
      brandsAppended: 1,
      totalBrandsIncremented: 1,
    });
    expect(second).toEqual({ ...ZERO, matchedByInstagram: 2, matchedByName: 1, skipped: 3 });
    const [ada] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.normalizedInstagram, 'ada'));
    expect(ada?.totalBrands).toBe(2);
    expect(ada?.brands.map((b) => b.brandLabel)).toEqual(['FIXD', 'Niagara']);
  });

  it('dry-run reports the same counts as apply but writes nothing', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, {
      name: 'Ada',
      normalizedInstagram: 'ada',
      totalBrands: 1,
    });
    const input = [
      row({ instagramUsername: 'ada', airtableId: 'r1' }),
      row({ name: 'New Person', airtableId: 'r2', profilePicUrl: 'https://dl.airtable.com/c.jpg' }),
      row({
        name: 'New Person',
        airtableId: 'r3',
        baseId: NIAG,
        brandLabel: 'Niagara',
        instagramUsername: 'np',
      }),
    ];

    const dry = await importInventory(db, input, { apply: false, now: NOW, storePic: storeOk });
    const rowsAfterDry = await db.select().from(creatorRegistry);
    const wet = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });

    expect(dry).toEqual(wet);
    // r1 joins Ada; r2 is new; r3 name-matches the row r2 just inserted (it has one brand now).
    expect(dry).toEqual({
      ...ZERO,
      matchedByInstagram: 1,
      matchedByName: 1,
      inserted: 1,
      brandsAppended: 2,
      totalBrandsIncremented: 2,
      picsStored: 1,
    });
    expect(rowsAfterDry).toHaveLength(1);
    expect(rowsAfterDry[0]).toMatchObject({ id: ada.id, totalBrands: 1, brands: [] });
    expect(await db.select().from(creatorRegistry)).toHaveLength(2);
  });

  it('merges a handle seen twice in one inventory, and records a row it cannot place without stopping', async () => {
    const db = await testDb();
    // A soft-deleted row still owns its handle (unique), but the match never returns it: the only
    // way the insert can hit the constraint after a 'none' match. The row must land in `errors`.
    const ghost = await insertRegistryCreator(db, { name: 'Ghost', normalizedInstagram: 'ghost' });
    await db
      .update(creatorRegistry)
      .set({ deletedAt: NOW })
      .where(eq(creatorRegistry.id, ghost.id));
    const input = [
      row({ instagramUsername: 'dup', airtableId: 'r1', baseId: FIXD, brandLabel: 'FIXD' }),
      row({
        name: 'Ghost Rider',
        instagramUsername: 'ghost',
        airtableId: 'rGHOST',
        profilePicUrl: 'https://dl.airtable.com/g.jpg',
      }),
      row({
        instagramUsername: '@DUP',
        airtableId: 'r2',
        baseId: NIAG,
        brandLabel: 'Niagara',
        name: 'Other Spelling',
      }),
    ];

    const summary = await importInventory(db, input, { apply: true, now: NOW, storePic: storeOk });

    expect(summary).toMatchObject({
      inserted: 1,
      matchedByInstagram: 1,
      brandsAppended: 1,
      totalBrandsIncremented: 1,
      picsStored: 0,
    });
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatch(/^rGHOST Ghost Rider \[FIXD\]: .*unique/);
    const [dup] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.normalizedInstagram, 'dup'));
    expect(dup?.totalBrands).toBe(2);
    expect(dup?.brands.map((b) => b.sourceAirtableBaseId)).toEqual([FIXD, NIAG]);
    expect(await db.select().from(creatorRegistry)).toHaveLength(2);
  });
});
