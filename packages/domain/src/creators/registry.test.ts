import { describe, expect, it } from 'vitest';

import {
  matchRegistryCreator,
  normalizeInstagramUsername,
  type RegistryCreatorInput,
  type RegistrySearchFilters,
} from './registry';

describe('normalizeInstagramUsername', () => {
  it('returns null for falsy input', () => {
    expect(normalizeInstagramUsername(null)).toBeNull();
    expect(normalizeInstagramUsername(undefined)).toBeNull();
    expect(normalizeInstagramUsername('')).toBeNull();
  });

  it('lowercases and strips leading @', () => {
    expect(normalizeInstagramUsername('@CoolCreator')).toBe('coolcreator');
    expect(normalizeInstagramUsername('CoolCreator')).toBe('coolcreator');
    expect(normalizeInstagramUsername('  @FooBar  ')).toBe('foobar');
  });

  it('returns null for whitespace-only input', () => {
    expect(normalizeInstagramUsername('   ')).toBeNull();
  });

  it('strips only the first @', () => {
    expect(normalizeInstagramUsername('@@double')).toBe('@double');
  });
});

describe('matchRegistryCreator', () => {
  const creator: RegistryCreatorInput = {
    name: 'Sarah Johnson',
    instagramUsername: '@sarahj',
    platform: ['Fiverr', 'Insense'],
    gender: 'Female',
    ageBracket: '25-34',
    totalBrands: 3,
    tags: ['lifestyle', 'beauty'],
  };

  it('matches by name query', () => {
    expect(matchRegistryCreator(creator, { query: 'sarah' })).toBeGreaterThan(0);
  });

  it('matches by instagram query', () => {
    expect(matchRegistryCreator(creator, { query: 'sarahj' })).toBeGreaterThan(0);
  });

  it('returns 0 when query does not match', () => {
    expect(matchRegistryCreator(creator, { query: 'nonexistent' })).toBe(0);
  });

  it('returns a positive score with no filters', () => {
    expect(matchRegistryCreator(creator, {})).toBeGreaterThan(0);
  });

  it('filters by platform', () => {
    expect(matchRegistryCreator(creator, { platform: ['Fiverr'] })).toBeGreaterThan(0);
    expect(matchRegistryCreator(creator, { platform: ['Billo'] })).toBe(0);
  });

  it('filters by gender', () => {
    expect(matchRegistryCreator(creator, { gender: 'Female' })).toBeGreaterThan(0);
    expect(matchRegistryCreator(creator, { gender: 'Male' })).toBe(0);
  });

  it('filters by age bracket', () => {
    expect(matchRegistryCreator(creator, { ageBracket: '25-34' })).toBeGreaterThan(0);
    expect(matchRegistryCreator(creator, { ageBracket: '35-44' })).toBe(0);
  });

  it('filters by minimum brands', () => {
    expect(matchRegistryCreator(creator, { minBrands: 2 })).toBeGreaterThan(0);
    expect(matchRegistryCreator(creator, { minBrands: 10 })).toBe(0);
  });

  it('gives bonus score for more brand experience', () => {
    const experienced = { ...creator, totalBrands: 5 };
    const novice = { ...creator, totalBrands: 1 };
    expect(matchRegistryCreator(experienced, {})).toBeGreaterThan(matchRegistryCreator(novice, {}));
  });

  it('combines query and platform filter', () => {
    const filters: RegistrySearchFilters = { query: 'sarah', platform: ['Fiverr'] };
    expect(matchRegistryCreator(creator, filters)).toBeGreaterThan(0);
    const wrongPlatform: RegistrySearchFilters = { query: 'sarah', platform: ['Billo'] };
    expect(matchRegistryCreator(creator, wrongPlatform)).toBe(0);
  });
});
