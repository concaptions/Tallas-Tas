import { eq } from 'drizzle-orm';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { DEMO_ACTOR_ID, DEMO_BRAND_ID, demoNotifications } from './demo-data';
import {
  listNotificationSettings,
  listNotifications,
  setChannel,
  setNotificationChannel,
  type NotificationSettingRow,
} from './notifications';
import {
  brandRoles,
  notificationSettings,
  notificationTriggers,
  type NotificationSetting,
  type NotificationTriggerKey,
} from './schema';
import { seed } from './seed';
import { withBrand } from './tenancy';
import { testDb, type PgliteDb } from './testing';

/** A fresh database with every migration applied and the demo content seeded into the child brand. */
async function seeded(): Promise<{ db: PgliteDb; brandId: string; otherBrandId: string }> {
  const db = await testDb();
  const { childBrand, templateBrand } = await seed(db);
  return { db, brandId: childBrand.id, otherBrandId: templateBrand.id };
}

/** PRD §12's bullet list, in the PRD's own order: what the table must read, top to bottom. */
const PRD_12_LABELS = [
  'Brief assigned to an editor or designer',
  'Revisions requested internally',
  'Ad submitted',
  'Client approved a concept, creative, copy or creator',
  'Client requested revisions',
  'Creative approved internally and ready to launch',
  'Creator status changed',
  'Partnership permission expiring in 5 days',
];

describe('migration 0011 on PGlite', () => {
  it('seeds PRD §12’s eight triggers in order, identical to the fixtures', async () => {
    const { db, brandId } = await seeded();

    const rows = await listNotificationSettings(db, brandId);

    expect(brandId).toBe(DEMO_BRAND_ID);
    expect(rows).toEqual(demoNotifications);
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => row.label)).toEqual(PRD_12_LABELS);
    expect(rows.map((row) => row.position)).toEqual([...Array(8).keys()]);
  });

  it('defaults every trigger to Slack on and email off (§12: Slack is the channel)', async () => {
    const { db, brandId } = await seeded();

    const rows = await listNotificationSettings(db, brandId);

    expect(rows.every((row) => row.slackEnabled)).toBe(true);
    expect(rows.every((row) => row.emailEnabled)).toBe(false);
    // The column defaults say the same thing, so a row written without the flags lands the same way.
    const [written] = await withBrand(db, brandId)
      .insert(notificationSettings, { triggerKey: 'ad_submitted', position: 8 })
      .returning();
    expect(written).toMatchObject({ slackEnabled: true, emailEnabled: false });
  });

  it('routes every trigger to PRD §11 roles, never to a name or a new role', async () => {
    const { db, brandId } = await seeded();

    const rows = await listNotificationSettings(db, brandId);

    expect(rows.map((row) => row.recipientLabel)).toEqual([
      'Video Editor / Designer',
      'Video Editor / Designer',
      'Strategist + CSM',
      'CSM + Strategist',
      'CSM + Strategist',
      'Media Buyer',
      // §12's seventh bullet DMs "the UGC manager", a role §11 does not have. The label keeps the
      // PRD's recipient and names the role it actually resolves to, so neither half is hidden.
      'UGC Manager (Strategist)',
      'Media Buyer + CSM',
    ]);
    expect(rows.every((row) => row.recipients.length > 0)).toBe(true);
    for (const row of rows) {
      for (const role of row.recipients) {
        expect(brandRoles).toContain(role);
      }
    }
  });
});

