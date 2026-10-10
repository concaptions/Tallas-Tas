import { expect } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { creativeSheetPath } from '../../src/lib/routes';
import { test } from '../support/clerk-login';

/**
 * SMOKE-17: the sheet names the new creative within 500 ms of SUBMIT — before the server has
 * answered — and opens it once the refreshed rows carry it. Live project only (the demo submit is
 * disabled); reports itself skipped without the four variables (D-008).
 */
test.describe('New creative on the live sheet', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables; see docs/runbook.md "Playwright live mode".',
  );

  test('the pending line appears within 500 ms of submit, then the panel opens on the real row', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await page.locator('[data-slot="new-creative"]').click();
    await page.locator('[data-slot="new-creative-submit"]').click();
    await expect(page.locator('[data-slot="creative-sheet-pending"]')).toBeVisible({
      timeout: 500,
    });
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-slot="creative-sheet-pending"]')).toHaveCount(0);
  });
});
