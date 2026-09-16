import { describe, expect, it } from 'vitest';

import { NO_USAGE_LABEL, usageLabel } from './usage-label';

describe('usageLabel', () => {
  it('reads as words at zero, never "0 brands"', () => {
    expect(usageLabel(0)).toBe(NO_USAGE_LABEL);
    expect(usageLabel(0)).toBe('Used by no brands yet');
    expect(usageLabel(0)).not.toContain('0');
  });

  it('is singular at one', () => {
    expect(usageLabel(1)).toBe('Used by 1 brand');
    expect(usageLabel(1)).not.toContain('brands');
  });

  it('is plural at two and above', () => {
    expect(usageLabel(2)).toBe('Used by 2 brands');
    expect(usageLabel(4)).toBe('Used by 4 brands');
    expect(usageLabel(137)).toBe('Used by 137 brands');
  });

  it('folds a count that cannot happen into the zero case rather than rendering it', () => {
    expect(usageLabel(-1)).toBe(NO_USAGE_LABEL);
    expect(usageLabel(Number.NaN)).toBe(NO_USAGE_LABEL);
    expect(usageLabel(Number.POSITIVE_INFINITY)).toBe(NO_USAGE_LABEL);
  });

  it('floors a fractional count, so a bad aggregate still renders a whole sentence', () => {
    expect(usageLabel(1.7)).toBe('Used by 1 brand');
    expect(usageLabel(2.4)).toBe('Used by 2 brands');
    expect(usageLabel(0.5)).toBe(NO_USAGE_LABEL);
  });
});
