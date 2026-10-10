import { expect } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { creativeSheetPath } from '../../src/lib/routes';
import { test } from '../support/clerk-login';

/**
 * SMOKE-16, the live half: the demo twin (`e2e/settled-first-click.spec.ts`) passes, so the swallowed
 * first click on a settled page reproduces only with Clerk mounted. Signed in as the E2E user,
 * the page settles (network idle, hydration stamp, a further pause), then ONE click must work.
 * Reports itself skipped without the four live variables (D-008).
 */
test.describe('settled live page: the first click works (SMOKE-16)', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables; see docs/runbook.md "Playwright live mode".',
  );

  test('one click on "New creative" opens the dialog; one click on the brand switcher opens the menu', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath, { waitUntil: 'networkidle' });
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await page.waitForTimeout(5000);

    await page.locator('[data-slot="new-creative"]').click();
    await expect(page.locator('[data-slot="new-creative-dialog"]')).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');

    await page.locator('[data-slot="brand-switcher"]').click();
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 2000 });
  });
});
