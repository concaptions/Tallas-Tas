import { describe, expect, it } from 'vitest';

import {
  JUST_NOW_LABEL,
  NEVER_ACTIVE_LABEL,
  hasNeverBeenActive,
  lastActiveLabel,
} from './last-active';

const NOW = new Date('2026-09-17T12:00:00.000Z');

/** `NOW` minus a duration, so every case below reads as "this long before now". */
function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe('lastActiveLabel', () => {
  it('reads Never for a member who has never signed in', () => {
    expect(lastActiveLabel(null, NOW)).toBe(NEVER_ACTIVE_LABEL);
    expect(lastActiveLabel(undefined, NOW)).toBe('Never');
  });

  it('reads Never rather than "Invalid Date" for an unusable date on either side', () => {
    expect(lastActiveLabel(new Date('nonsense'), NOW)).toBe(NEVER_ACTIVE_LABEL);
    expect(lastActiveLabel(ago(HOUR), new Date('nonsense'))).toBe(NEVER_ACTIVE_LABEL);
  });

  it('reads Just now under a minute', () => {
    expect(lastActiveLabel(NOW, NOW)).toBe(JUST_NOW_LABEL);
    expect(lastActiveLabel(ago(SECOND), NOW)).toBe('Just now');
    expect(lastActiveLabel(ago(59 * SECOND), NOW)).toBe('Just now');
  });

  it('reads Just now for a timestamp slightly ahead of the clock', () => {
    expect(lastActiveLabel(new Date(NOW.getTime() + 4 * SECOND), NOW)).toBe('Just now');
    expect(lastActiveLabel(new Date(NOW.getTime() + 3 * DAY), NOW)).toBe('Just now');
  });

  describe('minutes', () => {
    it('reads the singular at exactly one minute', () => {
      expect(lastActiveLabel(ago(MINUTE), NOW)).toBe('1 minute ago');
    });

    it('reads the plural below the hour', () => {
      expect(lastActiveLabel(ago(2 * MINUTE), NOW)).toBe('2 minutes ago');
      expect(lastActiveLabel(ago(45 * MINUTE), NOW)).toBe('45 minutes ago');
      expect(lastActiveLabel(ago(59 * MINUTE + 59 * SECOND), NOW)).toBe('59 minutes ago');
    });

    it('floors rather than rounds up', () => {
      expect(lastActiveLabel(ago(MINUTE + 59 * SECOND), NOW)).toBe('1 minute ago');
    });
  });

  describe('hours', () => {
    it('reads the singular at exactly one hour', () => {
      expect(lastActiveLabel(ago(HOUR), NOW)).toBe('1 hour ago');
    });

    it('reads the plural below the day', () => {
      expect(lastActiveLabel(ago(3 * HOUR), NOW)).toBe('3 hours ago');
      expect(lastActiveLabel(ago(13 * HOUR), NOW)).toBe('13 hours ago');
      expect(lastActiveLabel(ago(23 * HOUR + 59 * MINUTE), NOW)).toBe('23 hours ago');
    });
  });

  describe('days', () => {
    it('reads the singular at exactly one day', () => {
      expect(lastActiveLabel(ago(DAY), NOW)).toBe('1 day ago');
    });

    it('reads the ticket example', () => {
      expect(lastActiveLabel(ago(3 * DAY), NOW)).toBe('3 days ago');
    });

    it('stays in days up to the last hour before a week', () => {
      expect(lastActiveLabel(ago(6 * DAY + 23 * HOUR), NOW)).toBe('6 days ago');
    });
  });

  describe('weeks', () => {
    it('reads the singular at exactly seven days', () => {
      expect(lastActiveLabel(ago(WEEK), NOW)).toBe('1 week ago');
    });

    it('reads the plural, flooring the part week', () => {
      expect(lastActiveLabel(ago(2 * WEEK), NOW)).toBe('2 weeks ago');
      expect(lastActiveLabel(ago(23 * DAY), NOW)).toBe('3 weeks ago');
      expect(lastActiveLabel(ago(29 * DAY), NOW)).toBe('4 weeks ago');
    });
  });

  describe('months and years', () => {
    it('switches to months at thirty days', () => {
      expect(lastActiveLabel(ago(30 * DAY), NOW)).toBe('1 month ago');
      expect(lastActiveLabel(ago(90 * DAY), NOW)).toBe('3 months ago');
      expect(lastActiveLabel(ago(364 * DAY), NOW)).toBe('12 months ago');
    });

    it('switches to years at three hundred and sixty-five days', () => {
      expect(lastActiveLabel(ago(365 * DAY), NOW)).toBe('1 year ago');
      expect(lastActiveLabel(ago(800 * DAY), NOW)).toBe('2 years ago');
    });
  });

  it('never reads the clock: the same pair always gives the same string', () => {
    const date = ago(5 * HOUR);
    expect(lastActiveLabel(date, NOW)).toBe('5 hours ago');
    expect(lastActiveLabel(date, new Date(NOW.getTime() + 2 * HOUR))).toBe('7 hours ago');
  });

  it('never returns an empty cell for any input', () => {
    const cases = [null, undefined, new Date('nonsense'), NOW, ago(MINUTE), ago(400 * DAY)];
    for (const value of cases) {
      expect(lastActiveLabel(value, NOW).length).toBeGreaterThan(0);
    }
  });
});

describe('hasNeverBeenActive', () => {
  it('is true exactly when the label reads Never', () => {
    for (const value of [null, undefined, new Date('nonsense')]) {
      expect(hasNeverBeenActive(value)).toBe(true);
      expect(lastActiveLabel(value, NOW)).toBe(NEVER_ACTIVE_LABEL);
    }
  });

  it('is false for any real timestamp', () => {
    expect(hasNeverBeenActive(NOW)).toBe(false);
    expect(hasNeverBeenActive(ago(400 * DAY))).toBe(false);
  });
});
