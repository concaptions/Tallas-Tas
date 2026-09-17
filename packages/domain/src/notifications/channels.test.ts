import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_CHANNELS,
  channelLabel,
  isNotificationChannel,
  type NotificationChannel,
} from './channels';

describe('NOTIFICATION_CHANNELS', () => {
  it('offers exactly two channels, the DM first and email second', () => {
    expect(NOTIFICATION_CHANNELS).toEqual(['slack', 'email']);
  });
});

describe('channelLabel', () => {
  it('calls the Slack channel a DM, because §12 exists to stop channel posts', () => {
    expect(channelLabel('slack')).toBe('Slack DM');
  });

  it('labels the email channel', () => {
    expect(channelLabel('email')).toBe('Email');
  });

  it('labels every channel with a distinct non-empty string that is not the key', () => {
    const labels = NOTIFICATION_CHANNELS.map((channel) => channelLabel(channel));
    for (const [index, label] of labels.entries()) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(NOTIFICATION_CHANNELS[index]);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('isNotificationChannel', () => {
  it('accepts both channels', () => {
    for (const channel of NOTIFICATION_CHANNELS) {
      expect(isNotificationChannel(channel)).toBe(true);
    }
  });

  it('rejects anything else a FormData could carry', () => {
    expect(isNotificationChannel('sms')).toBe(false);
    expect(isNotificationChannel('')).toBe(false);
    expect(isNotificationChannel('Slack DM')).toBe(false);
    expect(isNotificationChannel('toString')).toBe(false);
  });

  it('narrows the string it accepts, so a Server Action can pass it straight on', () => {
    const raw = 'email' as string;
    if (isNotificationChannel(raw)) {
      const channel: NotificationChannel = raw;
      expect(channelLabel(channel)).toBe('Email');
    } else {
      throw new Error('expected `email` to narrow');
    }
  });
});
