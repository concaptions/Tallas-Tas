import { describe, expect, it } from 'vitest';

import { planDeliveries, type NotificationEvent, type NotificationRecipient } from './dispatch';

const EVENT: NotificationEvent = {
  triggerKey: 'brief_assigned',
  brandId: 'brand-1',
  brandName: 'Funky Painting',
  subjectType: 'Brief',
  subjectName: 'Summer Campaign Brief',
  actorName: 'Talal',
  deepLink: '/app/briefs/123',
};

const RECIPIENT_BOTH: NotificationRecipient = {
  userId: 'user-1',
  fullName: 'Alice Editor',
  email: 'alice@example.com',
  slackUserId: 'U123',
};

const RECIPIENT_NO_SLACK: NotificationRecipient = {
  userId: 'user-2',
  fullName: 'Bob Designer',
  email: 'bob@example.com',
};

describe('planDeliveries', () => {
  it('sends on both channels when both enabled and recipient has Slack', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: true, emailEnabled: true }, [
      RECIPIENT_BOTH,
    ]);

    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((d) => d.channel)).toEqual(['slack', 'email']);
    expect(deliveries.every((d) => d.message.includes('Funky Painting'))).toBe(true);
  });

  it('sends only Slack when email is disabled', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: true, emailEnabled: false }, [
      RECIPIENT_BOTH,
    ]);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.channel).toBe('slack');
  });

  it('sends only email when Slack is disabled', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: false, emailEnabled: true }, [
      RECIPIENT_BOTH,
    ]);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.channel).toBe('email');
  });

  it('sends nothing when both channels are disabled', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: false, emailEnabled: false }, [
      RECIPIENT_BOTH,
    ]);

    expect(deliveries).toHaveLength(0);
  });

  it('skips Slack for a recipient without a Slack user ID', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: true, emailEnabled: true }, [
      RECIPIENT_NO_SLACK,
    ]);

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.channel).toBe('email');
  });

  it('plans deliveries for multiple recipients', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: true, emailEnabled: true }, [
      RECIPIENT_BOTH,
      RECIPIENT_NO_SLACK,
    ]);

    expect(deliveries).toHaveLength(3);
    const slackDeliveries = deliveries.filter((d) => d.channel === 'slack');
    const emailDeliveries = deliveries.filter((d) => d.channel === 'email');
    expect(slackDeliveries).toHaveLength(1);
    expect(emailDeliveries).toHaveLength(2);
  });

  it('returns empty when there are no recipients', () => {
    const deliveries = planDeliveries(EVENT, { slackEnabled: true, emailEnabled: true }, []);

    expect(deliveries).toHaveLength(0);
  });
});
