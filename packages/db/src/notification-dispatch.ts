import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  brandAssignments,
  brands,
  notificationLog,
  notificationSettings,
  notificationTriggers,
  users,
  type NotificationTriggerKey,
} from './schema';
import { withBrand } from './tenancy';

/**
 * The database side of the notification bus (PRD §12, P5-005).
 *
 * `resolveRecipients` looks up the brand's team assignment for the trigger's target roles and
 * returns the user details needed to send a DM or email. `logNotification` writes one delivery
 * to the notification log. `markNotificationSent` / `markNotificationFailed` update the log
 * after the API call completes. `dispatchNotification` is the orchestrator that ties them
 * together: given a trigger event it resolves recipients, plans deliveries, and writes them
 * to the log with status `queued`.
 *
 * The actual Slack/Resend API calls are NOT here — they belong in `@tas/integrations` (pending
 * credentials) or in an Inngest job that reads the `queued` rows and fires the APIs.
 */

export interface ResolvedRecipient {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly slackUserId: string | null;
}

export async function resolveRecipients(
  db: Db,
  brandId: string,
  roles: readonly string[],
): Promise<ResolvedRecipient[]> {
  if (roles.length === 0) return [];

  const assignments = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      slackUserId: users.slackUserId,
      role: brandAssignments.role,
    })
    .from(brandAssignments)
    .innerJoin(users, eq(brandAssignments.userId, users.id))
    .where(
      and(
        eq(brandAssignments.brandId, brandId),
        isNull(brandAssignments.deletedAt),
        isNull(users.deletedAt),
      ),
    );

  const matched = assignments.filter((a) => roles.includes(a.role));
  const seen = new Set<string>();
  const result: ResolvedRecipient[] = [];
  for (const a of matched) {
    if (seen.has(a.userId)) continue;
    seen.add(a.userId);
    result.push({
      userId: a.userId,
      fullName: a.fullName,
      email: a.email,
      slackUserId: a.slackUserId,
    });
  }
  return result;
}

export async function getChannelSettings(
  db: Db,
  brandId: string,
  triggerKey: NotificationTriggerKey,
): Promise<{ slackEnabled: boolean; emailEnabled: boolean } | null> {
  const scope = withBrand(db, brandId);
  const [row] = await scope
    .select(notificationSettings, eq(notificationSettings.triggerKey, triggerKey))
    .limit(1);
  if (row === undefined) return null;
  return { slackEnabled: row.slackEnabled, emailEnabled: row.emailEnabled };
}

export interface LogNotificationInput {
  readonly brandId: string;
  readonly triggerKey: string;
  readonly channel: 'slack' | 'email';
  readonly recipientUserId: string;
  readonly recipientName: string;
  readonly message: string;
  readonly deepLink?: string;
}

export async function logNotification(
  db: Db,
  input: LogNotificationInput,
  actorId: string,
): Promise<typeof notificationLog.$inferSelect> {
  const [row] = await db
    .insert(notificationLog)
    .values({
      brandId: input.brandId,
      triggerKey: input.triggerKey,
      channel: input.channel,
      recipientUserId: input.recipientUserId,
      recipientName: input.recipientName,
      message: input.message,
      deepLink: input.deepLink ?? null,
      status: 'queued',
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  if (row === undefined) throw new Error('Notification log insert returned no row');
  return row;
}

export async function markNotificationSent(db: Db, logId: string): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(notificationLog.id, logId));
}

export async function markNotificationFailed(
  db: Db,
  logId: string,
  errorMessage: string,
): Promise<void> {
  await db
    .update(notificationLog)
    .set({ status: 'failed', errorMessage })
    .where(eq(notificationLog.id, logId));
}

/** The trigger vocabulary by key, built once. */
const triggersByKey = new Map(notificationTriggers.map((t) => [t.key, t]));

export interface NotificationEvent {
  readonly triggerKey: NotificationTriggerKey;
  readonly brandId: string;
  readonly brandName: string;
  readonly subjectType: string;
  readonly subjectName: string;
  readonly actorName: string;
  readonly deepLink: string;
}

export interface DispatchResult {
  readonly logIds: string[];
  readonly skipped: boolean;
  readonly reason?: string;
}

/**
 * The orchestrator: given a notification event, resolve recipients from the brand's team
 * assignments, check channel settings, plan deliveries, and write each to the notification
 * log with status `queued`. Returns the log entry IDs for an Inngest job to pick up.
 */
export async function dispatchNotification(
  db: Db,
  event: NotificationEvent,
  actorId: string,
): Promise<DispatchResult> {
  const trigger = triggersByKey.get(event.triggerKey);
  if (!trigger) {
    return { logIds: [], skipped: true, reason: `Unknown trigger: ${event.triggerKey}` };
  }

  const settings = await getChannelSettings(db, event.brandId, event.triggerKey);
  if (!settings) {
    return { logIds: [], skipped: true, reason: 'No notification settings for this brand/trigger' };
  }

  if (!settings.slackEnabled && !settings.emailEnabled) {
    return { logIds: [], skipped: true, reason: 'Both channels disabled' };
  }

  const recipients = await resolveRecipients(db, event.brandId, trigger.recipients);
  if (recipients.length === 0) {
    return { logIds: [], skipped: true, reason: 'No recipients matched the trigger roles' };
  }

  const message = `[${event.brandName}] ${event.subjectType}: ${event.subjectName} — ${event.actorName}`;
  const logIds: string[] = [];

  for (const recipient of recipients) {
    if (settings.slackEnabled && recipient.slackUserId) {
      const entry = await logNotification(
        db,
        {
          brandId: event.brandId,
          triggerKey: event.triggerKey,
          channel: 'slack',
          recipientUserId: recipient.userId,
          recipientName: recipient.fullName,
          message,
          deepLink: event.deepLink,
        },
        actorId,
      );
      logIds.push(entry.id);
    }

    if (settings.emailEnabled && recipient.email) {
      const entry = await logNotification(
        db,
        {
          brandId: event.brandId,
          triggerKey: event.triggerKey,
          channel: 'email',
          recipientUserId: recipient.userId,
          recipientName: recipient.fullName,
          message,
          deepLink: event.deepLink,
        },
        actorId,
      );
      logIds.push(entry.id);
    }
  }

  return {
    logIds,
    skipped: logIds.length === 0,
    reason: logIds.length === 0 ? 'No deliveries planned' : undefined,
  };
}

export type FireNotificationParams = Omit<NotificationEvent, 'brandName'>;

/**
 * Fire-and-forget wrapper: looks up the brand name, calls `dispatchNotification`, and
 * swallows any error so a notification failure never breaks the calling action.
 */
export async function fireNotification(
  db: Db,
  brandId: string,
  actorId: string,
  params: FireNotificationParams,
): Promise<void> {
  try {
    const [row] = await db.select({ name: brands.name }).from(brands).where(eq(brands.id, brandId));
    if (!row) return;
    await dispatchNotification(db, { ...params, brandName: row.name }, actorId);
  } catch {
    // Notifications are fire-and-forget; a failure must never break the server action.
  }
}
