import { describe, expect, it } from 'vitest';

import {
  BRIEF_AUTO_NAME_CONCEPT_MAX,
  BRIEF_AUTO_NAME_DEFAULT_SOURCE,
  BRIEF_AUTO_NAME_SEPARATOR,
  BRIEF_AUTO_NAME_SOURCES,
  buildBriefName,
  normaliseConceptSlug,
  normaliseFunnelForName,
  typeInitial,
} from './auto-name';

/**
 * Ticket 3 — Oct 14 auto-naming formula. One file, every edge the spec names: every type letter,
 * every source, hyphen collisions, concept-name truncation at and beyond the 40-character limit,
 * and the collapse of optional segments when the preview has not been filled in yet.
 */
describe('typeInitial', () => {
  it('maps the four stored types to the one-letter head segment', () => {
    expect(typeInitial('Video')).toBe('V');
    expect(typeInitial('Static')).toBe('S');
    expect(typeInitial('Carousel')).toBe('C');
    expect(typeInitial('Motion Image')).toBe('M');
  });

  it('is case-insensitive on the first character', () => {
    expect(typeInitial('video')).toBe('V');
    expect(typeInitial('static')).toBe('S');
  });

  it('falls back to V for an unknown first letter so the head keeps its shape', () => {
    expect(typeInitial('zebra')).toBe('V');
    expect(typeInitial('')).toBe('V');
  });
});

describe('normaliseFunnelForName', () => {
  it('maps the stored CREATIVE_FUNNELS keys to codes', () => {
    expect(normaliseFunnelForName('TOF')).toBe('TOF');
    expect(normaliseFunnelForName('Retargeting')).toBe('RTG');
    expect(normaliseFunnelForName('All Funnels')).toBe('ALL');
  });

  it('maps middle- and bottom-of-funnel long names to their codes', () => {
    expect(normaliseFunnelForName('Middle of Funnel')).toBe('MOF');
    expect(normaliseFunnelForName('Bottom of Funnel')).toBe('BOF');
    expect(normaliseFunnelForName('MOF')).toBe('MOF');
    expect(normaliseFunnelForName('BOF')).toBe('BOF');
  });

  it('is case-insensitive and idempotent on existing codes', () => {
    expect(normaliseFunnelForName('tof')).toBe('TOF');
    expect(normaliseFunnelForName('rtg')).toBe('RTG');
  });

  it('falls back to the first three letters uppercased for an unknown funnel', () => {
    expect(normaliseFunnelForName('Awareness')).toBe('AWA');
    expect(normaliseFunnelForName('')).toBe('');
  });
});

describe('normaliseConceptSlug', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(normaliseConceptSlug('Summer Sale')).toBe('summer-sale');
    expect(normaliseConceptSlug('Holiday Push')).toBe('holiday-push');
  });

  it('maps every non-alphanumeric run to a single hyphen', () => {
    expect(normaliseConceptSlug('Hello, world!')).toBe('hello-world');
    expect(normaliseConceptSlug('a---b')).toBe('a-b');
    expect(normaliseConceptSlug('x / y / z')).toBe('x-y-z');
  });

  it('collapses an all-hyphens input to the empty string so the segment drops', () => {
    expect(normaliseConceptSlug('---')).toBe('');
    expect(normaliseConceptSlug('-')).toBe('');
  });

  it('returns the empty string for null, undefined or whitespace-only input', () => {
    expect(normaliseConceptSlug(null)).toBe('');
    expect(normaliseConceptSlug(undefined)).toBe('');
    expect(normaliseConceptSlug('   ')).toBe('');
  });

  it('keeps a slug at the exact 40-character limit untouched', () => {
    const limit = 'a'.repeat(BRIEF_AUTO_NAME_CONCEPT_MAX);
    const slug = normaliseConceptSlug(limit);
    expect(slug).toBe(limit);
    expect(slug.length).toBe(BRIEF_AUTO_NAME_CONCEPT_MAX);
  });

  it('truncates past the limit with an ellipsis that counts toward the length', () => {
    const over = 'a'.repeat(BRIEF_AUTO_NAME_CONCEPT_MAX + 10);
    const slug = normaliseConceptSlug(over);
    expect(slug.length).toBe(BRIEF_AUTO_NAME_CONCEPT_MAX);
    expect(slug.endsWith('…')).toBe(true);
    expect(slug).toBe(`${'a'.repeat(BRIEF_AUTO_NAME_CONCEPT_MAX - 1)}…`);
  });

  it('does not leave a trailing hyphen before the ellipsis when the cut lands on one', () => {
    // "the-quick-brown-fox-..." — truncating onto a hyphen would read "...fox-…", which the trim
    // step strips before the ellipsis is appended.
    const input = 'the-quick-brown-fox-jumps-over-the-lazy-dog-in-september';
    const slug = normaliseConceptSlug(input);
    expect(slug.length).toBeLessThanOrEqual(BRIEF_AUTO_NAME_CONCEPT_MAX);
    expect(slug.endsWith('-…')).toBe(false);
    expect(slug.endsWith('…')).toBe(true);
  });

  it('honours a custom maxLength', () => {
    expect(normaliseConceptSlug('Summer Sale', 6)).toBe('summe…');
    expect(normaliseConceptSlug('Summer Sale', 0)).toBe('');
  });
});

