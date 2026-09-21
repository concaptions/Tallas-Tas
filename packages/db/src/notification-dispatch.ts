import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db';
import {
  brandAssignments,
  notificationLog,
  notificationSettings,
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
 * after the API call completes.
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
