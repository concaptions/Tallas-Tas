import { expect, test } from '@playwright/test';

test('home page renders the platform heading through the shadcn Button', async ({ page }) => {
  await page.goto('/');

  const heading = page.getByRole('heading', { level: 1, name: 'TAS Creative Platform' });
  await expect(heading).toBeVisible();

  // Tailwind and shadcn styles apply: the Button variant paints the primary background instead of
  // the browser default (transparent).
  await expect(heading).toHaveAttribute('data-slot', 'button');
  await expect(heading).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
