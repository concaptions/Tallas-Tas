import { expect, test } from '@playwright/test';

import { appPath } from '../src/lib/routes';

/**
 * The demo-mode half of auth (TICKET-004): with no identity provider there is no session to
 * protect, so the visitor gets the real shell on fixtures and the data layer, not a redirect, is
 * what keeps that safe. The Clerk half — `/app` signed out lands on `/sign-in`, and sign-up with
 * organisation creation — is `e2e/live/auth-signup.spec.ts`, which runs in the `live` Playwright
 * project against a Clerk dev instance and skips itself without one (D-008).
 */
test('visiting /app signed out shows the demo shell', async ({ page }) => {
  await page.goto(appPath);

  await expect(page).toHaveURL(new RegExp(`${appPath}$`));
  await expect(page.locator('[data-slot="demo-banner"]')).toBeVisible();
});
