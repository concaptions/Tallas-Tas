import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';
import {
  getChannelSettings,
  logNotification,
  markNotificationFailed,
  markNotificationSent,
  resolveRecipients,
} from './notification-dispatch';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const result = await seed(db);
  return { db, brand: result.templateBrand, settings: result.notificationSettings };
}

describe('resolveRecipients', () => {
  it('returns users matching the given roles for a brand', async () => {
    const { db } = await seeded();

    const recipients = await resolveRecipients(db, DEMO_BRAND_ID, ['csm']);

    expect(recipients.length).toBeGreaterThanOrEqual(1);
    expect(recipients.every((r) => r.userId && r.fullName && r.email)).toBe(true);
  });

  it('returns empty for a role no one holds', async () => {
    const { db } = await seeded();

    const recipients = await resolveRecipients(db, DEMO_BRAND_ID, ['nonexistent_role']);

    expect(recipients).toHaveLength(0);
  });

  it('deduplicates users who hold multiple matching roles', async () => {
    const { db } = await seeded();

    const recipients = await resolveRecipients(db, DEMO_BRAND_ID, [
      'csm',
      'creative_strategist',
      'designer',
    ]);
    const userIds = recipients.map((r) => r.userId);
    expect(new Set(userIds).size).toBe(userIds.length);
  });
});

describe('getChannelSettings', () => {
  it('returns channel settings for an existing trigger', async () => {
    const { db } = await seeded();

    const settings = await getChannelSettings(db, DEMO_BRAND_ID, 'brief_assigned');

    expect(settings).not.toBeNull();
    expect(typeof settings?.slackEnabled).toBe('boolean');
    expect(typeof settings?.emailEnabled).toBe('boolean');
  });

  it('returns null for a trigger that has no settings row', async () => {
    const { db } = await seeded();

    const settings = await getChannelSettings(db, DEMO_BRAND_ID, 'nonexistent_trigger' as never);

    expect(settings).toBeNull();
  });
});

describe('logNotification', () => {
  it('inserts a queued notification log entry', async () => {
    const { db } = await seeded();

    const entry = await logNotification(
      db,
      {
        brandId: DEMO_BRAND_ID,
        triggerKey: 'brief_assigned',
        channel: 'slack',
        recipientUserId: 'user-1',
        recipientName: 'Alice',
        message: 'Test notification',
        deepLink: '/app/briefs/123',
      },
      DEMO_ACTOR_ID,
    );

    expect(entry.id).toBeTruthy();
    expect(entry.status).toBe('queued');
    expect(entry.channel).toBe('slack');
    expect(entry.sentAt).toBeNull();
  });
});

describe('markNotificationSent', () => {
  it('updates status to sent with a timestamp', async () => {
    const { db } = await seeded();

    const entry = await logNotification(
      db,
      {
        brandId: DEMO_BRAND_ID,
        triggerKey: 'brief_assigned',
        channel: 'email',
        recipientUserId: 'user-1',
        recipientName: 'Alice',
        message: 'Test notification',
      },
      DEMO_ACTOR_ID,
    );

    await markNotificationSent(db, entry.id);

    const { notificationLog } = await import('./schema');
    const { eq } = await import('drizzle-orm');
    const [updated] = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.id, entry.id));
    expect(updated?.status).toBe('sent');
    expect(updated?.sentAt).not.toBeNull();
  });
});

describe('markNotificationFailed', () => {
  it('updates status to failed with an error message', async () => {
    const { db } = await seeded();

    const entry = await logNotification(
      db,
      {
        brandId: DEMO_BRAND_ID,
        triggerKey: 'brief_assigned',
        channel: 'slack',
        recipientUserId: 'user-1',
        recipientName: 'Alice',
        message: 'Test notification',
      },
      DEMO_ACTOR_ID,
    );

    await markNotificationFailed(db, entry.id, 'Slack API rate limit');

    const { notificationLog } = await import('./schema');
    const { eq } = await import('drizzle-orm');
    const [updated] = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.id, entry.id));
    expect(updated?.status).toBe('failed');
    expect(updated?.errorMessage).toBe('Slack API rate limit');
  });
});
