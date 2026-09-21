/**
 * The notification bus (PRD §12; CLAUDE.md: "Notifications flow through one `dispatch(event,
 * payload)`; Slack, email and in-app are subscribers").
 *
 * This module owns the event vocabulary and the routing decision: given a trigger, the brand's
 * notification settings, and the brand's team assignments, it returns the list of deliveries
 * (who gets what on which channel). The actual API calls (Slack Web API, Resend) live in
 * `@tas/integrations` (pending credentials) and are thin wrappers around these decisions.
 *
 * Pure: no I/O, no env, no database. Tested with fixtures.
 */

import type { NotificationTriggerKey } from './triggers';

export type DeliveryChannel = 'slack' | 'email';

export interface NotificationEvent {
  readonly triggerKey: NotificationTriggerKey;
  readonly brandId: string;
  readonly brandName: string;
  readonly subjectType: string;
  readonly subjectName: string;
  readonly actorName: string;
  readonly deepLink: string;
}

export interface NotificationRecipient {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly slackUserId?: string;
}

export interface ChannelSettings {
  readonly slackEnabled: boolean;
  readonly emailEnabled: boolean;
}

export interface NotificationDelivery {
  readonly channel: DeliveryChannel;
  readonly recipient: NotificationRecipient;
  readonly event: NotificationEvent;
  readonly message: string;
}

function formatMessage(event: NotificationEvent): string {
  return `[${event.brandName}] ${event.subjectType}: ${event.subjectName} — ${event.actorName}`;
}

/**
 * Given a notification event, the brand's channel settings for this trigger, and the resolved
 * recipients, return the list of deliveries to enqueue.
 */
export function planDeliveries(
  event: NotificationEvent,
  settings: ChannelSettings,
  recipients: readonly NotificationRecipient[],
): NotificationDelivery[] {
  const deliveries: NotificationDelivery[] = [];
  const message = formatMessage(event);

  for (const recipient of recipients) {
    if (settings.slackEnabled && recipient.slackUserId) {
      deliveries.push({ channel: 'slack', recipient, event, message });
    }
    if (settings.emailEnabled && recipient.email) {
      deliveries.push({ channel: 'email', recipient, event, message });
    }
  }

  return deliveries;
}
