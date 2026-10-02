import { describe, expect, it } from 'vitest';

import type { ChipTone } from '@tas/domain/state';

import { TONE_STRIPE, toneStripe } from './tone-stripe';

/**
 * Every tone the domain can hand a chip. `TONE_STRIPE` is typed `Record<ChipTone, string>`, so a
 * tone ADDED to the domain forces an entry in the map, and the key-set assertion below then forces
 * it into this list too — the one place a reviewer has to look when the vocabulary grows.
 */
const TONES = [
  'ok',
  'warn',
  'bad',
  'info',
  'accent',
  'mute',
] as const satisfies readonly ChipTone[];

describe('TONE_STRIPE', () => {
  it('has one class for every chip tone, so a stripe can never come back undefined', () => {
    for (const tone of TONES) {
      expect(toneStripe(tone), tone).toMatch(/^border-l-[a-z0-9]+$/);
    }
    expect(Object.keys(TONE_STRIPE).sort()).toEqual([...TONES].sort());
  });

  it('is token classes only — never a hex, an rgb() or an arbitrary value', () => {
    for (const tone of TONES) {
      expect(toneStripe(tone), tone).not.toMatch(/#|rgb|\[/);
    }
  });
});
