import { describe, expect, it } from 'vitest';

import {
  COPY_FIELD_LABELS,
  COPY_LIMITS,
  COPY_LIMIT_FIELDS,
  copyCounter,
  copyLength,
  copyLimitFor,
  isOverLimit,
  overBy,
} from './limits';

/** The four demo rows `@tas/db` seeds, copied here because `@tas/domain` depends on nothing. */
const fixtures = [
  {
    primaryCopy:
      'Six years of night shifts and he still could not sleep at noon. It is the rota, not you. Weight, not heat. Ninety nights.',
    headline: 'Your Rota Is Broken. You Are Not.',
    linkDescription: '90 nights. Sleep or return.',
  },
  {
    primaryCopy:
      'Her doctor called it her age. Four hundred women in one thread called it 3:47am. Quilted weight that spreads, never traps.',
    headline: 'They Called It Your Age. It Is 3am.',
    linkDescription: 'Read the 3am thread first.',
  },
  {
    primaryCopy:
      'Same bedroom, six hours apart: 2 lux at 3am, 186 lux at 9am. You are not failing at sleep, you are being out-lit 90 to 1.',
    headline: 'Not Bad Sleep. Ninety Times The Light.',
    linkDescription: 'Blocks 186 lux, not sound.',
  },
  {
    primaryCopy:
      'You bought the blanket and left the mask behind. The weight handles 3am, the light handles 6am, and the box handles both.',
    headline: 'Save $64 When They Ship Together.',
    linkDescription: 'Both for $174 tonight.',
  },
];

/** A string of exactly `length` characters. */
const chars = (length: number): string => 'a'.repeat(length);

describe('COPY_LIMITS · the PRD §5.11 guidance', () => {
  it('is the three numbers the PRD states', () => {
    expect(COPY_LIMITS).toEqual({ primaryCopy: 125, headline: 40, linkDescription: 27 });
  });

  it('lists the limited fields in the order the panel stacks them', () => {
    expect(COPY_LIMIT_FIELDS).toEqual(['primaryCopy', 'headline', 'linkDescription']);
  });

  it('names each field once, for the helper text and the messages alike', () => {
    expect(COPY_FIELD_LABELS).toEqual({
      primaryCopy: 'Primary Copy',
      headline: 'Headline',
      linkDescription: 'News Feed / Link Description',
    });
  });

  it.each(COPY_LIMIT_FIELDS)('reads %s back through copyLimitFor', (field) => {
    expect(copyLimitFor(field)).toBe(COPY_LIMITS[field]);
  });
});

describe('copyLength', () => {
  it('counts an empty draft as nothing', () => {
    expect(copyLength('')).toBe(0);
    expect(copyLength(null)).toBe(0);
    expect(copyLength(undefined)).toBe(0);
  });

  it('does not count leading or trailing whitespace, which is not copy', () => {
    expect(copyLength('   Shop tonight.   ')).toBe('Shop tonight.'.length);
    expect(copyLength('   ')).toBe(0);
  });

  it('counts whitespace inside the copy, which is', () => {
    expect(copyLength('a b c')).toBe(5);
  });

  it('counts an emoji once, not twice', () => {
    expect(copyLength('90 nights 🔥')).toBe(11);
    expect('90 nights 🔥'.length).toBe(12);
  });

  it('counts one glyph as one character even when it is eight UTF-16 units of emoji', () => {
    expect(copyLength('👩‍👩‍👧')).toBe(1);
    expect('👩‍👩‍👧'.length).toBe(8);
  });

  it('counts an accented letter once, however it was typed', () => {
    expect(copyLength('café')).toBe(4);
    expect(copyLength('café')).toBe(4);
  });
});

describe('overBy · the counter at, under and over each limit', () => {
  it.each(COPY_LIMIT_FIELDS)('reports %s under, at and over its limit', (field) => {
    const limit = COPY_LIMITS[field];

    expect(overBy(chars(limit - 1), limit)).toBe(0);
    expect(overBy(chars(limit), limit)).toBe(0);
    expect(overBy(chars(limit + 1), limit)).toBe(1);
    expect(overBy(chars(limit + 12), limit)).toBe(12);

    expect(isOverLimit(chars(limit - 1), limit)).toBe(false);
    expect(isOverLimit(chars(limit), limit)).toBe(false);
    expect(isOverLimit(chars(limit + 1), limit)).toBe(true);
  });

  it('treats exactly at the limit as within — `~27` means 27 fits', () => {
    expect(overBy(chars(27), 27)).toBe(0);
  });

  it('reports nothing for an empty draft', () => {
    expect(overBy('', 40)).toBe(0);
    expect(overBy(null, 40)).toBe(0);
    expect(overBy(undefined, 40)).toBe(0);
  });

  it('measures the trimmed text, so trailing spaces cannot push a field over', () => {
    expect(overBy(`${chars(40)}     `, 40)).toBe(0);
  });

  it('never reports an overage for a limit this build does not know', () => {
    expect(overBy(chars(500), Number.NaN)).toBe(0);
    expect(overBy(chars(500), Number.POSITIVE_INFINITY)).toBe(0);
    expect(isOverLimit(chars(500), Number.NaN)).toBe(false);
  });
});

describe('copyCounter · what the panel renders live under a field', () => {
  it('counts down while a field is within its limit', () => {
    expect(copyCounter('headline', chars(33))).toEqual({
      field: 'headline',
      label: 'Headline',
      length: 33,
      limit: 40,
      over: 0,
      remaining: 7,
    });
  });

  it('reads zero remaining exactly at the limit, and still nothing over', () => {
    expect(copyCounter('linkDescription', chars(27))).toEqual({
      field: 'linkDescription',
      label: 'News Feed / Link Description',
      length: 27,
      limit: 27,
      over: 0,
      remaining: 0,
    });
  });

  it('goes negative past the limit, which is what a counter shows', () => {
    expect(copyCounter('primaryCopy', chars(131))).toEqual({
      field: 'primaryCopy',
      label: 'Primary Copy',
      length: 131,
      limit: 125,
      over: 6,
      remaining: -6,
    });
  });

  it('starts at the full limit for an empty field', () => {
    expect(copyCounter('primaryCopy', null)).toEqual({
      field: 'primaryCopy',
      label: 'Primary Copy',
      length: 0,
      limit: 125,
      over: 0,
      remaining: 125,
    });
  });
});

describe('the demo fixtures sit inside the guidance', () => {
  it.each(fixtures)('keeps every field of "$headline" within its limit', (row) => {
    for (const field of COPY_LIMIT_FIELDS) {
      expect(overBy(row[field], COPY_LIMITS[field])).toBe(0);
    }
  });

  it('has one fixture sitting exactly on the 27-character link description', () => {
    const lengths = fixtures.map((row) => copyLength(row.linkDescription));
    expect(lengths).toEqual([27, 26, 26, 22]);
  });
});
