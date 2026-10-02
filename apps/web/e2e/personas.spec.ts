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

    // AI-45, "Persona needs no links": there is no Product column. A persona reaches a product
    // through the angle that links both, so a column here was a second answer to the same question.
    // `personas.product_id` stays in the database — it holds imported Airtable data.
    const headers = page.locator('[data-slot="personas-table"] thead th');
    await expect(headers.nth(0)).toHaveText('Name');
    await expect(headers.nth(1)).toHaveText('Stage of Awareness');
    await expect(headers.nth(2)).toHaveText('Linked angles');
    await expect(headers.filter({ hasText: /^Product$/ })).toHaveCount(0);

    // AI-18: Kanban is gone from the data tables. Personas offers Grid and Gallery.
    await expect(page.locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]')).toHaveText([
      'Grid',
      'Gallery',
    ]);
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

    // The five field groups in design order, plus the TASK 5 read-only Linked angles section.
    await expect(panel.locator('[data-slot="persona-group-heading"]')).toHaveText([
      'Identity',
      'Desires',
      'Barriers',
      'Buying Behaviour',
      'Language',
      'Linked angles',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?persona=/);
    await page.reload();
    await expect(page.locator('[data-slot="persona-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="persona-row"]')).toHaveCount(3);

    // After a reload the panel is visible before React has hydrated and attached its window
    // listener, so a single Escape can land on nothing. Retry until the handler is live — the same
    // pattern the Angles spec uses; the assertion itself is unchanged.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="persona-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass();
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
