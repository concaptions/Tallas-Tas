import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR_ID, DEMO_BRAND_ID, PARTNERSHIP_REFERENCE_DATE } from './demo-data';
import { insertCreator, type CreatorInput } from './creators';
import {
  getExpiringPartnerships,
  getPartnershipsDueForRenewal,
  markSlackNotified,
  renewPartnership,
  runPartnershipScanner,
} from './partnership-scanner';
import { creators, notificationLog } from './schema';
import { seed } from './seed';
import { testDb } from './testing';

const DAY_MS = 86_400_000;

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

async function seeded() {
  const db = await testDb();
  await seed(db);
  return db;
}

function partnershipCreator(overrides: Partial<CreatorInput> = {}): CreatorInput {
  return {
    name: 'Test Creator',
    forPartnershipAds: true,
    partnershipActivity: 'active',
    partnershipActivatedAt: daysFromNow(PARTNERSHIP_REFERENCE_DATE, -30),
    partnershipPeriodDays: 60,
    extensionDays: 0,
    continueWorkingWith: null,
    slackNotified: false,
    currentPeriodStart: null,
    ...overrides,
  };
}

describe('getExpiringPartnerships', () => {
  it('returns active partnerships within the reminder window', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const results = await getExpiringPartnerships(db, { now, reminderDays: 25 });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.partnershipActivity === 'active')).toBe(true);
    expect(results.every((r) => r.forPartnershipAds)).toBe(true);
    expect(results.every((r) => !r.slackNotified)).toBe(true);
  });

  it('excludes partnerships already Slack-notified', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Already Notified',
        partnershipActivatedAt: daysFromNow(now, -55),
        partnershipPeriodDays: 60,
        slackNotified: true,
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getExpiringPartnerships(db, { now, reminderDays: 25 });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(creator.id);
  });

  it('excludes partnerships not yet near the reminder window', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Far Out',
        partnershipActivatedAt: daysFromNow(now, -5),
        partnershipPeriodDays: 90,
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getExpiringPartnerships(db, { now, reminderDays: 25 });
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(creator.id);
  });

  it('uses currentPeriodStart as the effective start when set', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Renewed Creator',
        partnershipActivatedAt: daysFromNow(now, -120),
        partnershipPeriodDays: 30,
        extensionDays: 0,
        currentPeriodStart: daysFromNow(now, -25),
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getExpiringPartnerships(db, { now, reminderDays: 25 });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(creator.id);
  });
});

describe('getPartnershipsDueForRenewal', () => {
  it('returns expired partnerships with continueWorkingWith = true', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Due Renewal',
        partnershipActivatedAt: daysFromNow(now, -90),
        partnershipPeriodDays: 30,
        continueWorkingWith: true,
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getPartnershipsDueForRenewal(db, now);
    const ids = results.map((r) => r.id);
    expect(ids).toContain(creator.id);
  });

  it('excludes partnerships that have not expired', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Still Active',
        partnershipActivatedAt: daysFromNow(now, -10),
        partnershipPeriodDays: 60,
        continueWorkingWith: true,
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getPartnershipsDueForRenewal(db, now);
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(creator.id);
  });

  it('excludes partnerships where continueWorkingWith is false', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Do Not Renew',
        partnershipActivatedAt: daysFromNow(now, -90),
        partnershipPeriodDays: 30,
        continueWorkingWith: false,
      }),
      DEMO_ACTOR_ID,
    );

    const results = await getPartnershipsDueForRenewal(db, now);
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(creator.id);
  });
});

describe('markSlackNotified', () => {
  it('sets slackNotified to true for the creator', async () => {
    const db = await seeded();

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({ name: 'Mark Me' }),
      DEMO_ACTOR_ID,
    );

    expect(creator.slackNotified).toBe(false);

    await markSlackNotified(db, DEMO_BRAND_ID, creator.id);

    const [updated] = await db.select().from(creators).where(eq(creators.id, creator.id));
    expect(updated?.slackNotified).toBe(true);
  });
});

describe('renewPartnership', () => {
  it('resets currentPeriodStart, clears slackNotified, and adopts extensionDays as new period', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Renew Me',
        partnershipActivatedAt: daysFromNow(now, -90),
        partnershipPeriodDays: 60,
        extensionDays: 30,
        slackNotified: true,
        continueWorkingWith: true,
      }),
      DEMO_ACTOR_ID,
    );

    const renewed = await renewPartnership(db, DEMO_BRAND_ID, creator.id, now);

    expect(renewed).not.toBeNull();
    if (renewed === null) throw new Error('unreachable');
    expect(renewed.currentPeriodStart).not.toBeNull();
    if (renewed.currentPeriodStart === null) throw new Error('unreachable');
    expect(renewed.currentPeriodStart.getTime()).toBe(now.getTime());
    expect(renewed.slackNotified).toBe(false);
    expect(renewed.partnershipPeriodDays).toBe(30);
  });

  it('keeps existing partnershipPeriodDays when extensionDays is 0', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'No Extension',
        partnershipActivatedAt: daysFromNow(now, -90),
        partnershipPeriodDays: 60,
        extensionDays: 0,
        continueWorkingWith: true,
      }),
      DEMO_ACTOR_ID,
    );

    const renewed = await renewPartnership(db, DEMO_BRAND_ID, creator.id, now);

    expect(renewed).not.toBeNull();
    if (renewed === null) throw new Error('unreachable');
    expect(renewed.partnershipPeriodDays).toBe(60);
  });

  it('returns null for a non-existent creator', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const result = await renewPartnership(
      db,
      DEMO_BRAND_ID,
      '00000000-0000-0000-0000-000000000099',
      now,
    );

    expect(result).toBeNull();
  });
});

describe('runPartnershipScanner', () => {
  it('notifies expiring partnerships and marks them as Slack-notified', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Scanner Target',
        partnershipActivatedAt: daysFromNow(now, -55),
        partnershipPeriodDays: 60,
      }),
      DEMO_ACTOR_ID,
    );

    const result = await runPartnershipScanner(db, { now, reminderDays: 25 });

    expect(result.notified).toContain(creator.id);

    const [updated] = await db.select().from(creators).where(eq(creators.id, creator.id));
    expect(updated?.slackNotified).toBe(true);
  });

  it('queues notification log entries for expiring partnerships', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Log Check',
        partnershipActivatedAt: daysFromNow(now, -55),
        partnershipPeriodDays: 60,
      }),
      DEMO_ACTOR_ID,
    );

    await runPartnershipScanner(db, { now, reminderDays: 25 });

    const logs = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.triggerKey, 'partnership_expiring'));
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs.every((l) => l.status === 'queued')).toBe(true);
  });

  it('auto-renews expired partnerships with continueWorkingWith = true', async () => {
    const db = await seeded();
    const now = PARTNERSHIP_REFERENCE_DATE;

    const creator = await insertCreator(
      db,
      DEMO_BRAND_ID,
      partnershipCreator({
        name: 'Auto Renew',
        partnershipActivatedAt: daysFromNow(now, -90),
        partnershipPeriodDays: 30,
        extensionDays: 60,
        continueWorkingWith: true,
      }),
      DEMO_ACTOR_ID,
    );

    const result = await runPartnershipScanner(db, { now, reminderDays: 25 });

    expect(result.renewed).toContain(creator.id);

    const [updated] = await db.select().from(creators).where(eq(creators.id, creator.id));
    expect(updated?.currentPeriodStart?.getTime()).toBe(now.getTime());
    expect(updated?.partnershipPeriodDays).toBe(60);
    expect(updated?.slackNotified).toBe(false);
  });
});
