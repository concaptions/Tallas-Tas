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

    // EXACTLY the seven fields the Gratsi base defines, in its order and under its names. Product,
    // Updated and the nine template prose columns are deliberately absent.
    await expect(page.locator('[data-slot="personas-table"] thead th')).toHaveText([
      'Name',
      'Description [Age Status Salary]',
      'Personality',
      'Drivers for this persona',
      'Passion',
      'Problem-Solution Awareness Level',
      'Angles',
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

    // The Gratsi base defines what this page shows (docs/decisions/gratsi-display-spec-2026-10-02.md),
    // so the panel is one group of its six fields plus the two-way Angles link.
    await expect(panel.locator('[data-slot="persona-group-heading"]')).toHaveText([
      'Persona',
      'Angles',
    ]);

    // Every label is GRATSI'S field name, not the template's. These are the strings the owner
    // pinned, so a silent drift back to "Demographic" or "Core Desires" fails here.
    for (const label of [
      'Name',
      'Description [Age Status Salary]',
      'Personality',
      'Drivers for this persona',
      'Passion',
      'Problem-Solution Awareness Level',
    ]) {
      await expect(
        panel.locator(`:not(option):text-is(${JSON.stringify(label)})`).first(),
      ).toBeVisible();
    }

    // And the template-only fields are gone from the page. They are NOT dropped — Niagara Sleep
    // Solutions populates all of them — they are simply not what the Gratsi base defines, so a
    // regression that re-renders them is a regression.
    for (const hidden of [
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires',
      'Emotional Triggers',
      'Pain Points',
      'Success Factors',
      'Perceived Barriers',
      'Problem/Challenge',
      'Buying Triggers',
      'Trigger Words',
    ]) {
      await expect(panel.locator(`:not(option):text-is(${JSON.stringify(hidden)})`)).toHaveCount(0);
    }

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
