import { expect, test, type Page } from '@playwright/test';

import { conceptsPath, creativeSheetPath, interfaceConfigPath } from '../src/lib/routes';

/**
 * SMOKE-22: the FIRST click on a control works when it is made at FIRST PAINT — the page has
 * committed and the control is visible, nothing else is awaited (no `networkidle`, no hydration
 * stamp). Five controls the re-test saw eat their first click on a settled page: "New creative"
 * (Dialog), the brand switcher (DropdownMenu), the Interface Config visibility switch (Switch),
 * the Concepts Group menu (DropdownMenu) and a concept detail select (Select). Each test clicks
 * exactly ONCE and expects the control's result within 600 ms of the click. The detail select is
 * in the live twin only (`e2e/live/first-paint-click.spec.ts`): demo mode locks every write
 * control, the select included, so it cannot be clicked here by design.
 *
 * The routes are warmed once so `next dev`'s first-request compile is not measured as the bug.
 */
const ROUTES = [creativeSheetPath, interfaceConfigPath, conceptsPath];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  for (const route of ROUTES) await page.goto(route, { waitUntil: 'networkidle' });
  await page.close();
});

/** Commit + the control visible: first paint, nothing more. Returns the click's timestamp. */
async function firstPaintClick(page: Page, path: string, selector: string): Promise<number> {
  await page.goto(path, { waitUntil: 'commit' });
  const control = page.locator(selector).first();
  await control.waitFor({ state: 'visible' });
  const hydrated = await page.evaluate(() =>
    document.documentElement.hasAttribute('data-hydrated'),
  );
  const at = Date.now();
  await control.click({ noWaitAfter: true });
  console.log(`[first-paint] ${selector} clicked; shell hydrated at click: ${String(hydrated)}`);
  return at;
}

async function expectWithin(
  page: Page,
  at: number,
  selector: string,
  label: string,
): Promise<void> {
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 600 });
  console.log(`[first-paint] ${label} opened ${String(Date.now() - at)} ms after the click`);
}

test('New creative: one first-paint click opens the dialog', async ({ page }) => {
  const at = await firstPaintClick(page, creativeSheetPath, '[data-slot="new-creative"]');
  await expectWithin(page, at, '[data-slot="new-creative-dialog"]', 'dialog');
  await expect(page.locator('[data-slot="new-creative-dialog"]')).toHaveCount(1);
});

test('Brand switcher: one first-paint click opens the menu', async ({ page }) => {
  const at = await firstPaintClick(page, creativeSheetPath, '[data-slot="brand-switcher"]');
  await expectWithin(page, at, '[role="menu"]', 'brand menu');
});

test('Interface Config switch: one first-paint click flips it', async ({ page }) => {
  await page.goto(interfaceConfigPath, { waitUntil: 'commit' });
  const toggle = page.locator('[data-slot="config-toggle"]').first();
  await toggle.waitFor({ state: 'visible' });
  const before = await toggle.getAttribute('aria-checked');
  const at = Date.now();
  await toggle.click({ noWaitAfter: true });
  await expect(toggle).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true', {
    timeout: 600,
  });
  console.log(`[first-paint] switch flipped ${String(Date.now() - at)} ms after the click`);
});

test('Concepts Group menu: one first-paint click opens it', async ({ page }) => {
  const at = await firstPaintClick(page, conceptsPath, '[data-slot="grid-group"]');
  await expectWithin(page, at, '[role="menu"]', 'group menu');
});
