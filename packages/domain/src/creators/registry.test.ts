import { describe, expect, it } from 'vitest';

import { matchRegistryCreator, normalizeInstagramUsername } from './registry';

describe('normalizeInstagramUsername', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeInstagramUsername(null)).toBeNull();
    expect(normalizeInstagramUsername(undefined)).toBeNull();
    expect(normalizeInstagramUsername('')).toBeNull();
    expect(normalizeInstagramUsername('   ')).toBeNull();
  });

  it('lowercases and strips @', () => {
    expect(normalizeInstagramUsername('@JohnDoe')).toBe('johndoe');
    expect(normalizeInstagramUsername('JaneDoe')).toBe('janedoe');
    expect(normalizeInstagramUsername('  @FooBar  ')).toBe('foobar');
  });
});

describe('matchRegistryCreator', () => {
  const base = {
    name: 'Jane Smith',
    instagramUsername: '@janesmith',
    platform: ['Fiverr', 'Direct Management'],
    gender: 'female',
    ageBracket: '25-34' as const,
    totalBrands: 3,
    tags: ['beauty', 'lifestyle'],
  };

  it('returns positive score for matching query', () => {
    expect(matchRegistryCreator(base, { query: 'jane' })).toBeGreaterThan(0);
    expect(matchRegistryCreator(base, { query: 'janesmith' })).toBeGreaterThan(0);
  });

  it('returns 0 for non-matching query', () => {
    expect(matchRegistryCreator(base, { query: 'bob' })).toBe(0);
  });

  it('returns positive with no filters', () => {
    expect(matchRegistryCreator(base, {})).toBeGreaterThan(0);
  });

  it('filters by platform', () => {
    expect(matchRegistryCreator(base, { platform: ['Fiverr'] })).toBeGreaterThan(0);
    expect(matchRegistryCreator(base, { platform: ['Billo'] })).toBe(0);
  });

  it('filters by gender', () => {
    expect(matchRegistryCreator(base, { gender: 'female' })).toBeGreaterThan(0);
    expect(matchRegistryCreator(base, { gender: 'male' })).toBe(0);
  });

  it('filters by minBrands', () => {
    expect(matchRegistryCreator(base, { minBrands: 2 })).toBeGreaterThan(0);
    expect(matchRegistryCreator(base, { minBrands: 5 })).toBe(0);
  });

  it('adds bonus score for brand experience', () => {
    const novice = { ...base, totalBrands: 0 };
    const veteran = { ...base, totalBrands: 10 };
    const noviceScore = matchRegistryCreator(novice, {});
    const veteranScore = matchRegistryCreator(veteran, {});
    expect(veteranScore).toBeGreaterThan(noviceScore);
  });
});
