import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { insertRegistryCreator } from '../creator-registry-queries';
import { creatorRegistry } from '../schema';
import { testDb } from '../testing';
import {
  ACTOR,
  IG_REPORT_PATH,
  MIN_GAP_MS,
  igAvatarUrl,
  renderIgReport,
  runIgBackfill,
  type StorePic,
} from './backfill-ig-profile-pics';

const NOW = new Date('2026-10-08T12:00:00.000Z');
const noSleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());

/** Three rows: a candidate, one that already has a picture, one with no handle. */
async function seed() {
  const db = await testDb();
  const candidate = await insertRegistryCreator(db, {
    name: 'Ada Lovelace',
    instagramUsername: '@Ada',
    normalizedInstagram: 'ada',
  });
  const withPic = await insertRegistryCreator(db, {
    name: 'Grace Hopper',
    normalizedInstagram: 'grace',
    profilePicUrl: 'https://r2.example/creator-registry/grace/old.jpg',
  });
  const noHandle = await insertRegistryCreator(db, { name: 'No Handle' });
  return { db, candidate, withPic, noHandle };
}

const okStore: StorePic = (registryId) =>
  Promise.resolve({ ok: true, url: `https://r2.example/creator-registry/${registryId}/pic.jpg` });

describe('igAvatarUrl', () => {
  it('builds the unavatar url with fallback=false so a missing avatar is a 404, not a placeholder', () => {
    expect(igAvatarUrl('ada')).toBe('https://unavatar.io/instagram/ada?fallback=false');
  });
});

describe('runIgBackfill', () => {
  it('dry run counts candidates, calls store for nobody and writes nothing', async () => {
    const { db, candidate } = await seed();
    const store = vi.fn<StorePic>(okStore);

    const summary = await runIgBackfill(db, { apply: false, now: NOW, store, sleep: noSleep });

    expect(summary).toEqual({ candidates: 1, stored: 0, failed: 0, skipped: 1, failures: [] });
    expect(store).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.id, candidate.id));
    expect(row?.profilePicUrl).toBeNull();
    expect(row?.updatedBy).toBeNull();
  });

  it('apply stores for candidates only and stamps the actor; the other rows are untouched', async () => {
    const { db, candidate, withPic, noHandle } = await seed();
    const store = vi.fn<StorePic>(okStore);

    const summary = await runIgBackfill(db, { apply: true, now: NOW, store, sleep: noSleep });

    expect(summary).toMatchObject({ candidates: 1, stored: 1, failed: 0, skipped: 0 });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith(candidate.id, igAvatarUrl('ada'));

    const rows = await db.select().from(creatorRegistry);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(candidate.id)).toMatchObject({
      profilePicUrl: `https://r2.example/creator-registry/${candidate.id}/pic.jpg`,
      updatedBy: ACTOR,
      updatedAt: NOW,
    });
    expect(byId.get(withPic.id)).toMatchObject({
      profilePicUrl: 'https://r2.example/creator-registry/grace/old.jpg',
      updatedBy: null,
    });
    expect(byId.get(noHandle.id)).toMatchObject({ profilePicUrl: null, updatedBy: null });
  });

  it('continues past a failing store, reports it, and a second apply run finds nothing left', async () => {
    const { db, candidate } = await seed();
    const broken = await insertRegistryCreator(db, {
      name: 'Broken',
      normalizedInstagram: 'broken',
    });
    const store = vi.fn<StorePic>((registryId, url) =>
      registryId === broken.id
        ? Promise.resolve({ ok: false, error: 'download failed: HTTP 404' })
        : okStore(registryId, url),
    );

    const first = await runIgBackfill(db, { apply: true, now: NOW, store, sleep: noSleep });

    expect(first).toMatchObject({ candidates: 2, stored: 1, failed: 1 });
    expect(first.failures).toEqual([
      { id: broken.id, handle: 'broken', error: 'download failed: HTTP 404' },
    ]);
    const [stored] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.id, candidate.id));
    expect(stored?.profilePicUrl).not.toBeNull();
    const [failed] = await db
      .select()
      .from(creatorRegistry)
      .where(eq(creatorRegistry.id, broken.id));
    expect(failed?.profilePicUrl).toBeNull();

    store.mockClear();
    const second = await runIgBackfill(db, {
      apply: true,
      now: NOW,
      store: okStore,
      sleep: noSleep,
    });
    // The failed row is still a candidate (it has no picture); the stored one is not.
    expect(second).toMatchObject({ candidates: 1, stored: 1 });
    const third = await runIgBackfill(db, { apply: true, now: NOW, store, sleep: noSleep });
    expect(third.candidates).toBe(0);
    expect(store).not.toHaveBeenCalled();
  });

  it('never touches a soft-deleted row', async () => {
    const { db } = await seed();
    const gone = await insertRegistryCreator(db, { name: 'Gone', normalizedInstagram: 'gone' });
    await db.update(creatorRegistry).set({ deletedAt: NOW }).where(eq(creatorRegistry.id, gone.id));

    const summary = await runIgBackfill(db, {
      apply: false,
      now: NOW,
      store: okStore,
      sleep: noSleep,
    });

    expect(summary.candidates).toBe(1);
  });

  it('waits at least 200 ms between rows, in dry run and in apply', async () => {
    const { db } = await seed();
    await insertRegistryCreator(db, { name: 'Two', normalizedInstagram: 'two' });
    await insertRegistryCreator(db, { name: 'Three', normalizedInstagram: 'three' });
    const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());

    await runIgBackfill(db, { apply: false, now: NOW, store: okStore, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    for (const [ms] of sleep.mock.calls) expect(ms).toBeGreaterThanOrEqual(200);
    expect(MIN_GAP_MS).toBeGreaterThanOrEqual(200);

    sleep.mockClear();
    await runIgBackfill(db, { apply: true, now: NOW, store: okStore, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    for (const [ms] of sleep.mock.calls) expect(ms).toBeGreaterThanOrEqual(200);
  });
});

describe('renderIgReport', () => {
  it('marks a dry run, carries the counts and lists only id, handle and error per failure', () => {
    const report = renderIgReport(
      {
        candidates: 57,
        stored: 0,
        failed: 1,
        skipped: 0,
        failures: [{ id: 'reg-1', handle: 'ada', error: 'download failed | HTTP 404' }],
      },
      { apply: false, startedAt: NOW, finishedAt: new Date(NOW.getTime() + 1000) },
    );

    expect(report).toContain('DRY RUN');
    expect(report).toContain('| 57 | 0 | 1 | 0 |');
    expect(report).toContain('| reg-1 | @ada | download failed \\| HTTP 404 |');
    expect(report).toContain(NOW.toISOString());
    expect(IG_REPORT_PATH).toMatch(/\.audit-oct8\/ig-backfill-report\.md$/u);
    expect(IG_REPORT_PATH).not.toContain('packages');
  });
});
