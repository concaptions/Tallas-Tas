import { describe, expect, it } from 'vitest';

import {
  ANGLE_FORMATS,
  ANGLE_FORMAT_KEYS,
  ANGLE_TYPES,
  ANGLE_TYPE_KEYS,
  angleFormatEntries,
  angleFormatEntry,
  angleTypeEntries,
  angleTypeEntry,
  isAngleFormat,
  isAngleType,
} from './vocabulary';

describe('ANGLE_FORMATS', () => {
  it('is the four PRD §5.6 formats in render order', () => {
    expect(ANGLE_FORMAT_KEYS).toEqual(['Static', 'Video', 'Carousel', 'Motion Graphic']);
  });

  it('labels every format with its stored value, so the chip needs no mapping', () => {
    expect(ANGLE_FORMATS.map((entry) => entry.label)).toEqual([...ANGLE_FORMAT_KEYS]);
  });
});

describe('ANGLE_TYPES', () => {
  it('is the four PRD §5.6 types', () => {
    expect(ANGLE_TYPE_KEYS).toEqual(['Emotional', 'Functional', 'Identity', 'Critical']);
  });

  it('gives every type a label and a chip tone', () => {
    expect(ANGLE_TYPES.map((entry) => entry.tone)).toEqual(['accent', 'info', 'ok', 'warn']);
    expect(ANGLE_TYPES.every((entry) => entry.label === entry.key)).toBe(true);
  });

  it('gives each type its own tone, so four chips stay distinguishable', () => {
    expect(new Set(ANGLE_TYPES.map((entry) => entry.tone)).size).toBe(ANGLE_TYPES.length);
  });
});

describe('isAngleFormat / isAngleType', () => {
  it('accepts a stored value and refuses anything else', () => {
    expect(isAngleFormat('Motion Graphic')).toBe(true);
    expect(isAngleFormat('motion graphic')).toBe(false);
    expect(isAngleType('Critical')).toBe(true);
    expect(isAngleType('')).toBe(false);
  });
});

describe('angleFormatEntry / angleTypeEntry', () => {
  it('finds the entry for a stored value', () => {
    expect(angleFormatEntry('Video')).toEqual({ key: 'Video', label: 'Video' });
    expect(angleTypeEntry('Identity')).toEqual({ key: 'Identity', label: 'Identity', tone: 'ok' });
  });

  it('returns undefined for a value this build does not know', () => {
    expect(angleFormatEntry('Podcast')).toBeUndefined();
    expect(angleTypeEntry('Rational')).toBeUndefined();
  });
});

describe('angleFormatEntries', () => {
  it('renders in the fixed order, not the stored order', () => {
    expect(angleFormatEntries(['Motion Graphic', 'Static']).map((entry) => entry.key)).toEqual([
      'Static',
      'Motion Graphic',
    ]);
  });

  it('collapses a duplicate and drops an unknown value', () => {
    expect(angleFormatEntries(['Video', 'Video', 'Podcast']).map((entry) => entry.key)).toEqual([
      'Video',
    ]);
  });

  it('returns nothing for an empty selection, so the page renders its em dash', () => {
    expect(angleFormatEntries([])).toEqual([]);
  });
});

describe('angleTypeEntries', () => {
  it('renders in the fixed order and drops an unknown value', () => {
    expect(
      angleTypeEntries(['Critical', 'Rational', 'Emotional']).map((entry) => entry.key),
    ).toEqual(['Emotional', 'Critical']);
  });

  it('returns nothing for an empty selection', () => {
    expect(angleTypeEntries([])).toEqual([]);
  });
});
