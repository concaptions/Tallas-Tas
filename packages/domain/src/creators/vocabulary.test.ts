import { describe, expect, it } from 'vitest';

import {
  AGE_BRACKETS,
  AGE_BRACKET_KEYS,
  CREATOR_PLATFORMS,
  CREATOR_PLATFORM_KEYS,
  UNSET_LABEL,
  ageBracketLabel,
  creatorPlatformLabel,
  isAgeBracket,
  isCreatorPlatform,
} from './vocabulary';

describe('AGE_BRACKETS', () => {
  it('is the `creatorAgeBrackets` tuple of `@tas/db`, verbatim and ascending', () => {
    expect(AGE_BRACKET_KEYS).toEqual(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']);
  });

  it('typesets the range with an en dash while storing the ASCII hyphen', () => {
    expect(ageBracketLabel('25-34')).toBe('25–34');
    expect(AGE_BRACKETS[0].key).toBe('18-24');
    expect(AGE_BRACKETS[0].label).toBe('18–24');
    expect(ageBracketLabel('65+')).toBe('65+');
  });

  it('guards the vocabulary', () => {
    expect(isAgeBracket('45-54')).toBe(true);
    expect(isAgeBracket('45–54')).toBe(false);
    expect(isAgeBracket('12-17')).toBe(false);
    expect(isAgeBracket('')).toBe(false);
  });

  it('renders an em dash for the null column rather than a blank cell', () => {
    expect(ageBracketLabel(null)).toBe(UNSET_LABEL);
    expect(ageBracketLabel(undefined)).toBe(UNSET_LABEL);
    expect(ageBracketLabel('')).toBe(UNSET_LABEL);
    expect(ageBracketLabel(null)).toBe('—');
  });

  it('is total: an unknown bracket renders itself', () => {
    expect(ageBracketLabel('75-84')).toBe('75-84');
  });
});

describe('CREATOR_PLATFORMS', () => {
  it('is the `creatorPlatforms` tuple of `@tas/db`, verbatim and in PRD order', () => {
    expect(CREATOR_PLATFORM_KEYS).toEqual([
      'Fiverr',
      'Billo',
      'Backstage',
      'Insense',
      'Direct Management',
    ]);
  });

  it('stores the proper noun as the key, so key and label are the same string', () => {
    for (const entry of CREATOR_PLATFORMS) {
      expect(entry.label).toBe(entry.key);
    }
  });

  it('guards the vocabulary', () => {
    expect(isCreatorPlatform('Direct Management')).toBe(true);
    expect(isCreatorPlatform('direct_management')).toBe(false);
    expect(isCreatorPlatform('TikTok Creator Marketplace')).toBe(false);
    expect(isCreatorPlatform('')).toBe(false);
  });

  it('renders an em dash for the null column rather than a blank cell', () => {
    expect(creatorPlatformLabel(null)).toBe(UNSET_LABEL);
    expect(creatorPlatformLabel(undefined)).toBe(UNSET_LABEL);
    expect(creatorPlatformLabel('')).toBe(UNSET_LABEL);
  });

  it('is total: a platform added by a newer build renders itself', () => {
    expect(creatorPlatformLabel('Aspire')).toBe('Aspire');
  });

  it('has no duplicate key', () => {
    expect(new Set(CREATOR_PLATFORM_KEYS).size).toBe(CREATOR_PLATFORM_KEYS.length);
    expect(new Set(AGE_BRACKET_KEYS).size).toBe(AGE_BRACKET_KEYS.length);
  });
});
