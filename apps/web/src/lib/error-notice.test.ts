import { describe, expect, it } from 'vitest';

import { ERROR_BODY, ERROR_TITLE, digestLabel } from './error-notice';

describe('digestLabel', () => {
  it('returns the digest verbatim, because it has to match the log line', () => {
    expect(digestLabel('3619938306')).toBe('3619938306');
  });

  it('trims surrounding whitespace without touching the value', () => {
    expect(digestLabel('  3619938306\n')).toBe('3619938306');
  });

  it('is null when there is nothing to show, so no empty Reference line renders', () => {
    expect(digestLabel(undefined)).toBeNull();
    expect(digestLabel('')).toBeNull();
    expect(digestLabel('   ')).toBeNull();
  });
});

describe('the boundary copy', () => {
  /**
   * Non-negotiable 10: a brand client reaches this boundary on the same deployment as the team, so
   * the screen may not name the infrastructure. The digest is the handle; the cause lives in the
   * logs. This is the assertion that fails if someone later pastes a remedy into the copy.
   */
  it('names no environment variable, host or table', () => {
    const copy = `${ERROR_TITLE} ${ERROR_BODY}`;

    expect(copy).not.toMatch(/DATABASE_URL|CLERK|PG[A-Z]+|postgres|railway|_KEY/i);
  });

  it('says that nothing was written, which is what the reader needs to know first', () => {
    expect(ERROR_BODY).toContain('Nothing was saved');
  });
});
