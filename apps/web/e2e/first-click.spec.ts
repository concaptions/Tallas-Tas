import { expect, test } from '@playwright/test';

import { creativeSheetPath } from '../src/lib/routes';

/**
 * SMOKE-13: a press that lands BEFORE React has hydrated is not lost any more. The boot script in
 * the root layout records it and the shell's first client effect replays it, so "New creative"
 * opens even when the user is faster than the bundle. The repro that found the loss clicked at
 * +329 ms on a hard load and saw the button take focus and nothing open.
 *
 * The press is made pre-hydration BY CONSTRUCTION: every script chunk is held until the press has
 * been dispatched, and the test records whether the root was stamped `data-hydrated` at that
 * moment. The dialog's wait is generous because `next dev` compiles the route on first request.
 */
test('a "New creative" press before hydration opens the dialog once hydrated', async ({ page }) => {
  let released = false;
  const held: (() => void)[] = [];
  await page.route('**/_next/static/chunks/**', async (route) => {
    if (released) {
      await route.continue();
      return;
    }
    await new Promise<void>((resolve) => held.push(resolve));
    await route.continue();
  });

  await page.goto(creativeSheetPath, { waitUntil: 'commit' });
  const button = page.locator('[data-slot="new-creative"]');
  await button.waitFor({ state: 'visible' });
  const hydratedAtPress = await page.evaluate(() =>
    document.documentElement.hasAttribute('data-hydrated'),
  );
  await button.click({ noWaitAfter: true, force: true });
  expect(hydratedAtPress).toBe(false);

  released = true;
  for (const resolve of held) resolve();

  await expect(page.locator('[data-slot="new-creative-dialog"]')).toBeVisible({ timeout: 60_000 });
  // Exactly one dialog: a replay never doubles a press React did handle.
  await expect(page.locator('[data-slot="new-creative-dialog"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
});
