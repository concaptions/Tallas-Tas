import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { insertRegistryCreator } from '../creator-registry-queries';
import { creatorRegistry } from '../schema';
import { testDb } from '../testing';
import type { AirtableCreatorRow } from './airtable-source-bases';
import {
  ACTOR,
  AIRTABLE_PIC_REPORT_PATH,
  parseInventory,
  renderAirtablePicReport,
  runAirtablePicBackfill,
  type StorePic,
} from './backfill-registry-from-airtable';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const AIRTABLE_CDN = 'https://v5.airtableusercontent.com/some/expiring/photo.jpg';

const okStore: StorePic = (registryId) =>
  Promise.resolve({ ok: true, url: `https://r2.example/creator-registry/${registryId}/pic.jpg` });

function inventoryRow(
  overrides: Partial<AirtableCreatorRow> & { airtableId: string },
): AirtableCreatorRow {
  return {
    baseId: 'appOther',
    brandLabel: 'FIXD',
    name: 'Someone',
    instagramUsername: null,
    profilePicUrl: AIRTABLE_CDN,
    ...overrides,
  };
}

describe('runAirtablePicBackfill', () => {
  it('stores the R2 url (never the Airtable url) on an Instagram match with no picture', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, {
      name: 'Different Name',
      normalizedInstagram: 'ada',
    });
    const store = vi.fn<StorePic>(okStore);

    const summary = await runAirtablePicBackfill(
      db,
      [inventoryRow({ airtableId: 'rec1', name: 'Ada Lovelace', instagramUsername: '@ADA' })],
      { apply: true, now: NOW, store },
    );

    expect(summary).toEqual({
      considered: 1,
      matched: 1,
      stored: 1,
      alreadyHadPic: 0,
      unmatched: 0,
      failed: 0,
      failures: [],
    });
    expect(store).toHaveBeenCalledWith(ada.id, AIRTABLE_CDN);
    const [row] = await db.select().from(creatorRegistry).where(eq(creatorRegistry.id, ada.id));
    expect(row).toMatchObject({
      profilePicUrl: `https://r2.example/creator-registry/${ada.id}/pic.jpg`,
      updatedBy: ACTOR,
      updatedAt: NOW,
    });
    expect(row?.profilePicUrl).not.toContain('airtableusercontent');
  });

  it('falls back to a case-insensitive name match, even on a row with no brands', async () => {
    const db = await testDb();
    const grace = await insertRegistryCreator(db, { name: 'Grace Hopper', totalBrands: 0 });

    const summary = await runAirtablePicBackfill(
      db,
      [inventoryRow({ airtableId: 'rec2', name: '  grace HOPPER ' })],
      { apply: true, now: NOW, store: okStore },
    );

    expect(summary).toMatchObject({ matched: 1, stored: 1 });
    const [row] = await db.select().from(creatorRegistry).where(eq(creatorRegistry.id, grace.id));
    expect(row?.profilePicUrl).toBe(`https://r2.example/creator-registry/${grace.id}/pic.jpg`);
  });

  it('skips a match that already has a picture and leaves it as it was', async () => {
    const db = await testDb();
    const existing = 'https://r2.example/creator-registry/x/existing.png';
    const ada = await insertRegistryCreator(db, {
      name: 'Ada',
      normalizedInstagram: 'ada',
      profilePicUrl: existing,
    });
    const store = vi.fn<StorePic>(okStore);

    const summary = await runAirtablePicBackfill(
      db,
      [inventoryRow({ airtableId: 'rec3', name: 'Ada', instagramUsername: 'ada' })],
      { apply: true, now: NOW, store },
    );

    expect(summary).toMatchObject({ considered: 1, matched: 1, stored: 0, alreadyHadPic: 1 });
    expect(store).not.toHaveBeenCalled();
    const [row] = await db.select().from(creatorRegistry).where(eq(creatorRegistry.id, ada.id));
    expect(row).toMatchObject({ profilePicUrl: existing, updatedBy: null });
  });

  it('counts an unmatched row, inserts nothing, and ignores rows with no photo', async () => {
    const db = await testDb();
    await insertRegistryCreator(db, { name: 'Somebody Else', normalizedInstagram: 'else' });
    const store = vi.fn<StorePic>(okStore);

    const summary = await runAirtablePicBackfill(
      db,
      [
        inventoryRow({ airtableId: 'rec4', name: 'Nobody Known', instagramUsername: 'nobody' }),
        inventoryRow({ airtableId: 'rec5', name: 'Somebody Else', profilePicUrl: null }),
      ],
      { apply: true, now: NOW, store },
    );

    expect(summary).toMatchObject({ considered: 1, matched: 0, unmatched: 1, stored: 0 });
    expect(store).not.toHaveBeenCalled();
    expect((await db.select().from(creatorRegistry)).length).toBe(1);
  });

  it('dry run matches and counts but stores and writes nothing', async () => {
    const db = await testDb();
    const ada = await insertRegistryCreator(db, { name: 'Ada', normalizedInstagram: 'ada' });
    const store = vi.fn<StorePic>(okStore);

    const summary = await runAirtablePicBackfill(
      db,
      [inventoryRow({ airtableId: 'rec6', name: 'Ada', instagramUsername: 'ada' })],
      { apply: false, now: NOW, store },
    );

    expect(summary).toMatchObject({ considered: 1, matched: 1, stored: 0, failed: 0 });
    expect(store).not.toHaveBeenCalled();
    const [row] = await db.select().from(creatorRegistry).where(eq(creatorRegistry.id, ada.id));
    expect(row).toMatchObject({ profilePicUrl: null, updatedBy: null });
  });

  it('records a store failure and carries on with the next row', async () => {
    const db = await testDb();
    const broken = await insertRegistryCreator(db, {
      name: 'Broken',
      normalizedInstagram: 'broken',
    });
    const fine = await insertRegistryCreator(db, { name: 'Fine', normalizedInstagram: 'fine' });
    const store = vi.fn<StorePic>((registryId, url) =>
      registryId === broken.id
        ? Promise.resolve({ ok: false, error: 'too large (3000000 bytes > 2097152)' })
        : okStore(registryId, url),
    );

    const summary = await runAirtablePicBackfill(
      db,
      [
        inventoryRow({ airtableId: 'recBroken', name: 'Broken', instagramUsername: 'broken' }),
        inventoryRow({ airtableId: 'recFine', name: 'Fine', instagramUsername: 'fine' }),
      ],
      { apply: true, now: NOW, store },
    );

    expect(summary).toMatchObject({ considered: 2, matched: 2, stored: 1, failed: 1 });
    expect(summary.failures).toEqual([
      { airtableId: 'recBroken', error: 'too large (3000000 bytes > 2097152)' },
    ]);
    const [brokenRow] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.id, broken.id));
    expect(brokenRow?.profilePicUrl).toBeNull();
    const [fineRow] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.id, fine.id));
    expect(fineRow?.profilePicUrl).not.toBeNull();
  });
});

