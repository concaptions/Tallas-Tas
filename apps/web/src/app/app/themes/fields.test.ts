import { describe, expect, it } from 'vitest';

import {
  ALL_CATEGORIES,
  CATEGORY_FILTERS,
  GLOBAL_BADGE_LABEL,
  GLOBAL_BADGE_NOTE,
  GLOBAL_BADGE_TONE,
  categoryFromParam,
  filteredCountLabel,
  libraryCountLabel,
  matchesCategory,
  matchesQuery,
  overflowLabel,
  referenceChipRow,
  type ThemeCardRow,
} from './fields';

function theme(overrides: Partial<ThemeCardRow> = {}): ThemeCardRow {
  return {
    id: '44444444-4444-4444-8444-000000000001',
    name: 'Green Screen',
    category: 'Production Style',
    status: null,
    notes: 'Creator reacts over a screenshot of a review or a sleep-tracker graph.',
    referenceLinks: ['https://foreplay.example/boards/green-screen-reaction'],
    usedByBrandCount: 0,
    isActive: true,
    ...overrides,
  };
}

describe('the GLOBAL badge copy', () => {
  it('carries the word GLOBAL in the warn tone', () => {
    expect(GLOBAL_BADGE_LABEL).toBe('GLOBAL');
    expect(GLOBAL_BADGE_TONE).toBe('warn');
  });

  it('says in one line that the library is shared by every brand', () => {
    expect(GLOBAL_BADGE_NOTE).toContain('shared by every brand');
    expect(GLOBAL_BADGE_NOTE).toContain('available to every client immediately');
  });
});

describe('the count line', () => {
  it('names the platform, not the brand, so a reader does not assume the usual scope', () => {
    expect(libraryCountLabel(6)).toBe('6 themes across the whole platform');
  });

  it('is singular at one and never renders a negative or fractional count', () => {
    expect(libraryCountLabel(1)).toBe('1 theme across the whole platform');
    expect(libraryCountLabel(0)).toBe('0 themes across the whole platform');
    expect(libraryCountLabel(-3)).toBe('0 themes across the whole platform');
    expect(libraryCountLabel(2.7)).toBe('2 themes across the whole platform');
  });

  it('says how many of how many while a filter is narrowing the grid', () => {
    expect(filteredCountLabel(2, 6)).toBe('2 of 6 themes across the whole platform');
  });
});

describe('CATEGORY_FILTERS', () => {
  it('is All plus the three categories, in the vocabulary order', () => {
    expect(CATEGORY_FILTERS.map((entry) => entry.label)).toEqual([
      'All',
      'Framework',
      'Production Style',
      'Seasonal',
    ]);
  });

  it('keeps each category its own tone and leaves All quiet', () => {
    expect(CATEGORY_FILTERS.map((entry) => entry.tone)).toEqual(['mute', 'accent', 'info', 'warn']);
  });
});

describe('categoryFromParam', () => {
  it('reads a stored value back, spaces and all', () => {
    expect(categoryFromParam('Framework')).toBe('Framework');
    expect(categoryFromParam('Production Style')).toBe('Production Style');
    expect(categoryFromParam('Seasonal')).toBe('Seasonal');
  });

  it('reads the form encoding another tool may produce', () => {
    expect(categoryFromParam('Production+Style')).toBe('Production Style');
  });

  it('falls back to All rather than rendering an empty grid nobody can explain', () => {
    expect(categoryFromParam(undefined)).toBe(ALL_CATEGORIES);
    expect(categoryFromParam(null)).toBe(ALL_CATEGORIES);
    expect(categoryFromParam('')).toBe(ALL_CATEGORIES);
    // 'production_style' used to land here. It now resolves, because a shared link that carries a
    // slug should show what it linked to rather than silently widening to every category.
    expect(categoryFromParam('Frameworks')).toBe(ALL_CATEGORIES);
    expect(categoryFromParam('made up')).toBe(ALL_CATEGORIES);
  });
});

