import { describe, expect, it } from 'vitest';

import { formatCommentStamp, formatSheetDate } from './format-date';

describe('formatSheetDate', () => {
  it('renders a stored day as `DD Mon YYYY`, zero-padded (B2.A10)', () => {
    expect(formatSheetDate(new Date('2026-10-18T00:00:00Z'))).toBe('18 Oct 2026');
    expect(formatSheetDate(new Date('2026-10-02T00:00:00Z'))).toBe('02 Oct 2026');
  });

  it('accepts an ISO string, date-only or with a time', () => {
    expect(formatSheetDate('2026-10-18')).toBe('18 Oct 2026');
    expect(formatSheetDate('2026-01-05T09:30:00.000Z')).toBe('05 Jan 2026');
  });

  it('reads the calendar day in UTC, so a date-only value never slips a day', () => {
    // 23:59 UTC on the 18th is still the 18th; a local-zone render west of Greenwich would agree,
    // one east of it would say the 19th.
    expect(formatSheetDate('2026-10-18T23:59:59Z')).toBe('18 Oct 2026');
  });

  it('renders nothing for a missing or unparseable value', () => {
    expect(formatSheetDate(null)).toBe('');
    expect(formatSheetDate(undefined)).toBe('');
    expect(formatSheetDate('')).toBe('');
    expect(formatSheetDate('not a date')).toBe('');
    expect(formatSheetDate(new Date(Number.NaN))).toBe('');
  });
});

describe('formatCommentStamp', () => {
  it('renders `D Mon, h:mm AM/PM` with a plain space before the meridiem', () => {
    expect(formatCommentStamp(new Date('2026-10-10T15:42:00Z'))).toBe('10 Oct, 3:42 PM');
    expect(formatCommentStamp('2026-10-02T09:05:00Z')).toBe('2 Oct, 9:05 AM');
  });

  it('keeps midnight and noon on the twelve-hour clock', () => {
    expect(formatCommentStamp('2026-10-10T00:00:00Z')).toBe('10 Oct, 12:00 AM');
    expect(formatCommentStamp('2026-10-10T12:00:00Z')).toBe('10 Oct, 12:00 PM');
  });

  it('renders nothing for a missing or unparseable value', () => {
    expect(formatCommentStamp(null)).toBe('');
    expect(formatCommentStamp(undefined)).toBe('');
    expect(formatCommentStamp('yesterday')).toBe('');
  });
});
