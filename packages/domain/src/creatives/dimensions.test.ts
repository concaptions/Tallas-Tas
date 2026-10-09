import { describe, expect, it } from 'vitest';

import {
  applyDimensionChange,
  creativeDimensionDisplay,
  DIMENSION_OPTIONS,
  dimensionOptionsFor,
  isKnownOrLegacyDimension,
  isLegacyDimensionName,
  normalizeCreativeDimension,
  normalizeCreativeDimensions,
} from './dimensions';
import { CREATIVE_DIMENSION_KEYS } from './vocabulary';

describe('normalizeCreativeDimension', () => {
  it('returns a §8 key unchanged, so normalising is idempotent on platform data', () => {
    for (const key of CREATIVE_DIMENSION_KEYS) {
      expect(normalizeCreativeDimension(key)).toBe(key);
      expect(normalizeCreativeDimension(normalizeCreativeDimension(key))).toBe(key);
    }
  });

  it.each([
    ['IG Story / Reel', '9:16'],
    ['FB / Meta Reel', '9:16'],
    ['Facebook Reels', '9:16'],
    ['IG Feed Post', '1:1'],
    ['Facebook Feed Square', '1:1'],
    ['Portrait', '4:5'],
  ])('maps the Airtable placement name %s to %s', (name, key) => {
    expect(normalizeCreativeDimension(name)).toBe(key);
  });

  it.each([
    ['1080x1920', '9:16'],
    ['1080x1080', '1:1'],
    ['1080x1350', '4:5'],
  ])('maps the pixel size %s the Creative Dimensions records carry to %s', (pixels, key) => {
    expect(normalizeCreativeDimension(pixels)).toBe(key);
  });

  it('ignores case and surrounding whitespace in a legacy name', () => {
    expect(normalizeCreativeDimension('  ig feed post ')).toBe('1:1');
    expect(normalizeCreativeDimension(' 9:16 ')).toBe('9:16');
  });

  it('passes an unknown name through trimmed rather than dropping or guessing it', () => {
    expect(normalizeCreativeDimension('  Billboard 970x250 ')).toBe('Billboard 970x250');
    expect(normalizeCreativeDimension('Billboard 970x250')).toBe('Billboard 970x250');
  });

  it('round-trips: a legacy name normalised once is a key and normalises to itself again', () => {
    const once = normalizeCreativeDimension('IG Story / Reel');
    expect(CREATIVE_DIMENSION_KEYS).toContain(once);
    expect(normalizeCreativeDimension(once)).toBe(once);
  });
});

describe('isKnownOrLegacyDimension', () => {
  it('accepts the three keys and every mapped legacy name', () => {
    for (const value of [...CREATIVE_DIMENSION_KEYS, 'IG Story / Reel', 'IG Feed Post']) {
      expect(isKnownOrLegacyDimension(value)).toBe(true);
    }
  });

  it('accepts an imported name this build does not know, so a re-save never loses it', () => {
    expect(isKnownOrLegacyDimension('Billboard 970x250')).toBe(true);
  });

  it('refuses a ratio outside the §8 three: the platform vocabulary stays closed', () => {
    expect(isKnownOrLegacyDimension('21:9')).toBe(false);
    expect(isKnownOrLegacyDimension('16 : 9')).toBe(false);
    expect(isKnownOrLegacyDimension('4:5')).toBe(true);
  });

  it('refuses the empty string, whitespace, a line break and a paragraph', () => {
    expect(isKnownOrLegacyDimension('')).toBe(false);
    expect(isKnownOrLegacyDimension('   ')).toBe(false);
    expect(isKnownOrLegacyDimension('IG\nStory')).toBe(false);
    expect(isKnownOrLegacyDimension('x'.repeat(81))).toBe(false);
  });
});

describe('isLegacyDimensionName', () => {
  it('is true only for a name that normalises to a key, never for the key itself', () => {
    expect(isLegacyDimensionName('IG Feed Post')).toBe(true);
    expect(isLegacyDimensionName('1:1')).toBe(false);
    expect(isLegacyDimensionName('Billboard')).toBe(false);
  });
});

