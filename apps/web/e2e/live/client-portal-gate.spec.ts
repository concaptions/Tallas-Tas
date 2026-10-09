import { expect, test } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';

/**
 * The token gate, live: `/client/gratsi` with no client cookie redirects ONCE to the brand's auth
 * page, which answers 200 with its heading. Before 2026-10-10 the auth page rendered under the
 * gate's own layout, so the redirect looped (ERR_TOO_MANY_REDIRECTS). Runs in the `live` project
 * against the seeded E2E database, which carries the Gratsi brand; without the four variables it
 * reports itself skipped (D-008). No sign-in: the portal is public to Clerk and gated by its own
 * token.
 */
test.describe('client portal token gate (live project)', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables (CLERK_PUBLISHABLE_KEY_TEST, CLERK_SECRET_KEY_TEST, CLERK_E2E_USER_PASSWORD, DATABASE_URL_E2E): the token gate only runs with a database. See docs/runbook.md, "Playwright live mode".',
  );

  test('/client/gratsi without a token lands on /client/gratsi/auth as a 200 with an h1', async ({
    page,
  }) => {
    const response = await page.goto('/client/gratsi');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/client/gratsi/auth');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
