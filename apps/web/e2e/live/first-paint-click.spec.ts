import { expect, type Page } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { conceptsPath, creativeSheetPath, interfaceConfigPath } from '../../src/lib/routes';
import { test } from '../support/clerk-login';

/**
 * SMOKE-22, live twin: the five controls the re-test saw eat their first click, each clicked ONCE
 * at first paint on the production-shaped app (Clerk, 400-row sheet), expected to answer within
 * 600 ms of the click. The concept detail select is only here: demo mode locks it. Reports itself
 * skipped without the live variables (D-008).
 */
test.describe('first-paint click on the live app', () => {
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables; see docs/runbook.md "Playwright live mode".',
  );

  async function firstPaintClick(page: Page, path: string, selector: string): Promise<number> {
    await page.goto(path, { waitUntil: 'commit' });
    const control = page.locator(selector).first();
    await control.waitFor({ state: 'visible' });
    const at = Date.now();
    await control.click({ noWaitAfter: true });
    return at;
  }

  async function expectWithin(page: Page, at: number, selector: string): Promise<void> {
    await expect(page.locator(selector).first()).toBeVisible({ timeout: 600 });
    console.log(`[first-paint/live] ${selector} ${String(Date.now() - at)} ms after the click`);
  }

  test('New creative opens the dialog', async ({ page }) => {
    const at = await firstPaintClick(page, creativeSheetPath, '[data-slot="new-creative"]');
    await expectWithin(page, at, '[data-slot="new-creative-dialog"]');
  });

  test('the brand switcher opens its menu', async ({ page }) => {
    const at = await firstPaintClick(page, creativeSheetPath, '[data-slot="brand-switcher"]');
    await expectWithin(page, at, '[role="menu"]');
  });

  test('an Interface Config toggle flips', async ({ page }) => {
    await page.goto(interfaceConfigPath, { waitUntil: 'commit' });
    const toggle = page.locator('[data-slot="config-toggle"]').first();
    await toggle.waitFor({ state: 'visible' });
    const before = await toggle.getAttribute('aria-checked');
    await toggle.click({ noWaitAfter: true });
    await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true', {
      timeout: 600,
    });
  });

  test('the Concepts Group menu opens', async ({ page }) => {
    const at = await firstPaintClick(page, conceptsPath, '[data-slot="grid-group"]');
    await expectWithin(page, at, '[role="menu"]');
  });

  test('a concept detail select opens its listbox', async ({ page }) => {
    await page.goto(conceptsPath, { waitUntil: 'networkidle' });
    const first = page.locator('[data-slot="concept-row"] a').first();
    await first.waitFor({ state: 'visible' });
    const href = await first.getAttribute('href');
    if (href === null) throw new Error('the concepts grid has no row link');
    const at = await firstPaintClick(
      page,
      href,
      '[data-slot="concept-field-category"] [role="combobox"]',
    );
    await expectWithin(page, at, '[role="listbox"]');
  });
});
