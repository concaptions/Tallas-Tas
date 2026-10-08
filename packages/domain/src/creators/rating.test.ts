import { describe, expect, it } from 'vitest';

import {
  RATING_NOTE_MAX,
  computeRegistryAverage,
  isRating,
  parseRating,
  rateCreatorForBrand,
} from './rating';

const CREATOR = '11111111-1111-4111-8111-000000000001';
const ACTOR = 'user_2abc';

describe('isRating / parseRating', () => {
  it('accepts exactly the whole numbers 1 through 5', () => {
    expect([1, 2, 3, 4, 5].every(isRating)).toBe(true);
    expect([0, 6, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY].some(isRating)).toBe(false);
  });

  it('parses the string a form submits and rejects anything else', () => {
    expect(parseRating('4')).toBe(4);
    expect(parseRating(' 5 ')).toBe(5);
    expect(parseRating('0')).toBeNull();
    expect(parseRating('')).toBeNull();
    expect(parseRating('four')).toBeNull();
    expect(parseRating(null)).toBeNull();
    expect(parseRating(undefined)).toBeNull();
  });
});

describe('rateCreatorForBrand', () => {
  it('returns the rated event with the note trimmed and the clock injected', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    expect(rateCreatorForBrand(CREATOR, 4, '  great turnaround  ', ACTOR, now)).toEqual({
      type: 'creator.rated',
      creatorId: CREATOR,
      rating: 4,
      note: 'great turnaround',
      actorUserId: ACTOR,
      ratedAt: now,
    });
  });

  it('stores an empty, blank or missing note as null', () => {
    expect(rateCreatorForBrand(CREATOR, 3, '', ACTOR).note).toBeNull();
    expect(rateCreatorForBrand(CREATOR, 3, '   ', ACTOR).note).toBeNull();
    expect(rateCreatorForBrand(CREATOR, 3, null, ACTOR).note).toBeNull();
    expect(rateCreatorForBrand(CREATOR, 3, undefined, ACTOR).note).toBeNull();
  });

  it('refuses a rating outside 1..5 at both boundaries', () => {
    expect(() => rateCreatorForBrand(CREATOR, 0, null, ACTOR)).toThrow(RangeError);
    expect(() => rateCreatorForBrand(CREATOR, 6, null, ACTOR)).toThrow(RangeError);
    expect(() => rateCreatorForBrand(CREATOR, 3.5, null, ACTOR)).toThrow(RangeError);
    expect(rateCreatorForBrand(CREATOR, 1, null, ACTOR).rating).toBe(1);
    expect(rateCreatorForBrand(CREATOR, 5, null, ACTOR).rating).toBe(5);
  });

  it('refuses a note longer than the limit and keeps one exactly at it', () => {
    expect(rateCreatorForBrand(CREATOR, 2, 'x'.repeat(RATING_NOTE_MAX), ACTOR).note).toHaveLength(
      RATING_NOTE_MAX,
    );
    expect(() => rateCreatorForBrand(CREATOR, 2, 'x'.repeat(RATING_NOTE_MAX + 1), ACTOR)).toThrow(
      RangeError,
    );
  });

  it('refuses an anonymous rating', () => {
    expect(() => rateCreatorForBrand(CREATOR, 2, null, '  ')).toThrow(RangeError);
  });
});

describe('computeRegistryAverage', () => {
  it('is null for an empty set, so an unrated creator shows no stars', () => {
    expect(computeRegistryAverage([])).toBeNull();
  });

  it('returns the single rating unchanged', () => {
    expect(computeRegistryAverage([3])).toBe(3);
  });

  it('rounds half up, matching Postgres round() on a positive mean', () => {
    expect(computeRegistryAverage([4, 5])).toBe(5);
    expect(computeRegistryAverage([2, 3])).toBe(3);
    expect(computeRegistryAverage([1, 2, 2])).toBe(2);
    expect(computeRegistryAverage([1, 1, 2])).toBe(1);
  });

  it('is an exact mean when the set divides evenly', () => {
    expect(computeRegistryAverage([1, 5])).toBe(3);
    expect(computeRegistryAverage([2, 4, 3])).toBe(3);
  });
});
