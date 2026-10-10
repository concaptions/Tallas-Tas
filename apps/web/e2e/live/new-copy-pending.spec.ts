import { expect } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { copywritingPath } from '../../src/lib/routes';
import { test } from '../support/clerk-login';

/**
 * SMOKE-19: the Copywriting grid shows the new copy row within 500 ms of the press — before the
 * server has answered — and the panel opens on it once the id is real, with no page refresh. Live
 * project only (the demo button is disabled); reports itself skipped without the four variables
 * (D-008).
 */
test.describe('New copy on the live Copywriting page', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables; see docs/runbook.md "Playwright live mode".',
  );

  test('the row appears within 500 ms of the press, then the panel opens on it', async ({
    page,
  }) => {
    await page.goto(copywritingPath);
    await page.locator('[data-slot="new-copy"]').click();
    await expect(page.locator('[data-copy-pending="true"]')).toBeVisible({ timeout: 500 });
    await expect(page.locator('[data-slot="copy-panel"]')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/[?&]copy=/);
    await expect(page.locator('[data-copy-pending="true"]')).toHaveCount(0, { timeout: 30_000 });
  });
});
