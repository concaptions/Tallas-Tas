import { demoNotifications, type NotificationSettingRow } from '@tas/db';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TRIGGER_KEYS,
  channelLabel,
  notificationTriggerLabel,
} from '@tas/domain';
import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_COLUMNS,
  UNROUTED_RECIPIENT,
  applyChannelSave,
  channelValue,
  notificationCountLabel,
  searchText,
  switchLabel,
  toNotificationItem,
  type NotificationItem,
} from './fields';

/**
 * The Notifications table's projection (PRD §12). Everything here is pure: a `@tas/db` row in, the
 * four cells and the filter string out. The fixtures are the input, so a fixture that drifted from
 * §12 fails here rather than rendering a wrong Recipient column.
 */
const [FIRST] = demoNotifications;
if (FIRST === undefined) {
  throw new Error('the demo notification fixtures are empty');
}

/** `items[index]`, so a missing row fails as a missing row rather than as `undefined.slackEnabled`. */
function at(items: readonly NotificationItem[], index: number): NotificationItem {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`the projected table has no row ${String(index)}`);
  }
  return item;
}

describe('NOTIFICATION_COLUMNS', () => {
  it('is the ticket order, with the two channel headers coming from the domain', () => {
    expect(NOTIFICATION_COLUMNS).toEqual(['Trigger', 'Recipient', 'Slack DM', 'Email']);
    expect(NOTIFICATION_COLUMNS.slice(2)).toEqual(NOTIFICATION_CHANNELS.map(channelLabel));
  });
});

describe('toNotificationItem', () => {
  it('projects the eight fixtures in PRD §12 order, Slack on and email off', () => {
    const items = demoNotifications.map(toNotificationItem);

    expect(items.map((item) => item.triggerKey)).toEqual(NOTIFICATION_TRIGGER_KEYS);
    expect(items.map((item) => item.label)).toEqual(
      NOTIFICATION_TRIGGER_KEYS.map(notificationTriggerLabel),
    );
    expect(items.every((item) => item.slackEnabled)).toBe(true);
    expect(items.some((item) => item.emailEnabled)).toBe(false);
    expect(items.every((item) => item.unrouted)).toBe(false);
  });

  it('names every recipient in words, never an empty cell', () => {
    for (const item of demoNotifications.map(toNotificationItem)) {
      expect(item.recipient.trim()).not.toBe('');
    }
  });

  it('falls back to the key and says so when the stored trigger is no longer in §12', () => {
    // `trigger_key` is plain `text` in Postgres and only `$type`d to the §12 tuple, so a row
    // written before a trigger was retired is a real stored state that the narrowed TypeScript type
    // cannot express. The widening is on the key alone, which is exactly the case under test.
    const retired: NotificationSettingRow = {
      ...FIRST,
      triggerKey: 'retired_trigger' as NotificationSettingRow['triggerKey'],
      label: null,
      recipients: [],
      recipientLabel: null,
    };

    const item = toNotificationItem(retired);

    expect(item.label).toBe('retired_trigger');
    expect(item.recipient).toBe(UNROUTED_RECIPIENT);
    expect(item.unrouted).toBe(true);
  });
});

describe('searchText', () => {
  it('matches the §12 wording, the recipient and the key, lower-cased', () => {
    const item = toNotificationItem(FIRST);

    expect(item.search).toBe([item.label, item.recipient, item.triggerKey].join(' ').toLowerCase());
    expect(item.search).toContain('brief assigned');
    expect(searchText(item)).toBe(item.search);
  });
});

describe('channelValue and switchLabel', () => {
  it('reads each channel off the row and names the switch by channel and trigger', () => {
    const item = { ...toNotificationItem(FIRST), slackEnabled: true, emailEnabled: false };

    expect(channelValue(item, 'slack')).toBe(true);
    expect(channelValue(item, 'email')).toBe(false);
    expect(switchLabel(item, 'slack')).toBe(`Slack DM for ${item.label}`);
    expect(switchLabel(item, 'email')).toBe(`Email for ${item.label}`);
  });
});

describe('applyChannelSave', () => {
  const items = demoNotifications.map(toNotificationItem);
  const target = at(items, 0);
  const neighbour = at(items, 1);

  it('writes the value the row should become, not a flip', () => {
    const once = applyChannelSave(items, target.triggerKey, 'email', true);
    const twice = applyChannelSave(once, target.triggerKey, 'email', true);

    expect(at(twice, 0).emailEnabled).toBe(true);
  });

  it('leaves the other channel of the same row untouched', () => {
    const saved = applyChannelSave(items, target.triggerKey, 'email', true);

    expect(at(saved, 0).emailEnabled).toBe(true);
    expect(at(saved, 0).slackEnabled).toBe(true);
  });

  it('leaves every other row untouched', () => {
    const saved = applyChannelSave(items, target.triggerKey, 'slack', false);

    expect(at(saved, 0).slackEnabled).toBe(false);
    expect(at(saved, 1)).toEqual(neighbour);
    expect(saved).toHaveLength(items.length);
  });

  it('is a no-op for a trigger the table does not hold', () => {
    expect(applyChannelSave(items, 'not_a_trigger', 'slack', false)).toEqual(items);
  });
});

describe('notificationCountLabel', () => {
  it.each([
    [8, 8, '8 triggers'],
    [2, 8, '2 of 8 triggers'],
    [1, 1, '1 trigger'],
    [0, 8, '0 of 8 triggers'],
  ])('reads %i of %i as %s', (visible, total, expected) => {
    expect(notificationCountLabel(visible, total)).toBe(expected);
  });
});
