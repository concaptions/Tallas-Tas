'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { setNotificationChannel } from '@tas/db';
import {
  channelLabel,
  isNotificationChannel,
  isNotificationTriggerKey,
  type NotificationChannel,
  type NotificationTriggerKey,
} from '@tas/domain';
import { z } from 'zod';

import { isDemoMode } from '@/lib/demo-mode';
import { withBrandScope } from '@/lib/notifications-source';
import { notificationsPath } from '@/lib/routes';

/**
 * The Notifications route's only mutation (PRD §12). It follows the house pattern of
 * `interface-config/actions.ts` and `personas/actions.ts` exactly:
 *
 * 1. refuse immediately in DEMO MODE, before any validation, actor lookup, env read or connection —
 *    the demo deployment is unauthenticated, so a write must never reach a database;
 * 2. validate the submission, with the two owners kept apart: ZOD owns the SHAPE (three entries are
 *    present, and `enabled` is one of the two strings a `role="switch"` submits), and `@tas/domain`
 *    owns the VOCABULARY (`isNotificationTriggerKey`, `isNotificationChannel`), so a tampered form
 *    cannot name a ninth trigger or a third channel and no trigger literal is written here;
 * 3. write through the scoped `setNotificationChannel` in `@tas/db`, which puts `brand_id` on the
 *    statement — a trigger belonging to another brand simply never resolves and comes back `null`;
 * 4. revalidate the page and return a typed result. It never throws to the client.
 *
 * WHAT IT DELIBERATELY CANNOT DO: edit routing. There is no recipient, role or person anywhere in
 * this file, and no second action to add one. PRD §12 derives the recipient from the team assignment
 * made at onboarding (§3), so the Recipient column is row data and the only thing a visitor can
 * change on this page is whether a trigger's Slack DM or email is on. `position`, `triggerKey` and
 * the labels are equally not writable: §12 fixes them, which makes them seed data, not settings.
 *
 * WHY THE SWITCH SENDS ITS TARGET VALUE RATHER THAN A FLIP. `enabled` is what the row should BECOME,
 * not "toggle it": a flip applied to a row someone else has since changed would write the wrong
 * value. The channel not named is untouched — §12's two channels are independent, so switching email
 * on must not restate whether Slack is on, and `setNotificationChannel` updates one column only.
 *
 * DEMO MODE DISABLES BOTH SWITCHES (ticket criterion 10). The page renders them through
 * `DisabledWrite` + `disabledWriteClassName` from `@tas/ui` with the tooltip, so this action is only
 * ever reached by a live submission. The refusal below is the belt to that brace — a submission that
 * gets here anyway is still refused before anything is read.
 */

export interface NotificationActionSuccess {
  readonly ok: true;
  /** The trigger written, so the table can reconcile one row without re-reading the page. */
  readonly triggerKey: NotificationTriggerKey;
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  /** Changes with every save, so the page can react to two identical saves in a row. */
  readonly savedAt: number;
}

export interface NotificationActionFailure {
  readonly ok: false;
  readonly error: string;
}

export type NotificationActionResult = NotificationActionSuccess | NotificationActionFailure;

/**
 * The message the write shows when there is no database to write to. The house string, and the same
 * sentence as the tooltip on the disabled switches, so the page says one thing twice rather than two
 * things once.
 */
const DEMO_REFUSAL = 'Sign in required to save changes.';

/** A `role="switch"` submits its next value as a string; nothing else is a boolean here. */
const flag = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

/**
 * The submission's SHAPE only. Which keys and which channels exist is `@tas/domain`'s answer, asked
 * below — zod would otherwise hold a second, drifting copy of §12's eight triggers.
 */
const channelSubmissionSchema = z.object({
  trigger: z.string().min(1).max(64),
  channel: z.string().min(1).max(16),
  enabled: flag,
});

function failure(error: string): NotificationActionFailure {
  return { ok: false, error };
}

function success(
  triggerKey: NotificationTriggerKey,
  channel: NotificationChannel,
  enabled: boolean,
): NotificationActionSuccess {
  return { ok: true, triggerKey, channel, enabled, savedAt: Date.now() };
}

/** Who is writing. Live mode only: in demo mode the action has already returned. */
async function actorId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** `FormData` entries are `FormDataEntryValue | null`; zod sees strings, or nothing. */
function entry(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Switches one channel of one trigger on or off for the brand (PRD §12's two columns).
 *
 * `data-trigger` on the row and the switch's own channel are the whole address: no row id travels,
 * because the trigger key IS the row's identity on this page and the brand scope supplies the rest.
 */
export async function setNotificationChannelAction(
  _previous: NotificationActionResult | null,
  formData: FormData,
): Promise<NotificationActionResult> {
  if (isDemoMode()) {
    return failure(DEMO_REFUSAL);
  }

  const parsed = channelSubmissionSchema.safeParse({
    trigger: entry(formData, 'trigger'),
    channel: entry(formData, 'channel'),
    enabled: entry(formData, 'enabled'),
  });
  if (!parsed.success) {
    return failure('That switch could not be read.');
  }

  const { trigger, channel, enabled } = parsed.data;
  if (!isNotificationTriggerKey(trigger)) {
    return failure('That notification could not be identified.');
  }
  if (!isNotificationChannel(channel)) {
    return failure('That notification channel does not exist.');
  }

  try {
    const actor = await actorId();
    if (actor === null) {
      return failure('Your session has expired. Sign in again to save.');
    }
    const saved = await withBrandScope((db, brandId) =>
      setNotificationChannel(db, brandId, trigger, channel, enabled, actor),
    );
    if (saved === null) {
      return failure('That notification is no longer part of this workspace.');
    }
    revalidatePath(notificationsPath);
    return success(trigger, channel, enabled);
  } catch {
    return failure(`${channelLabel(channel)} could not be saved. Try again.`);
  }
}
