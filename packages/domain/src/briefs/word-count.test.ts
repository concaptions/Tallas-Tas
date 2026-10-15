import { describe, expect, it } from 'vitest';

import { countWords } from './word-count';

describe('countWords', () => {
  it('returns 0 for an empty or whitespace-only string', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
    expect(countWords('\n\t  \n')).toBe(0);
  });

  it('counts a single word as 1', () => {
    expect(countWords('Hook')).toBe(1);
    expect(countWords('   Hook   ')).toBe(1);
  });

  it('splits on any run of whitespace', () => {
    expect(countWords('Open with a wide shot')).toBe(5);
    expect(countWords('one   two\tthree\n\nfour')).toBe(4);
  });

  it('does not pluralise or special-case counts (the caller renders "N words" verbatim)', () => {
    // The sidebar prints `${countWords(text)} words`; "1 words" is accepted per the ask.
    expect(countWords('one')).toBe(1);
    expect(countWords('one two')).toBe(2);
  });
});