describe('parseInventory', () => {
  it('reads the enumerate script output and rejects a malformed file', () => {
    const inventory = parseInventory(
      JSON.stringify({
        generatedAt: '2026-10-08T00:00:00.000Z',
        bases: [{ baseId: 'appOther' }],
        creators: [
          {
            airtableId: 'rec1',
            baseId: 'appOther',
            brandLabel: 'FIXD',
            name: 'Ada',
            instagramUsername: null,
            profilePicUrl: AIRTABLE_CDN,
          },
        ],
      }),
    );
    expect(inventory.creators).toEqual([
      inventoryRow({ airtableId: 'rec1', name: 'Ada', instagramUsername: null }),
    ]);
    expect(() => parseInventory('{"creators":[]}')).toThrow('generatedAt');
    expect(() => parseInventory('{"generatedAt":"x","creators":[{"airtableId":"rec1"}]}')).toThrow(
      'baseId',
    );
  });
});

describe('renderAirtablePicReport', () => {
  it('marks the mode, carries the counts and lists only the Airtable record id and error', () => {
    const report = renderAirtablePicReport(
      {
        considered: 10,
        matched: 6,
        stored: 4,
        alreadyHadPic: 1,
        unmatched: 4,
        failed: 1,
        failures: [{ airtableId: 'recX', error: 'not an image (text/html)' }],
      },
      { apply: true, startedAt: NOW, finishedAt: NOW, inventoryFile: '/tmp/inventory.json' },
    );

    expect(report).toContain('APPLIED');
    expect(report).toContain('| 10 | 6 | 4 | 1 | 4 | 1 |');
    expect(report).toContain('| recX | not an image (text/html) |');
    expect(AIRTABLE_PIC_REPORT_PATH).toMatch(/\.audit-oct8\/airtable-pic-backfill-report\.md$/u);
    expect(AIRTABLE_PIC_REPORT_PATH).not.toContain('packages');
  });
});
