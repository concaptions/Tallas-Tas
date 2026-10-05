import { describe, expect, it } from 'vitest';

import {
  BRIEF_NAME_DEFAULT_SOURCE,
  funnelAbbreviation,
  generateBriefName,
} from './generate-brief-name';

/**
 * The spec cases from the Oct 5 orchestrator paste, plus the adversarial edges the write path has
 * to survive — an empty concept and batch (preview-time, no choice made yet), a legacy allocation
 * that returned 0 or a float, numbers past 999 (brand grows past the padded width), a trimmed-only
 * source. One formula, one file; nothing else re-states the hyphen or the 3-digit padding.
 */
describe('generateBriefName (Oct 5 brief auto-naming formula)', () => {
  it('produces the TAS/TOF/Video example verbatim', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 1,
        concept: 'Summer Sale',
        batch: 'Batch 1',
      }),
    ).toBe('TAS-TOF-V001-Summer Sale-Batch 1');
  });

  it('zero-pads a two-digit number to three positions and uppercases the Static initial', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'RTG',
        creativeType: 'Static',
        number: 42,
        concept: 'Holiday Push',
        batch: 'Batch 3',
      }),
    ).toBe('TAS-RTG-S042-Holiday Push-Batch 3');
  });

  it('keeps three digits unchanged for a round hundred (Carousel)', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Carousel',
        number: 100,
        concept: 'Spring',
        batch: 'Batch 2',
      }),
    ).toBe('TAS-TOF-C100-Spring-Batch 2');
  });

  it('defaults an empty source to TAS so the head never shrinks', () => {
    expect(
      generateBriefName({
        source: '',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 5,
        concept: 'Test',
        batch: 'Batch 1',
      }),
    ).toBe(`${BRIEF_NAME_DEFAULT_SOURCE}-TOF-V005-Test-Batch 1`);
  });

  it('collapses empty concept and batch segments, with no trailing or double dashes', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 1,
        concept: '',
        batch: '',
      }),
    ).toBe('TAS-TOF-V001');
  });

  // ── Adversarial edges, not in the paste ──────────────────────────────────────────────────────

  it('also defaults a null source (preview-time, the field is unset)', () => {
    expect(
      generateBriefName({
        source: null,
        funnel: 'TOF',
        creativeType: 'Video',
        number: 7,
        concept: null,
        batch: null,
      }),
    ).toBe('TAS-TOF-V007');
  });

  it('trims surrounding whitespace on every text segment', () => {
    expect(
      generateBriefName({
        source: '  TAS  ',
        funnel: ' TOF ',
        creativeType: ' Video ',
        number: 9,
        concept: '  Night Launch  ',
        batch: '  Batch 1  ',
      }),
    ).toBe('TAS-TOF-V009-Night Launch-Batch 1');
  });

  it('keeps 4-digit numbers as 4 digits — never truncates the counter', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 1234,
        concept: null,
        batch: null,
      }),
    ).toBe('TAS-TOF-V1234');
  });

  it('reads a non-positive number as 000, so a legacy allocation is honest rather than silent', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 0,
        concept: null,
        batch: null,
      }),
    ).toBe('TAS-TOF-V000');
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: -1,
        concept: null,
        batch: null,
      }),
    ).toBe('TAS-TOF-V000');
  });

  it('collapses an empty funnel too — the head reads type-initial-number without it', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: '',
        creativeType: 'Video',
        number: 3,
        concept: 'X',
        batch: null,
      }),
    ).toBe('TAS-V003-X');
  });

  it('reads an empty creativeType as no initial — collapse rather than throw', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: '',
        number: 2,
        concept: null,
        batch: null,
      }),
    ).toBe('TAS-TOF-002');
  });
});

/**
 * Funnel segment mapping (Oct 6 fix). The stored vocabulary spells funnels out — "Top of Funnel",
 * "Retargeting" — and the brief name has to abbreviate them. `funnelAbbreviation` is the one
 * function doing it; `generateBriefName` calls it. The pins below cover the shipped vocabulary,
 * the idempotent pass-through for abbreviations already in form, the case-insensitive matching,
 * and the fallback for a funnel outside the vocabulary.
 */
describe('funnelAbbreviation', () => {
  it('maps the full stored names to their three-letter forms', () => {
    expect(funnelAbbreviation('Top of Funnel')).toBe('TOF');
    expect(funnelAbbreviation('Middle of Funnel')).toBe('MOF');
    expect(funnelAbbreviation('Mid Funnel')).toBe('MOF');
    expect(funnelAbbreviation('Bottom of Funnel')).toBe('BOF');
    expect(funnelAbbreviation('Retargeting')).toBe('RTG');
    expect(funnelAbbreviation('All Funnels')).toBe('ALL');
  });

  it('passes through values already in the three-letter form (idempotent)', () => {
    expect(funnelAbbreviation('TOF')).toBe('TOF');
    expect(funnelAbbreviation('RTG')).toBe('RTG');
    expect(funnelAbbreviation('MOF')).toBe('MOF');
  });

  it('matches case-insensitively, as the hand-typed and legacy-form submissions arrive', () => {
    expect(funnelAbbreviation('retargeting')).toBe('RTG');
    expect(funnelAbbreviation('TOP OF FUNNEL')).toBe('TOF');
    expect(funnelAbbreviation('mid funnel')).toBe('MOF');
  });

  it('falls back to the first three characters uppercased for an unknown funnel', () => {
    expect(funnelAbbreviation('Awareness')).toBe('AWA');
    expect(funnelAbbreviation('Prospecting')).toBe('PRO');
  });

  it('returns the empty string when the funnel is empty, so the segment collapses', () => {
    expect(funnelAbbreviation('')).toBe('');
    expect(funnelAbbreviation('   ')).toBe('');
  });
});

describe('generateBriefName with full funnel names (Oct 6)', () => {
  it('maps the full stored "Retargeting" to RTG in the printed name', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'Retargeting',
        creativeType: 'Video',
        number: 1,
        concept: 'Summer',
        batch: 'B1',
      }),
    ).toBe('TAS-RTG-V001-Summer-B1');
  });

  it('maps "Top of Funnel" to TOF the same way', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'Top of Funnel',
        creativeType: 'Video',
        number: 1,
        concept: 'Summer',
        batch: 'B1',
      }),
    ).toBe('TAS-TOF-V001-Summer-B1');
  });

  it('keeps already-abbreviated input unchanged, so Agent 3 fixtures still read verbatim', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'TOF',
        creativeType: 'Video',
        number: 1,
        concept: 'Summer Sale',
        batch: 'Batch 1',
      }),
    ).toBe('TAS-TOF-V001-Summer Sale-Batch 1');
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'RTG',
        creativeType: 'Static',
        number: 42,
        concept: 'Holiday Push',
        batch: 'Batch 3',
      }),
    ).toBe('TAS-RTG-S042-Holiday Push-Batch 3');
  });

  it('handles an unknown funnel with the three-char fallback (Awareness → AWA)', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'Awareness',
        creativeType: 'Video',
        number: 1,
        concept: 'Test',
        batch: 'B1',
      }),
    ).toBe('TAS-AWA-V001-Test-B1');
  });

  it('is case insensitive at the generator too', () => {
    expect(
      generateBriefName({
        source: 'TAS',
        funnel: 'retargeting',
        creativeType: 'Video',
        number: 1,
        concept: 'Test',
        batch: 'B1',
      }),
    ).toBe('TAS-RTG-V001-Test-B1');
  });
});
