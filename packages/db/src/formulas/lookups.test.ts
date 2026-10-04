import { describe, expect, it } from 'vitest';

import {
  briefConceptsFromAngles,
  conceptPerformance,
  creativeNameFromCreative,
  lookupRollup,
} from './lookups';
import { isVirtualFormulaName } from './registry';

describe('lookupRollup', () => {
  it('joins the looked-up values with a comma, in the order the loader resolved them', () => {
    expect(lookupRollup(['20%OFF', 'BFCM26'])).toBe('20%OFF, BFCM26');
    expect(lookupRollup(['Reset Bundle'])).toBe('Reset Bundle');
  });

  it('is null when the link points at nothing, so the cell renders the em dash', () => {
    expect(lookupRollup([])).toBeNull();
  });

  it('drops null, undefined and blank values — an empty looked-up field contributes nothing', () => {
    expect(lookupRollup([null, undefined, '  ', 'BFCM 2026 Collection'])).toBe(
      'BFCM 2026 Collection',
    );
    expect(lookupRollup([null, '', undefined])).toBeNull();
  });

  it('keeps duplicates: two links to rows with the same value show the value twice, as Airtable does', () => {
    expect(lookupRollup(['TOF', 'TOF'])).toBe('TOF, TOF');
  });
});

/**
 * The three lookup readings (GRATSI-MATCH 2026-10-04): pure, deduplicated, blank-dropped, and each
 * registered so a `column_definitions` row may name it — the seed's gate rejects an unregistered
 * formula name, which is what makes a typo in the seed visible before a page renders nothing.
 */
describe('lookup formulas', () => {
  it('joins the linked concept names once each, in order, blanks dropped', () => {
    expect(
      briefConceptsFromAngles(['B1-Hydration-Morning', null, ' ', 'B1-Hydration-Morning', 'B2-X']),
    ).toBe('B1-Hydration-Morning, B2-X');
    expect(briefConceptsFromAngles([])).toBeNull();
    expect(briefConceptsFromAngles([null, undefined, ''])).toBeNull();
  });

  it('reads concept Performance as the unique performances of its briefs', () => {
    expect(conceptPerformance(['Winning', 'Winning', null, 'Underperforming'])).toBe(
      'Winning, Underperforming',
    );
    expect(conceptPerformance([])).toBeNull();
  });

  it('passes the linked creative name through, trimmed, null when there is none', () => {
    expect(creativeNameFromCreative(' TS1-B1-Good Taste-V1 ')).toBe('TS1-B1-Good Taste-V1');
    expect(creativeNameFromCreative(null)).toBeNull();
    expect(creativeNameFromCreative('')).toBeNull();
  });

  it('is registered under exactly the names the seed rows carry', () => {
    for (const name of [
      'briefConceptsFromAngles',
      'conceptPerformance',
      'creativeNameFromCreative',
    ]) {
      expect(isVirtualFormulaName(name), `${name} must be registered`).toBe(true);
    }
  });
});
