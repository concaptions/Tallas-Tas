import { describe, expect, it } from 'vitest';

import {
  BATCHES,
  BATCH_COUNT,
  CONCEPT_CATEGORIES,
  CONCEPT_CATEGORY_KEYS,
  CONCEPT_STYLES,
  CONCEPT_STYLE_KEYS,
  conceptCategoryEntry,
  conceptCategoryLabel,
  conceptStyleEntry,
  conceptStyleLabel,
  isBatch,
  isConceptCategory,
  isConceptStyle,
} from './vocabulary';

describe('BATCHES', () => {
  it('is B1 to B20 in ascending order', () => {
    expect(BATCHES).toEqual(Array.from({ length: 20 }, (_, index) => `B${String(index + 1)}`));
  });

  it('counts twenty', () => {
    expect(BATCH_COUNT).toBe(20);
    expect(BATCHES).toHaveLength(BATCH_COUNT);
  });

  it('holds no duplicate', () => {
    expect(new Set(BATCHES).size).toBe(BATCHES.length);
  });

  it('accepts every batch it lists', () => {
    for (const batch of BATCHES) expect(isBatch(batch)).toBe(true);
  });

  it('refuses a batch outside the range, a lowercase one and a bare number', () => {
    expect(isBatch('B0')).toBe(false);
    expect(isBatch('B21')).toBe(false);
    expect(isBatch('b2')).toBe(false);
    expect(isBatch('2')).toBe(false);
    expect(isBatch('')).toBe(false);
  });
});

describe('CONCEPT_CATEGORIES', () => {
  it('is New then Iteration, the two PRD §5.7 values', () => {
    expect(CONCEPT_CATEGORIES.map((entry) => entry.key)).toEqual(['New', 'Iteration']);
    expect(CONCEPT_CATEGORY_KEYS).toEqual(['New', 'Iteration']);
  });

  it('labels every entry', () => {
    for (const entry of CONCEPT_CATEGORIES) expect(entry.label).toBe(entry.key);
  });

  it('accepts its own keys and refuses anything else', () => {
    expect(isConceptCategory('New')).toBe(true);
    expect(isConceptCategory('Iteration')).toBe(true);
    expect(isConceptCategory('iteration')).toBe(false);
    expect(isConceptCategory('Remix')).toBe(false);
  });

  it('resolves an entry by stored value and nothing for an unknown one', () => {
    expect(conceptCategoryEntry('Iteration')).toEqual({ key: 'Iteration', label: 'Iteration' });
    expect(conceptCategoryEntry('Remix')).toBeUndefined();
  });

  it('renders an unknown stored value back rather than a blank', () => {
    expect(conceptCategoryLabel('New')).toBe('New');
    expect(conceptCategoryLabel('Remix')).toBe('Remix');
  });
});

describe('CONCEPT_STYLES', () => {
  it('is Filming, Editing, AI Concept in production order', () => {
    expect(CONCEPT_STYLES.map((entry) => entry.key)).toEqual(['Filming', 'Editing', 'AI Concept']);
    expect(CONCEPT_STYLE_KEYS).toEqual(['Filming', 'Editing', 'AI Concept']);
  });

  it('labels every entry', () => {
    for (const entry of CONCEPT_STYLES) expect(entry.label).toBe(entry.key);
  });

  it('accepts its own keys and refuses anything else', () => {
    expect(isConceptStyle('Filming')).toBe(true);
    expect(isConceptStyle('AI Concept')).toBe(true);
    expect(isConceptStyle('AI')).toBe(false);
    expect(isConceptStyle('')).toBe(false);
  });

  it('resolves an entry by stored value and nothing for an unknown one', () => {
    expect(conceptStyleEntry('AI Concept')).toEqual({ key: 'AI Concept', label: 'AI Concept' });
    expect(conceptStyleEntry('Animation')).toBeUndefined();
  });

  it('renders an unknown stored value back rather than a blank', () => {
    expect(conceptStyleLabel('Editing')).toBe('Editing');
    expect(conceptStyleLabel('Animation')).toBe('Animation');
  });
});

describe('the vocabularies match what `@tas/db` stores on the demo concepts', () => {
  it('knows every category and style the four fixtures carry', () => {
    for (const category of ['New', 'New', 'Iteration', 'Iteration']) {
      expect(isConceptCategory(category)).toBe(true);
    }
    for (const style of ['Editing', 'Filming', 'AI Concept', 'Filming']) {
      expect(isConceptStyle(style)).toBe(true);
    }
    for (const batch of ['B2', 'B1', 'B2', 'B3']) expect(isBatch(batch)).toBe(true);
  });
});