describe('matchesCategory', () => {
  it('lets everything through on All', () => {
    expect(matchesCategory(theme(), ALL_CATEGORIES)).toBe(true);
  });

  it('compares against the stored value, not a label of its own', () => {
    expect(matchesCategory(theme(), 'Production Style')).toBe(true);
    expect(matchesCategory(theme(), 'Framework')).toBe(false);
  });
});

describe('matchesQuery', () => {
  it('matches nothing away when the query is empty', () => {
    expect(matchesQuery(theme(), '')).toBe(true);
  });

  it('reads the name and the note, the two things a theme is looked up by', () => {
    expect(matchesQuery(theme(), 'green')).toBe(true);
    expect(matchesQuery(theme(), 'sleep-tracker')).toBe(true);
    expect(matchesQuery(theme(), 'seasonal')).toBe(false);
  });

  it('survives a theme with no note at all', () => {
    expect(matchesQuery(theme({ notes: null }), 'green')).toBe(true);
    expect(matchesQuery(theme({ notes: null }), 'screenshot')).toBe(false);
  });

  it('matches a word, not any run of letters inside one', () => {
    // The Spring x Soccer note says "never as evergreen": a raw substring search would put that
    // card next to Green Screen with nothing on it a reader could point at.
    const evergreen = theme({ name: 'Spring x Soccer', notes: 'Never as evergreen.' });

    expect(matchesQuery(evergreen, 'green')).toBe(false);
    expect(matchesQuery(evergreen, 'evergreen')).toBe(true);
  });

  it('still matches a prefix of a word, so a half-typed query narrows as you go', () => {
    expect(matchesQuery(theme(), 'scree')).toBe(true);
    expect(matchesQuery(theme({ category: 'Seasonal', notes: 'Seasonal hook.' }), 'season')).toBe(
      true,
    );
  });

  it('reads a word opened by punctuation, not only by a space', () => {
    expect(matchesQuery(theme({ name: 'POV: X vs Y', notes: null }), 'x')).toBe(true);
    expect(matchesQuery(theme({ name: 'Problem/Solution', notes: null }), 'solution')).toBe(true);
  });
});

describe('referenceChipRow', () => {
  it('shortens each link to its host, dropping the www', () => {
    const row = referenceChipRow([
      'https://www.tiktok.com/@brand/video/7312',
      'https://foreplay.example/boards/x',
    ]);

    expect(row.shown.map((chip) => chip.host)).toEqual(['tiktok.com', 'foreplay.example']);
    expect(row.shown[0]?.url).toBe('https://www.tiktok.com/@brand/video/7312');
    expect(row.overflow).toBe(0);
  });

  it('is empty for a theme with no links, so the card renders no chip row at all', () => {
    expect(referenceChipRow(null).shown).toEqual([]);
    expect(referenceChipRow([]).shown).toEqual([]);
    expect(referenceChipRow(['', '   ']).shown).toEqual([]);
  });

  it('counts the links past the third rather than dropping them', () => {
    const row = referenceChipRow([
      'https://a.example/1',
      'https://b.example/2',
      'https://c.example/3',
      'https://d.example/4',
      'https://e.example/5',
    ]);

    expect(row.shown).toHaveLength(3);
    expect(row.overflow).toBe(2);
    expect(overflowLabel(row.overflow)).toBe('+2');
  });

  it('keeps a value that is not a URL rather than hiding the strategist’s mistake', () => {
    expect(referenceChipRow(['not a url']).shown).toEqual([
      { url: 'not a url', host: 'not a url' },
    ]);
  });
});

describe('categoryFromParam, shared links', () => {
  it.each([
    ['Production Style', 'Production Style'],
    ['production style', 'Production Style'],
    ['production-style', 'Production Style'],
    ['production_style', 'Production Style'],
    ['PRODUCTION+STYLE', 'Production Style'],
    ['seasonal', 'Seasonal'],
    ['framework', 'Framework'],
  ])('reads %s as %s', (param, expected) => {
    expect(categoryFromParam(param)).toBe(expected);
  });

  it('falls back to every category for anything it cannot read', () => {
    expect(categoryFromParam('made-up')).toBe('All');
    expect(categoryFromParam(null)).toBe('All');
    expect(categoryFromParam(undefined)).toBe('All');
  });
});
