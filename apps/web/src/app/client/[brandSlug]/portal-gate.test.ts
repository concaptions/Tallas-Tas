import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The client portal's token gate and the page that ISSUES the token must not share a layout.
 *
 * `/client/gratsi` with no cookie redirected to `/client/gratsi/auth`; that route rendered under
 * the same `[brandSlug]/layout.tsx`, whose gate found no cookie and redirected to `/auth` again —
 * ERR_TOO_MANY_REDIRECTS (smoke test, 2026-10-10). The gate therefore lives in a route group,
 * `[brandSlug]/(portal)/layout.tsx`, over every portal page, and `auth/page.tsx` sits beside the
 * group, outside it. This test reads the route tree so the shape cannot drift back: a layout
 * placed at `[brandSlug]/` again would wrap `auth` and fail here before it fails in production.
 */
const segment = fileURLToPath(new URL('.', import.meta.url));
const portal = `${segment}(portal)/`;

describe('client portal route tree', () => {
  it('keeps the auth page OUTSIDE the token-gated layout', () => {
    expect(existsSync(`${segment}auth/page.tsx`)).toBe(true);
    expect(existsSync(`${segment}layout.tsx`)).toBe(false);
    expect(existsSync(`${portal}layout.tsx`)).toBe(true);
    expect(readFileSync(`${portal}layout.tsx`, 'utf8')).toContain('getClientToken');
  });

  it('puts every portal page under the gate, and only auth beside it', () => {
    const beside = readdirSync(segment, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(beside).toEqual(['(portal)', 'auth']);
    expect(existsSync(`${portal}page.tsx`)).toBe(true);
    expect(existsSync(`${portal}concepts/page.tsx`)).toBe(true);
  });
});
