import { describe, expect, it } from 'vitest';

import { inheritedFromAngle } from './inherited-from-angle';

const BASE = { description: 'Hypothesis', painPoints: null, usp: null };

describe('inherited lookups: every persona and product of the angle (LINK-02)', () => {
  it('lists all linked names, comma-joined, in the angle order', () => {
    const fields = inheritedFromAngle({
      ...BASE,
      personaName: 'Denise',
      productName: 'Sleep Mask',
      personaNames: ['Denise', 'Marcus'],
      productNames: ['Sleep Mask', 'Weighted Blanket'],
    });
    expect(fields.find((f) => f.key === 'personaName')?.value).toBe('Denise, Marcus');
    expect(fields.find((f) => f.key === 'productName')?.value).toBe('Sleep Mask, Weighted Blanket');
  });

  it('falls back to the single resolved name, then to null for the dash', () => {
    const single = inheritedFromAngle({ ...BASE, personaName: 'Denise', productName: null });
    expect(single.find((f) => f.key === 'personaName')?.value).toBe('Denise');
    expect(single.find((f) => f.key === 'productName')?.value).toBeNull();

    const empty = inheritedFromAngle({
      ...BASE,
      personaName: null,
      productName: null,
      personaNames: [' '],
      productNames: [],
    });
    expect(empty.find((f) => f.key === 'personaName')?.value).toBeNull();
    expect(empty.find((f) => f.key === 'productName')?.value).toBeNull();
  });

  it('is read-only data: the lists are never written back onto the concept', () => {
    // The function returns labelled values only; there is no setter and no concept column for
    // them (the schema has none), which is the shape of "do not store copies".
    const fields = inheritedFromAngle(null);
    expect(fields.map((f) => f.key)).toEqual([
      'description',
      'painPoints',
      'usp',
      'personaName',
      'productName',
    ]);
    expect(fields.every((f) => f.value === null)).toBe(true);
  });
});
