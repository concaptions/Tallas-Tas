import { describe, expect, it } from 'vitest';

import { defaultInventoryPath, parseEnumerateArgs, REPO_ROOT } from './airtable-enumerate-creators';

describe('airtable-enumerate-creators', () => {
  it('writes the inventory under the repo root, dated by the UTC day', () => {
    expect(defaultInventoryPath(new Date('2026-10-08T23:30:00.000Z'), '/repo')).toBe(
      '/repo/.audit-oct8/airtable-creators-inventory-2026-10-08.json',
    );
    expect(REPO_ROOT).toMatch(/\/$/);
    expect(REPO_ROOT).not.toMatch(/packages/);
  });

  it('reads --limit and --out, leaving both undefined when absent', () => {
    expect(parseEnumerateArgs([])).toEqual({ limit: undefined, out: undefined });
    expect(parseEnumerateArgs(['--out', 'x.json', '--limit', '5'])).toEqual({
      limit: 5,
      out: 'x.json',
    });
    expect(() => parseEnumerateArgs(['--limit', 'zero'])).toThrow(
      '--limit must be a positive integer',
    );
    expect(() => parseEnumerateArgs(['--limit', '0'])).toThrow(
      '--limit must be a positive integer',
    );
  });
});
