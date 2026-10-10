import { expect, test } from '@playwright/test';

import { creativeSheetPath } from '../src/lib/routes';

/**
 * SMOKE-16: on a FULLY SETTLED page — hydrated, idle, no skeleton — the first click must work. The
 * re-test reproduced a swallowed first click on the Kanban tab, "New creative", the brand switcher
 * and the Interface Config switch, with the second click on the same spot working. This spec does
 * not hold any script: it lets the page settle (network idle, hydration stamp present, a further
 * pause), then clicks ONCE and expects the result.
 */
async function settle(page: import('@playwright/test').Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(3000);
}

test('settled sheet: one click on "New creative" opens the dialog', async ({ page }) => {
  await settle(page, creativeSheetPath);
  await page.locator('[data-slot="new-creative"]').click();
  await expect(page.locator('[data-slot="new-creative-dialog"]')).toBeVisible({ timeout: 2000 });
});

test('settled sheet: one click on the Kanban tab shows the board', async ({ page }) => {
  await settle(page, creativeSheetPath);
  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page.locator('[data-slot="kanban-board"]')).toBeVisible({ timeout: 2000 });
});

test('settled interface config: one click on a page switch flips it', async ({ page }) => {
  await settle(page, '/app/interface-config');
  const toggle = page.locator('[data-slot="config-toggle"]').first();
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute('aria-checked');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true', {
    timeout: 2000,
  });
});
