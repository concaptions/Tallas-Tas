import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath } from '../src/lib/routes';

test('/ redirects into the workspace shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(new RegExp(`${appPath}$`));
});

test.describe('demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the app protects /app instead of running on fixtures',
  );

  test('an unauthenticated visitor sees the real shell on fixtures', async ({ page }) => {
    await page.goto(appPath);

    // The shell, not a redirect to /sign-in.
    await expect(page).toHaveURL(new RegExp(`${appPath}$`));
    await expect(page.locator('[data-slot="shell-top-bar"]')).toBeVisible();
    await expect(page.locator('[data-slot="demo-banner"]')).toContainText('changes are not saved');

    // The demo brand, and the fixture counts the Overview reads from the data source.
    await expect(page.locator('[data-slot="brand-switcher"]')).toContainText(
      'Niagara Sleep Solutions',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Niagara Sleep Solutions');
    await expect(page.getByRole('link', { name: /Personas/ }).first()).toBeVisible();

    // The signature widget renders with a locked client track.
    await expect(page.locator('[data-slot="two-track-approval"]')).toBeVisible();
    await expect(page.locator('[data-slot="client-track"]')).toHaveAttribute('data-open', 'false');

    // Tailwind and the token layer apply: the body is painted, never the browser default.
    await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('the design system page is reachable without a session', async ({ page }) => {
    await page.goto('/design-system');

    await expect(page).toHaveURL(/\/design-system$/);
  });

  test('the theme toggle flips data-theme and remembers it', async ({ page }) => {
    await page.goto(appPath);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('the shell fits a 390px viewport with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(appPath);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