describe('buildBriefName', () => {
  it('produces the full form with every segment present', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: 'Summer Sale',
        conceptBatch: 'Batch 1',
      }),
    ).toBe('TAS_TOF_V_001_summer-sale_Batch 1');
  });

  it('zero-pads the number and uppercases the Static initial', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'Retargeting',
        type: 'Static',
        number: 42,
        conceptName: 'Holiday Push',
        conceptBatch: 'Batch 3',
      }),
    ).toBe('TAS_RTG_S_042_holiday-push_Batch 3');
  });

  it('writes the Carousel and Motion Image head segments', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Carousel',
        number: 100,
        conceptName: 'Spring',
        conceptBatch: 'Batch 2',
      }),
    ).toBe('TAS_TOF_C_100_spring_Batch 2');

    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Motion Image',
        number: 7,
        conceptName: 'Winter',
        conceptBatch: 'Batch 4',
      }),
    ).toBe('TAS_TOF_M_007_winter_Batch 4');
  });

  it('writes each of the three sources at the head', () => {
    for (const source of BRIEF_AUTO_NAME_SOURCES) {
      expect(
        buildBriefName({
          source,
          funnel: 'TOF',
          type: 'Video',
          number: 1,
          conceptName: 'Summer',
          conceptBatch: 'Batch 1',
        }),
      ).toBe(`${source}_TOF_V_001_summer_Batch 1`);
    }
  });

  it('defaults a blank source to TAS so the head never shrinks', () => {
    expect(
      buildBriefName({
        source: '',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: 'Summer',
        conceptBatch: 'Batch 1',
      }),
    ).toBe(`${BRIEF_AUTO_NAME_DEFAULT_SOURCE}_TOF_V_001_summer_Batch 1`);

    expect(
      buildBriefName({
        source: null,
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: 'Summer',
        conceptBatch: 'Batch 1',
      }),
    ).toBe(`${BRIEF_AUTO_NAME_DEFAULT_SOURCE}_TOF_V_001_summer_Batch 1`);
  });

  it('drops the concept segment when the name is empty or all hyphens', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: null,
        conceptBatch: 'Batch 1',
      }),
    ).toBe('TAS_TOF_V_001_Batch 1');

    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: '---',
        conceptBatch: 'Batch 1',
      }),
    ).toBe('TAS_TOF_V_001_Batch 1');
  });

  it('drops the batch segment when the concept has no batch', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
        conceptName: 'Summer',
        conceptBatch: null,
      }),
    ).toBe('TAS_TOF_V_001_summer');
  });

  it('collapses both optional segments on a bare preview', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1,
      }),
    ).toBe('TAS_TOF_V_001');
  });

  it('truncates a long concept with an ellipsis before joining the segments', () => {
    const concept = 'The quick brown fox jumps over the lazy dog in September every single year';
    const name = buildBriefName({
      source: 'TAS',
      funnel: 'TOF',
      type: 'Video',
      number: 1,
      conceptName: concept,
      conceptBatch: 'Batch 1',
    });
    const parts = name.split(BRIEF_AUTO_NAME_SEPARATOR);
    const conceptPart = parts[4] ?? '';
    expect(conceptPart.length).toBeLessThanOrEqual(BRIEF_AUTO_NAME_CONCEPT_MAX);
    expect(conceptPart.endsWith('…')).toBe(true);
  });

  it('keeps a 4-digit number for a brand past 999 creatives', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 1000,
      }),
    ).toBe('TAS_TOF_V_1000');
  });

  it('clamps a non-positive or non-integer number to 000', () => {
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: 0,
      }),
    ).toBe('TAS_TOF_V_000');
    expect(
      buildBriefName({
        source: 'TAS',
        funnel: 'TOF',
        type: 'Video',
        number: Number.NaN,
      }),
    ).toBe('TAS_TOF_V_000');
  });
});
