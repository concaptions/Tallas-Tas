import { describe, expect, it } from 'vitest';

import {
  ALL_CATEGORIES,
  CATEGORY_FILTERS,
  EMPTY_FIELD,
  GLOBAL_BADGE_LABEL,
  GLOBAL_BADGE_NOTE,
  GLOBAL_BADGE_TONE,
  THEME_FIELD_LABELS,
  UNRESOLVED_ASSIGNEE_HINT,
  assigneeValue,
  attachmentChipRow,
  attachmentLabel,
  categoryFromParam,
  filteredCountLabel,
  libraryCountLabel,
  matchesCategory,
  matchesQuery,
  overflowLabel,
  referenceChipRow,
  statusChip,
  textValue,
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

describe('the labelled rows', () => {
  it('names every Gratsi stored field with the exact label the parity spec looks for', () => {
    expect(Object.values(THEME_FIELD_LABELS)).toEqual([
      'Notes',
      'Assignee',
      'Status',
      'Attachments',
      'Attachment Summary',
    ]);
  });

  it('shows a dash under an empty label, never a blank', () => {
    expect(EMPTY_FIELD).toBe('—');
  });
});

describe('textValue', () => {
  it('trims a note and turns a blank or missing one into null', () => {
    expect(textValue('  Keep the losing side a situation.  ')).toBe(
      'Keep the losing side a situation.',
    );
    expect(textValue('')).toBeNull();
    expect(textValue('   ')).toBeNull();
    expect(textValue(null)).toBeNull();
    expect(textValue(undefined)).toBeNull();
  });
});

describe('statusChip', () => {
  it('reads the tone and the label from the theme vocabulary, never a local choice', () => {
    expect(statusChip('not_started')).toEqual({ tone: 'mute', label: 'Not Started' });
    expect(statusChip('in_progress')).toEqual({ tone: 'accent', label: 'In Progress' });
    expect(statusChip('done')).toEqual({ tone: 'ok', label: 'Done' });
    expect(statusChip('archived')).toEqual({ tone: 'warn', label: 'Archived' });
  });

  it('is null for no status, so the row shows the dash rather than a chip reading one', () => {
    expect(statusChip(null)).toBeNull();
    expect(statusChip(undefined)).toBeNull();
    expect(statusChip('')).toBeNull();
  });

  it('keeps a stored value this build does not know visible, in the quiet tone', () => {
    expect(statusChip('blocked')).toEqual({ tone: 'mute', label: 'blocked' });
  });
});

describe('assigneeValue', () => {
  it('prefers the resolved name, in prose', () => {
    expect(assigneeValue({ assigneeId: 'user_seed_csm', assigneeName: 'Callum Ashworth' })).toEqual(
      { text: 'Callum Ashworth', mono: false },
    );
  });

  it('falls back to the stored value, in mono, when no user matched it', () => {
    expect(assigneeValue({ assigneeId: 'user_who_left', assigneeName: null })).toEqual({
      text: 'user_who_left',
      mono: true,
    });
    // An imported Gratsi row stores the Airtable collaborator's name and has no resolved name.
    expect(assigneeValue({ assigneeId: 'Alex Rivera' })).toEqual({
      text: 'Alex Rivera',
      mono: true,
    });
  });

  it('is null for the dash when nothing is stored', () => {
    expect(assigneeValue({ assigneeId: null, assigneeName: null })).toBeNull();
    expect(assigneeValue({})).toBeNull();
    expect(assigneeValue({ assigneeId: '   ', assigneeName: '' })).toBeNull();
  });

  it('explains an unresolved value in its tooltip', () => {
    expect(UNRESOLVED_ASSIGNEE_HINT).toContain('matches no user');
  });
});

describe('attachmentLabel', () => {
  it('reads the file name off a URL that ends in one, decoded', () => {
    expect(
      attachmentLabel(
        'https://v5.airtableusercontent.com/v3/u/48/48/1759363200000/abc/cover%20still.png?x=1',
      ),
    ).toBe('cover still.png');
  });

  it('falls back to the host when the path is a signed token with no file name', () => {
    expect(
      attachmentLabel('https://v5.airtableusercontent.com/v3/u/48/48/1759363200000/abcDEF/ghiJKL'),
    ).toBe('v5.airtableusercontent.com');
    expect(attachmentLabel('https://dl.airtable.com/')).toBe('dl.airtable.com');
  });

  it('keeps a value that is not a URL rather than hiding it', () => {
    expect(attachmentLabel('not a url')).toBe('not a url');
  });
});

describe('attachmentChipRow', () => {
  it('is empty for a theme with no attachments, so the row shows the dash', () => {
    expect(attachmentChipRow(null)).toEqual({ shown: [], overflow: 0 });
    expect(attachmentChipRow(undefined)).toEqual({ shown: [], overflow: 0 });
    expect(attachmentChipRow(['', '  ']).shown).toEqual([]);
  });

  it('labels each chip, keeps the full URL for the link, and counts the rest past the third', () => {
    const row = attachmentChipRow([
      'https://cdn.example/a/hook-still.png',
      'https://cdn.example/b/script.pdf',
      'https://cdn.example/c/cut.mp4',
      'https://cdn.example/d/extra.jpg',
    ]);

    expect(row.shown).toEqual([
      { url: 'https://cdn.example/a/hook-still.png', label: 'hook-still.png' },
      { url: 'https://cdn.example/b/script.pdf', label: 'script.pdf' },
      { url: 'https://cdn.example/c/cut.mp4', label: 'cut.mp4' },
    ]);
    expect(row.overflow).toBe(1);
    expect(overflowLabel(row.overflow)).toBe('+1');
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
