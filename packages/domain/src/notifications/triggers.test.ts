import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_TRIGGERS,
  NOTIFICATION_TRIGGER_KEYS,
  isNotificationTriggerKey,
  notificationTrigger,
  notificationTriggerLabel,
} from './triggers';

/**
 * PRD §12's eight bullets, in order, transcribed here a second time on purpose: if the tuple is ever
 * reordered, renamed or trimmed, this list is what fails. It is the test's job to hold the PRD, not
 * to agree with whatever the tuple happens to say.
 */
const SECTION_12 = [
  ['brief_assigned', 'Brief assigned to an editor or designer'],
  ['internal_revisions_requested', 'Revisions requested internally'],
  ['ad_submitted', 'Ad submitted'],
  ['client_approved', 'Client approved a concept, creative, copy or creator'],
  ['client_requested_revisions', 'Client requested revisions'],
  ['creative_ready_to_launch', 'Creative approved internally and ready to launch'],
  ['creator_status_changed', 'Creator status changed'],
  ['partnership_expiring', 'Partnership permission expiring in 5 days'],
] as const;

describe('NOTIFICATION_TRIGGERS', () => {
  it('holds §12’s eight triggers and no more', () => {
    expect(NOTIFICATION_TRIGGERS).toHaveLength(8);
  });

  it('lists every trigger in §12 order, with §12’s wording', () => {
    expect(NOTIFICATION_TRIGGERS.map((trigger) => [trigger.key, trigger.label])).toEqual(
      SECTION_12.map(([key, label]) => [key, label]),
    );
  });

  it('names who is DMed for every trigger, in §12’s words', () => {
    expect(NOTIFICATION_TRIGGERS.map((trigger) => trigger.recipients)).toEqual([
      'the assignee with priority and deadline',
      'the assignee',
      'the creative strategist and CSM',
      'the CSM and strategist',
      'the CSM and strategist',
      'the media buyer',
      'the UGC manager',
      'the media buyer and CSM',
    ]);
  });

  it('gives every trigger a non-empty recipients phrase that is not the key or the label', () => {
    for (const trigger of NOTIFICATION_TRIGGERS) {
      expect(trigger.recipients.trim().length).toBeGreaterThan(0);
      expect(trigger.recipients).not.toBe(trigger.key);
      expect(trigger.recipients).not.toBe(trigger.label);
    }
  });

  it('gives every trigger a non-empty label that is not its snake_case key', () => {
    for (const trigger of NOTIFICATION_TRIGGERS) {
      expect(trigger.label.trim().length).toBeGreaterThan(0);
      expect(trigger.label).not.toBe(trigger.key);
      expect(trigger.label).not.toMatch(/_/);
    }
  });

  it('keys every trigger uniquely, so a row can be addressed by `data-trigger` alone', () => {
    const keys = NOTIFICATION_TRIGGERS.map((trigger) => trigger.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keys every trigger in the snake_case storage vocabulary', () => {
    for (const trigger of NOTIFICATION_TRIGGERS) {
      expect(trigger.key).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
    }
  });
});

describe('NOTIFICATION_TRIGGER_KEYS', () => {
  it('is the tuple’s keys, in the same order', () => {
    expect(NOTIFICATION_TRIGGER_KEYS).toEqual(SECTION_12.map(([key]) => key));
  });
});

describe('isNotificationTriggerKey', () => {
  it('accepts every key §12 defines', () => {
    for (const [key] of SECTION_12) {
      expect(isNotificationTriggerKey(key)).toBe(true);
    }
  });

  it('rejects a key that is not one of the eight', () => {
    expect(isNotificationTriggerKey('retired_trigger')).toBe(false);
    expect(isNotificationTriggerKey('')).toBe(false);
    expect(isNotificationTriggerKey('Brief assigned to an editor or designer')).toBe(false);
  });

  it('rejects an inherited property name, so the guard is a list and not an object lookup', () => {
    expect(isNotificationTriggerKey('toString')).toBe(false);
    expect(isNotificationTriggerKey('constructor')).toBe(false);
  });
});

describe('notificationTrigger', () => {
  it('finds the trigger for a stored key', () => {
    expect(notificationTrigger('partnership_expiring')).toEqual({
      key: 'partnership_expiring',
      label: 'Partnership permission expiring in 5 days',
      recipients: 'the media buyer and CSM',
    });
  });

  it('returns null for a key that has been retired, rather than throwing inside a render', () => {
    expect(notificationTrigger('retired_trigger')).toBeNull();
  });
});

describe('notificationTriggerLabel', () => {
  it('reads §12’s label for a known key', () => {
    expect(notificationTriggerLabel('ad_submitted')).toBe('Ad submitted');
  });

  it('falls back to the key itself for an unknown one, the same fallback the cell uses', () => {
    expect(notificationTriggerLabel('retired_trigger')).toBe('retired_trigger');
  });
});
