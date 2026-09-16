import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { personasPath } from '../src/lib/routes';

/**
 * The Personas route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: three rows, a side panel that is not a modal, and the open persona in
 * the URL.
 */
test.describe('personas in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/personas needs a session and real data',
  );

  test('lists the three fixture personas', async ({ page }) => {
    await page.goto(personasPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Personas');
    await expect(page.locator('[data-slot="persona-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="persona-count"]')).toContainText('3 personas');
    // The stage of awareness renders as the shared status chip, never a bare string.
    await expect(
      page.locator('[data-slot="personas-table"] [data-slot="status-chip"]'),
    ).toHaveCount(3);
  });

  test('a row opens the panel, Escape closes it, and the URL carries the persona', async ({
    page,
  }) => {
    await page.goto(personasPath);

    const firstRow = page.locator('[data-slot="persona-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="persona-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="persona-panel-title"]')).toHaveText(name);

    // All five groups, in the order the design specifies.
    await expect(panel.locator('[data-slot="persona-group-heading"]')).toHaveText([
      'Identity',
      'Desires',
      'Barriers',
      'Buying Behaviour',
      'Language',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?persona=/);
    await page.reload();
    await expect(page.locator('[data-slot="persona-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="persona-row"]')).toHaveCount(3);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="persona-panel"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\?persona=/);
  });

  test('the panel is read-only and refuses to save', async ({ page }) => {
    await page.goto(personasPath);
    await page.locator('[data-slot="persona-row"]').first().click();

    const panel = page.locator('[data-slot="persona-panel"]');
    await expect(panel.locator('[data-slot="persona-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="persona-save"]')).toBeDisabled();
    await expect(panel.locator('#persona-field-name')).toHaveAttribute('readonly', '');
  });

  test('the New persona button opens the panel in create mode', async ({ page }) => {
    await page.goto(personasPath);

    await page.locator('[data-slot="new-persona"]').click();

    await expect(page.locator('[data-slot="persona-panel-title"]')).toHaveText('New persona');
    await expect(page).toHaveURL(/\?persona=new$/);
  });
});
