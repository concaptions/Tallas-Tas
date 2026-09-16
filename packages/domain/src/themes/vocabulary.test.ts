import { describe, expect, it } from 'vitest';

import {
  THEME_CATEGORIES,
  THEME_CATEGORY_KEYS,
  isThemeCategory,
  themeCategoryEntry,
  themeCategoryLabel,
  themeCategoryTone,
} from './vocabulary';

describe('THEME_CATEGORIES', () => {
  it('is the three PRD §5.5 kinds in render order', () => {
    expect(THEME_CATEGORY_KEYS).toEqual(['Framework', 'Production Style', 'Seasonal']);
  });

  it('matches the stored vocabulary in @tas/db, value for value', () => {
    // The keys ARE `themeCategories` from packages/db/src/schema/enums.ts, so a row indexes
    // straight into this table. Duplicated as literals here only because packages/domain does not
    // depend on packages/db.
    expect(THEME_CATEGORIES.every((entry) => entry.label === entry.key)).toBe(true);
  });

  it('gives every category a chip tone', () => {
    expect(THEME_CATEGORIES.map((entry) => entry.tone)).toEqual(['accent', 'info', 'warn']);
  });

  it('gives each category its own tone, so three chips stay distinguishable', () => {
    expect(new Set(THEME_CATEGORIES.map((entry) => entry.tone)).size).toBe(THEME_CATEGORIES.length);
  });
});

describe('isThemeCategory', () => {
  it('accepts every stored value', () => {
    expect(THEME_CATEGORY_KEYS.every((key) => isThemeCategory(key))).toBe(true);
  });

  it('refuses a near miss, a slug and an empty string', () => {
    expect(isThemeCategory('production style')).toBe(false);
    expect(isThemeCategory('production_style')).toBe(false);
    expect(isThemeCategory('Frameworks')).toBe(false);
    expect(isThemeCategory('')).toBe(false);
  });
});

describe('themeCategoryEntry', () => {
  it('finds the entry for a stored value', () => {
    expect(themeCategoryEntry('Production Style')).toEqual({
      key: 'Production Style',
      label: 'Production Style',
      tone: 'info',
    });
  });

  it('returns undefined for a value this build does not know', () => {
    expect(themeCategoryEntry('Holiday')).toBeUndefined();
  });
});

describe('themeCategoryLabel', () => {
  it('labels each of the three categories', () => {
    expect(THEME_CATEGORY_KEYS.map((key) => themeCategoryLabel(key))).toEqual([
      'Framework',
      'Production Style',
      'Seasonal',
    ]);
  });

  it('falls back to the raw value, so a chip is never blank', () => {
    expect(themeCategoryLabel('Holiday')).toBe('Holiday');
    expect(themeCategoryLabel('')).toBe('');
  });
});

describe('themeCategoryTone', () => {
  it('gives each category its fixed tone', () => {
    expect(themeCategoryTone('Framework')).toBe('accent');
    expect(themeCategoryTone('Production Style')).toBe('info');
    expect(themeCategoryTone('Seasonal')).toBe('warn');
  });

  it('falls back to mute for a value this build does not know', () => {
    expect(themeCategoryTone('Holiday')).toBe('mute');
    expect(themeCategoryTone('')).toBe('mute');
  });

  it('never invents a status tone: no category is ok or bad', () => {
    // Themes have no workflow status (ticket criterion 13). `ok` and `bad` read as approval
    // states, so a category chip must never land on one.
    const tones = THEME_CATEGORIES.map((entry) => entry.tone);
    expect(tones).not.toContain('ok');
    expect(tones).not.toContain('bad');
  });
});
