import { describe, expect, it } from 'vitest';

import {
  COPY_TITLE_PLACEHOLDER,
  COPY_TITLE_PREFIX,
  FIRST_COPY_NUMBER,
  copyTitle,
  isCopyNumber,
  nextCopyNumber,
} from './copy-name';

describe('copyTitle · the auto-generated Copy #', () => {
  it('titles the four demo rows the way the table renders them', () => {
    expect([1, 2, 3, 4].map(copyTitle)).toEqual(['Copy #1', 'Copy #2', 'Copy #3', 'Copy #4']);
  });

  it('is built from the exported prefix, so nothing re-types `Copy #`', () => {
    expect(copyTitle(12)).toBe(`${COPY_TITLE_PREFIX}12`);
  });

  it('does not pad or group the number', () => {
    expect(copyTitle(7)).toBe('Copy #7');
    expect(copyTitle(1042)).toBe('Copy #1042');
  });

  const unnumbered: readonly [number | null | undefined, string][] = [
    [null, 'a row whose number has not been assigned'],
    [undefined, 'a freshly mounted field'],
    [0, 'a number below the first one'],
    [-3, 'a negative'],
    [1.5, 'a fraction'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
  ];

  it.each(unnumbered)('renders %s as the placeholder (%s)', (value) => {
    expect(copyTitle(value)).toBe(`${COPY_TITLE_PREFIX}${COPY_TITLE_PLACEHOLDER}`);
  });

  it('never returns a blank title', () => {
    for (const value of [null, undefined, 0, 1, 99]) {
      expect(copyTitle(value).length).toBeGreaterThan(0);
    }
  });
});

describe('isCopyNumber', () => {
  it.each([1, 2, 4, 1042])('accepts %s', (value) => {
    expect(isCopyNumber(value)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    'refuses %s',
    (value) => {
      expect(isCopyNumber(value)).toBe(false);
    },
  );
});

describe('nextCopyNumber', () => {
  it('starts at the first number when the brand has no copy yet', () => {
    expect(nextCopyNumber([])).toBe(FIRST_COPY_NUMBER);
    expect(nextCopyNumber([])).toBe(1);
  });

  it('takes one past the highest number, not one past the count', () => {
    expect(nextCopyNumber([1, 2, 3, 4])).toBe(5);
    expect(nextCopyNumber([4, 1, 3, 2])).toBe(5);
  });

  it('never back-fills a gap left by a deleted row', () => {
    expect(nextCopyNumber([1, 3, 4])).toBe(5);
  });

  it('ignores values that are not copy numbers rather than following them', () => {
    expect(nextCopyNumber([1, null, undefined, 0, -9, 2.5, Number.NaN, 2])).toBe(3);
  });

  it('starts at the first number when nothing in the list is a copy number', () => {
    expect(nextCopyNumber([null, undefined, 0, Number.NaN])).toBe(1);
  });
});