describe('notification settings queries', () => {
  it('orders by position, whatever order the rows were written in', async () => {
    const { db, brandId } = await seeded();
    // Written last, positioned first: `position` decides, not insertion order or the clock.
    await withBrand(db, brandId)
      .insert(notificationSettings, { triggerKey: 'client_approved', position: -1 })
      .returning();

    const rows = await listNotificationSettings(db, brandId);

    expect(rows.map((row) => row.position)).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(rows[0]?.triggerKey).toBe('client_approved');
  });

  it('returns a row whose trigger key is no longer in the tuple with a null label, not a throw', async () => {
    const { db, brandId } = await seeded();
    // `trigger_key` is plain `text` precisely so a retired trigger can still be stored; the cast is
    // the test writing a key the current vocabulary does not have, which is the case under test.
    const retired = 'creator_offboarded' as NotificationTriggerKey;
    await withBrand(db, brandId)
      .insert(notificationSettings, { triggerKey: retired, position: 8 })
      .returning();

    const rows = await listNotificationSettings(db, brandId);
    const stale = rows.at(-1);

    expect(rows).toHaveLength(9);
    expect(stale).toMatchObject({ triggerKey: retired, label: null, recipientLabel: null });
    expect(stale?.recipients).toEqual([]);
    // Every known row is unaffected: one unknown key does not degrade the other eight.
    expect(rows.slice(0, 8)).toEqual(demoNotifications);
  });

  it('reads nothing for another brand, and nothing once a row is soft-deleted', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(await listNotificationSettings(db, otherBrandId)).toEqual([]);

    await db
      .update(notificationSettings)
      .set({ deletedAt: new Date() })
      .where(eq(notificationSettings.triggerKey, 'ad_submitted'));

    const rows = await listNotificationSettings(db, brandId);
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.triggerKey)).not.toContain('ad_submitted');
  });

  it('setChannel switches one channel and leaves the other, the row’s siblings and the order alone', async () => {
    const { db, brandId } = await seeded();

    const email = await setChannel(db, brandId, 'ad_submitted', 'email', true, DEMO_ACTOR_ID);
    const slack = await setChannel(db, brandId, 'ad_submitted', 'slack', false, DEMO_ACTOR_ID);
    const rows = await listNotificationSettings(db, brandId);

    expect(email).toMatchObject({
      triggerKey: 'ad_submitted',
      emailEnabled: true,
      slackEnabled: true,
    });
    expect(slack).toMatchObject({
      triggerKey: 'ad_submitted',
      emailEnabled: true,
      slackEnabled: false,
    });
    expect(slack?.updatedBy).toBe(DEMO_ACTOR_ID);
    expect(slack?.label).toBe('Ad submitted');
    expect(rows.map((row) => row.triggerKey)).toEqual(
      demoNotifications.map((row) => row.triggerKey),
    );
    expect(rows.filter((row) => row.emailEnabled)).toHaveLength(1);
    expect(rows.filter((row) => row.slackEnabled)).toHaveLength(7);
  });

  it('setChannel returns null for another brand and for a trigger the brand has no row for', async () => {
    const { db, brandId, otherBrandId } = await seeded();

    expect(
      await setChannel(db, otherBrandId, 'client_approved', 'slack', false, 'thief'),
    ).toBeNull();
    const unknown = 'creator_offboarded' as NotificationTriggerKey;
    expect(await setChannel(db, brandId, unknown, 'email', true, DEMO_ACTOR_ID)).toBeNull();

    // The seeded brand is untouched by either write.
    expect(await listNotificationSettings(db, brandId)).toEqual(demoNotifications);
  });

  it('exposes one row type and one statement under both names the app imports', async () => {
    const { db, brandId } = await seeded();

    expect(listNotifications).toBe(listNotificationSettings);
    expect(setNotificationChannel).toBe(setChannel);
    expect(await listNotifications(db, brandId)).toEqual(demoNotifications);
    expectTypeOf(demoNotifications).toEqualTypeOf<NotificationSettingRow[]>();
    expectTypeOf(await listNotificationSettings(db, brandId)).toEqualTypeOf<
      NotificationSettingRow[]
    >();
    expectTypeOf<NotificationSettingRow>().toExtend<NotificationSetting>();
    expectTypeOf<NotificationSettingRow['triggerKey']>().toEqualTypeOf<NotificationTriggerKey>();
    expect(notificationTriggers.map((trigger) => trigger.key)).toEqual(
      demoNotifications.map((row) => row.triggerKey),
    );
  });
});
