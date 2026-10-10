import { expect, test, type Locator } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath, designSystemPath } from '../src/lib/routes';

/**
 * The brand gradient, on the screen (salvaged from the ai-cleanup worktree, 2026-10-10, under
 * decision A: the top bar IS the gradient surface, pinned to the dark palette — AI-13).
 *
 * Unit tests prove the utility exists and has a call site; neither can prove `.bg-brand-gradient`
 * resolves to an actual gradient, which is the half that was once broken (the token was declared
 * four times and painted nothing). So this spec reads the computed `background-image` out of the
 * browser: the shell's top bar paints a gradient, and on /design-system the two palette columns
 * paint two DIFFERENT gradients, because the token is redeclared per theme — if a theme block ever
 * lost its declaration a column would keep the other palette's purples and nothing else would notice.
 */
test.describe('the brand gradient in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the app protects /app instead of running on fixtures',
  );

  const backgroundImage = (locator: Locator) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundImage);

  test('the top bar paints the gradient', async ({ page }) => {
    await page.goto(appPath);
    const bar = page.locator('[data-slot="shell-top-bar"]');
    await expect(bar).toBeVisible();
    expect(await backgroundImage(bar)).toContain('linear-gradient');
  });

  test('the two palette columns on /design-system paint two different gradients', async ({
    page,
  }) => {
    await page.goto(designSystemPath);
    const columns = page.locator('[data-slot="brand-gradient-column"]');
    await expect(columns).toHaveCount(2);
    const marks = columns.locator('[data-slot="shell-brand-mark"]');
    await expect(marks).toHaveCount(2);
    const dark = await backgroundImage(marks.nth(0));
    const light = await backgroundImage(marks.nth(1));
    expect(dark).toContain('linear-gradient');
    expect(light).toContain('linear-gradient');
    expect(light).not.toBe(dark);
  });
});
