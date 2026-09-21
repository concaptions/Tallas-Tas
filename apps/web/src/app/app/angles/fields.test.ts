import { describe, expect, it } from 'vitest';

import {
  ANGLE_GROUP_HEADINGS,
  EM_DASH,
  MAX_ROW_FORMATS,
  NONE_VALUE,
  chipLabel,
  formatChipRow,
  inspoSourceLabel,
  overflowLabel,
} from './fields';

describe('formatChipRow', () => {
  it('keeps the vocabulary order whatever order the row stored', () => {
    const row = formatChipRow(['Carousel', 'Static']);

    expect(row.shown.map((entry) => entry.key)).toEqual(['Static', 'Carousel']);
    expect(row.overflow).toBe(0);
  });

  it('collapses past three so a row never wraps', () => {
    const row = formatChipRow(['Static', 'Video', 'Carousel', 'Motion Graphic']);

    expect(row.shown).toHaveLength(MAX_ROW_FORMATS);
    expect(row.overflow).toBe(1);
    expect(overflowLabel(row.overflow)).toBe('+1');
  });

  it('drops a value outside the vocabulary rather than rendering it raw', () => {
    expect(formatChipRow(['Static', 'Billboard']).shown.map((entry) => entry.key)).toEqual([
      'Static',
    ]);
  });

  it('is empty for an angle with no formats, so the cell can render the dash', () => {
    expect(formatChipRow([])).toEqual({ shown: [], overflow: 0 });
  });
});

describe('chipLabel', () => {
  it('takes the name before the em dash off a seeded persona', () => {
    expect(chipLabel(`Denise ${EM_DASH} peri-menopausal, awake at 3am with night sweats`)).toBe(
      'Denise',
    );
  });

  it('leaves a name with no em dash untouched', () => {
    expect(chipLabel('Niagara Deep Sleep Weighted Blanket')).toBe(
      'Niagara Deep Sleep Weighted Blanket',
    );
  });

  it('falls back to the whole string rather than returning an empty chip', () => {
    expect(chipLabel(`${EM_DASH} nameless`)).toBe(`${EM_DASH} nameless`);
  });
});

describe('inspoSourceLabel', () => {
  it('names every kind parseInspoLink can return', () => {
    expect(inspoSourceLabel('meta-ad-library')).toBe('Meta');
    expect(inspoSourceLabel('youtube')).toBe('YouTube');
    expect(inspoSourceLabel('tiktok')).toBe('TikTok');
    expect(inspoSourceLabel('instagram')).toBe('Instagram');
    expect(inspoSourceLabel('other')).toBe('Link');
  });
});

describe('panel groups', () => {
  it('are the six the design specifies, in order', () => {
    expect(ANGLE_GROUP_HEADINGS).toEqual([
      'Identity',
      'Hypothesis',
      'Pain Points',
      'USP',
      'Targeting',
      'Resources',
    ]);
  });

  it('spells "no link" as the empty string the action stores as NULL', () => {
    expect(NONE_VALUE).toBe('');
  });
});
