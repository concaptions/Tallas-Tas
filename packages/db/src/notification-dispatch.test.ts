import { describe, expect, it } from 'vitest';

import { DEMO_ACTOR_ID, DEMO_BRAND_ID } from './demo-data';
import {
  dispatchNotification,
  getChannelSettings,
  logNotification,
  markNotificationFailed,
  markNotificationSent,
  resolveRecipients,
  type NotificationEvent,
} from './notification-dispatch';
import { seed } from './seed';
import { testDb } from './testing';

async function seeded() {
  const db = await testDb();
  const result = await seed(db);
  return { db, brand: result.templateBrand, settings: result.notificationSettings };
}

function makeEvent(overrides?: Partial<NotificationEvent>): NotificationEvent {
  return {
    triggerKey: 'ad_submitted',
    brandId: DEMO_BRAND_ID,
    brandName: 'Demo Brand',
    subjectType: 'Brief',
    subjectName: 'Summer Campaign',
    actorName: 'Talal',
    deepLink: '/app/briefs/123',
    ...overrides,
  };
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

describe('dispatchNotification', () => {
  it('logs queued deliveries for recipients matching the trigger roles', async () => {
    const { db } = await seeded();
    const event = makeEvent({ triggerKey: 'ad_submitted' });

    const result = await dispatchNotification(db, event, DEMO_ACTOR_ID);

    expect(result.skipped).toBe(false);
    expect(result.logIds.length).toBeGreaterThanOrEqual(1);

    const { notificationLog } = await import('./schema');
    const { eq } = await import('drizzle-orm');
    for (const logId of result.logIds) {
      const [row] = await db.select().from(notificationLog).where(eq(notificationLog.id, logId));
      expect(row?.status).toBe('queued');
      expect(row?.triggerKey).toBe('ad_submitted');
      expect(row?.brandId).toBe(DEMO_BRAND_ID);
      expect(row?.message).toContain('Demo Brand');
      expect(row?.deepLink).toBe('/app/briefs/123');
    }
  });

  it('skips when both channels are disabled', async () => {
    const { db } = await seeded();
    const { setChannel } = await import('./notifications');
    await setChannel(db, DEMO_BRAND_ID, 'ad_submitted', 'slack', false, DEMO_ACTOR_ID);
    await setChannel(db, DEMO_BRAND_ID, 'ad_submitted', 'email', false, DEMO_ACTOR_ID);

    const result = await dispatchNotification(db, makeEvent(), DEMO_ACTOR_ID);

    expect(result.skipped).toBe(true);
    expect(result.logIds).toHaveLength(0);
    expect(result.reason).toContain('disabled');
  });

  it('skips for an unknown trigger key', async () => {
    const { db } = await seeded();
    const event = makeEvent({ triggerKey: 'nonexistent_trigger' as never });

    const result = await dispatchNotification(db, event, DEMO_ACTOR_ID);

    expect(result.skipped).toBe(true);
    expect(result.reason).toContain('Unknown trigger');
  });

  it('skips for a brand with no notification settings', async () => {
    const { db } = await seeded();
    const event = makeEvent({ brandId: '00000000-0000-0000-0000-000000000000' });

    const result = await dispatchNotification(db, event, DEMO_ACTOR_ID);

    expect(result.skipped).toBe(true);
  });

  it('logs only slack when email is disabled (the default)', async () => {
    const { db } = await seeded();
    const event = makeEvent({ triggerKey: 'brief_assigned' });

    const result = await dispatchNotification(db, event, DEMO_ACTOR_ID);

    const { notificationLog } = await import('./schema');
    const { eq, and: andOp } = await import('drizzle-orm');
    const rows = await Promise.all(
      result.logIds.map(async (id) => {
        const [row] = await db
          .select()
          .from(notificationLog)
          .where(andOp(eq(notificationLog.id, id)));
        return row;
      }),
    );
    for (const row of rows) {
      expect(row?.channel).toBe('slack');
    }
  });

  it('logs both channels when email is enabled', async () => {
    const { db } = await seeded();
    const { setChannel } = await import('./notifications');
    await setChannel(db, DEMO_BRAND_ID, 'ad_submitted', 'email', true, DEMO_ACTOR_ID);
    const event = makeEvent({ triggerKey: 'ad_submitted' });

    const result = await dispatchNotification(db, event, DEMO_ACTOR_ID);

    const { notificationLog } = await import('./schema');
    const { eq } = await import('drizzle-orm');
    const channels = new Set<string>();
    for (const id of result.logIds) {
      const [row] = await db.select().from(notificationLog).where(eq(notificationLog.id, id));
      if (row) channels.add(row.channel);
    }
    expect(channels.has('slack') || channels.has('email')).toBe(true);
  });
});
