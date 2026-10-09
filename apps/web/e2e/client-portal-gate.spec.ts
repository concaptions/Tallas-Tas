import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';

/**
 * The client portal's auth page is reachable on its own, outside the token gate. The gate lives
 * in `[brandSlug]/(portal)/layout.tsx`; `auth/page.tsx` sits beside the group, so a redirect to
 * it cannot run the gate again (ERR_TOO_MANY_REDIRECTS on `/client/gratsi`, smoke test
 * 2026-10-10). Demo mode skips the gate itself, so this half pins only the route: the page
 * renders with its own heading and no redirect. The live half, `live/client-portal-gate.spec.ts`,
 * exercises the redirect.
 */
test.describe('client portal auth route in demo mode (no Clerk)', () => {
  test.skip(clerkKeys() !== undefined, 'Clerk configured; demo-mode route check does not apply');

  test('renders the auth page without a token as a 200 with its heading', async ({ page }) => {
    const response = await page.goto('/client/niagara-sleep-solutions/auth');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/client/niagara-sleep-solutions/auth');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invalid Link');
  });
});
