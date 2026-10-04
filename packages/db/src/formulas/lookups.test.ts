import { describe, expect, it } from 'vitest';

import { lookupRollup } from './lookups';

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
