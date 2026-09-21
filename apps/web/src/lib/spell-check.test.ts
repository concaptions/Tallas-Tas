import { describe, expect, it } from 'vitest';

import { demoSpellCheck } from './spell-check';

describe('demoSpellCheck', () => {
  it('returns feedback for text with inconsistent hyphenation', () => {
    const result = demoSpellCheck('The on-call room is warm. He walked into the oncall room.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedback).toContain('hyphenation');
    }
  });

  it('returns "No issues found." for clean text', () => {
    const result = demoSpellCheck('This is a perfectly clean sentence.');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.feedback).toBe('No issues found.');
    }
  });

  it('handles empty text gracefully', () => {
    const result = demoSpellCheck('');
    expect(result.ok).toBe(true);
  });
});
