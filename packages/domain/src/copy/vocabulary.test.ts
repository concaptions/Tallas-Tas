import { describe, expect, it } from 'vitest';

import {
  COPY_CTAS,
  COPY_CTA_INITIAL,
  COPY_CTA_KEYS,
  copyCtaEntry,
  copyCtaLabel,
  isCopyCta,
} from './vocabulary';

describe('COPY_CTAS · the PRD §5.11 call-to-action vocabulary', () => {
  it('is exactly the six CTAs, in the order the PRD lists them', () => {
    expect(COPY_CTAS.map((entry) => entry.key)).toEqual([
      'Shop Now',
      'Learn More',
      'Get Offer',
      'Get Directions',
      'Visit Us',
      'Download',
    ]);
  });

  it('labels each CTA with the words that appear on the button', () => {
    for (const entry of COPY_CTAS) {
      expect(entry.label).toBe(entry.key);
    }
  });

  it('has no duplicate key', () => {
    expect(new Set(COPY_CTA_KEYS).size).toBe(COPY_CTAS.length);
  });

  it("defaults to Shop Now — the value @tas/db's COPY_CTA_DEFAULT copies", () => {
    expect(COPY_CTA_INITIAL).toBe('Shop Now');
    expect(COPY_CTA_INITIAL).toBe(COPY_CTAS[0].key);
  });

  it('exposes the keys in the same order as the entries', () => {
    expect(COPY_CTA_KEYS).toEqual(COPY_CTAS.map((entry) => entry.key));
  });
});

describe('isCopyCta', () => {
  it.each(COPY_CTA_KEYS)('accepts %s', (key) => {
    expect(isCopyCta(key)).toBe(true);
  });

  it.each([
    ['', 'the empty string a fresh form holds'],
    ['shop now', 'the right words, wrong case'],
    ['Shop  Now', 'a double space'],
    ['Buy Now', 'a CTA Meta offers that the PRD did not list'],
  ])('refuses %s (%s)', (value) => {
    expect(isCopyCta(value)).toBe(false);
  });
});

describe('copyCtaEntry / copyCtaLabel', () => {
  it.each(COPY_CTAS)('finds the entry for $key', (entry) => {
    expect(copyCtaEntry(entry.key)).toEqual(entry);
    expect(copyCtaLabel(entry.key)).toBe(entry.label);
  });

  it('has no entry for a value this build does not know', () => {
    expect(copyCtaEntry('Buy Now')).toBeUndefined();
  });

  it('renders an unknown stored value back, so a cell is never blank', () => {
    expect(copyCtaLabel('Buy Now')).toBe('Buy Now');
    expect(copyCtaLabel('')).toBe('');
  });
});