describe('normalizeCreativeDimensions', () => {
  it('normalises, deduplicates and orders keys as CREATIVE_DIMENSIONS, legacy names after', () => {
    expect(
      normalizeCreativeDimensions(['9:16', 'IG Feed Post', '1:1', 'Billboard', ' 4:5']),
    ).toEqual(['4:5', '1:1', '9:16', 'Billboard']);
    expect(normalizeCreativeDimensions([])).toEqual([]);
  });
});

describe('DIMENSION_OPTIONS and dimensionOptionsFor', () => {
  it('offers the three §8 ratios, keyed on the stored value, labelled with the pixel size', () => {
    expect(DIMENSION_OPTIONS.map((option) => option.key)).toEqual([...CREATIVE_DIMENSION_KEYS]);
    expect(DIMENSION_OPTIONS[1]).toEqual({
      key: '1:1',
      label: '1:1 · 1080x1080',
      pixels: '1080x1080',
    });
  });

  it('adds a legacy name the row carries as its own option, after the ratios, and a mapped name as nothing extra', () => {
    const options = dimensionOptionsFor(['Billboard', 'IG Feed Post']);
    expect(options.map((option) => option.key)).toEqual([...CREATIVE_DIMENSION_KEYS, 'Billboard']);
    expect(options.at(-1)).toEqual({ key: 'Billboard', label: 'Billboard', pixels: null });
  });

  it('displays a stored value as its key where it has one and as itself otherwise', () => {
    expect(creativeDimensionDisplay('IG Story / Reel')).toBe('9:16');
    expect(creativeDimensionDisplay('Billboard')).toBe('Billboard');
  });
});

describe('applyDimensionChange', () => {
  /**
   * The rule a save-on-tick picker needs: one tick is ONE change to the STORED array, merged on the
   * server — never a replacement with whatever the browser happened to hold. The 2026-10-10 smoke
   * test found the brief page's picker reading an imported brief as empty; had its tick saved, it
   * would have replaced `['4:5', '1:1', '9:16']` with `['1:1']`. A change merges instead.
   */
  it('adds a ratio to the stored array and keeps every other value', () => {
    expect(
      applyDimensionChange(['4:5', '1:1', '9:16'], ['4:5', '1:1'], { op: 'add', key: '1:1' }),
    ).toEqual(['4:5', '1:1', '9:16']);
    expect(applyDimensionChange(['4:5'], ['4:5', '1:1'], { op: 'add', key: '9:16' })).toEqual([
      '4:5',
      '9:16',
    ]);
  });

  it('normalises an imported placement name before merging, so a legacy row keeps its ratios', () => {
    expect(
      applyDimensionChange(['Facebook Reels', 'Facebook Feed Square'], ['4:5'], {
        op: 'add',
        key: '4:5',
      }),
    ).toEqual(['4:5', '1:1', '9:16']);
  });

  it('keeps a legacy name this build cannot place through an add and a remove of a ratio', () => {
    expect(applyDimensionChange(['Meta', '1:1'], ['4:5'], { op: 'add', key: '9:16' })).toEqual([
      '1:1',
      '9:16',
      'Meta',
    ]);
    expect(applyDimensionChange(['Meta', '1:1'], ['4:5'], { op: 'remove', key: '1:1' })).toEqual([
      'Meta',
    ]);
  });

  it('removes a ratio, accepting the key in either spelling', () => {
    expect(
      applyDimensionChange(['4:5', '9:16'], ['4:5'], { op: 'remove', key: 'IG Story / Reel' }),
    ).toEqual(['4:5']);
  });

  it('starts from the §8 defaults when the row carries nothing, so the first tick does not drop them', () => {
    expect(applyDimensionChange([], ['4:5', '1:1'], { op: 'add', key: '9:16' })).toEqual([
      '4:5',
      '1:1',
      '9:16',
    ]);
    expect(applyDimensionChange([], ['4:5', '1:1'], { op: 'remove', key: '4:5' })).toEqual(['1:1']);
  });
});
