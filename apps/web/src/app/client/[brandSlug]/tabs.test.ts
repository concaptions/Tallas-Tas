import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLIENT_TAB_KEYS } from '@tas/domain';
import { describe, expect, it } from 'vitest';

import {
  AUX_NAV_ITEMS,
  auxTabHref,
  CUSTOM_PAGE_SEGMENT,
  clientBasePath,
  customPageHref,
  standardTabHref,
  TAB_HREF_SEGMENT,
} from './tabs';

/**
 * Every link the client portal's nav renders must land on a real route. The Copywriting tab 404'd
 * from 2026-10-06 to 2026-10-09: its key, label and data loader shipped with the interface config,
 * but no `copywriting/page.tsx` ever did, and nothing checked. This test reads the route tree the
 * App Router reads — a `page.tsx` under this directory for the segment — so a tab can no longer be
 * added without its page.
 */
const ROUTE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Every portal page sits under the `(portal)` route group — the token gate's layout — which the
 * App Router leaves out of the URL, so `/client/gratsi/concepts` is `(portal)/concepts/page.tsx`.
 * Only `auth` lives beside the group (`portal-gate.test.ts`).
 */
function hasPage(...segments: readonly string[]): boolean {
  return existsSync(join(ROUTE_DIR, '(portal)', ...segments, 'page.tsx'));
}

describe('client portal tab links resolve to routes', () => {
  it.each(CLIENT_TAB_KEYS)('the standard tab %s has a page behind its segment', (key) => {
    const segment = TAB_HREF_SEGMENT[key];
    expect(segment).toMatch(/^[a-z-]+$/);
    expect(hasPage(segment), `missing ${segment}/page.tsx for tab ${key}`).toBe(true);
  });

  it.each(AUX_NAV_ITEMS.map((item) => item.segment))('the fixed tab %s has a page', (segment) => {
    expect(hasPage(segment), `missing ${segment}/page.tsx`).toBe(true);
  });

  it('custom pages share one dynamic route', () => {
    expect(hasPage(CUSTOM_PAGE_SEGMENT, '[pageSlug]')).toBe(true);
  });

  it('builds every href under the brand base path, with the slug and page slug URL-encoded', () => {
    expect(clientBasePath('a b')).toBe('/client/a%20b');
    for (const key of CLIENT_TAB_KEYS) {
      expect(standardTabHref('gratsi', key)).toBe(`/client/gratsi/${TAB_HREF_SEGMENT[key]}`);
    }
    for (const item of AUX_NAV_ITEMS) {
      expect(auxTabHref('gratsi', item.segment)).toBe(`/client/gratsi/${item.segment}`);
    }
    expect(customPageHref('gratsi', 'top ads')).toBe('/client/gratsi/custom/top%20ads');
  });
});
