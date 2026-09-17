import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { copywritingPath, propagationPath } from '../src/lib/routes';

/**
 * The Copywriting route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: four rows in four columns, a side panel that is not a modal, the open
 * row in the URL, and every write control disabled with the reason on hover.
 */
test.describe('copywriting in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/copywriting needs a session and real data',
  );

  test('lists the four fixture rows in the four ticket columns', async ({ page }) => {
    await page.goto(copywritingPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Copywriting');
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="copy-count"]')).toContainText('4 copy rows');

    await expect(page.locator('[data-slot="copy-table"] thead th')).toHaveText([
      'Copy title / Headline',
      'Linked Creative',
      'Status',
      'Updated',
    ]);

    // The first cell stacks the generated title and the headline, which is what its header names.
    await expect(page.locator('[data-slot="copy-row-headline"]')).toHaveCount(4);

    // The title is the auto-generated Copy #, in font-mono, never an input.
    const titles = page.locator('[data-slot="copy-row-title"]');
    await expect(titles).toHaveCount(4);
    for (const title of await titles.all()) {
      await expect(title).toHaveText(/^Copy #\d+$/);
    }

    // Every status is the shared chip, never a bare string.
    await expect(page.locator('[data-slot="copy-table"] [data-slot="status-chip"]')).toHaveCount(4);

    // Three rows link to a creative; the unattached one shows the muted em dash (criterion 4).
    await expect(page.locator('[data-slot="copy-row-creative"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="copy-row-unlinked"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-row-unlinked"]')).toHaveText('—');
  });

  test('the sidebar links Copywriting and marks it active, with no Soon chip on it', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    const link = page.getByRole('link', { name: 'Copywriting' });
    await expect(link).toHaveAttribute('href', copywritingPath);
    await expect(link).toHaveAttribute('aria-current', 'page');

    // A SoonChip somewhere else in the rail used to be the control here, proving the assertions
    // below were about Copywriting and not about a selector that had stopped matching. Propagation
    // shipped in ticket `propagation` and was the last section without a page, so no chip is
    // rendered anywhere any more and the control has to be made the other way round: the rail still
    // renders the section that shipped last, as a real link, and carries no muted placeholder at
    // all. Without that positive half the zero-counts below would also pass on a sidebar that
    // failed to render. `pendingSections()` in `nav.test.ts` fails if a section loses its href.
    await expect(page.getByRole('link', { name: 'Propagation' })).toHaveAttribute(
      'href',
      propagationPath,
    );
    await expect(page.locator('[data-slot="shell-sidebar"] [aria-disabled="true"]')).toHaveCount(0);

    // It has a page now, so nothing in the sidebar says Copywriting is still coming.
    await expect(
      page.locator('[data-slot="soon-chip"]').locator('..').filter({ hasText: 'Copywriting' }),
    ).toHaveCount(0);
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);
  });

  test('a row opens the panel with its four copy fields, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    const firstRow = page.locator('[data-slot="copy-row"]').first();
    const title = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(title).not.toBe('');

    // The title cell, not the row's centre: the Linked Creative cell sits there and carries its
    // own link to the brief, which is the one place in the row that deliberately does not open
    // the panel (see the cell's own test below).
    await firstRow.locator('[data-slot="copy-row-title"]').click();

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="copy-panel-title"]')).toHaveText(title);

    // Exactly the four PRD §5.11 copy fields, in order, each with its guidance.
    await expect(panel.locator('#copy-field-primaryCopy')).toBeVisible();
    await expect(panel.locator('#copy-field-headline')).toBeVisible();
    await expect(panel.locator('#copy-field-linkDescription')).toBeVisible();
    await expect(panel.locator('#copy-field-cta')).toBeVisible();
    await expect(panel.locator('[data-slot="copy-counter"]')).toHaveCount(3);
    await expect(panel).toContainText('~125 characters');
    await expect(panel).toContainText('~40 characters');
    await expect(panel).toContainText('~27 characters');

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?copy=/);
    await page.reload();
    await expect(page.locator('[data-slot="copy-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="copy-panel"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\?copy=/);
  });

  test('the Linked Creative chip goes to the brief instead of opening the panel', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    const chip = page.locator('[data-slot="copy-row-creative"]').first();
    const name = ((await chip.textContent()) ?? '').trim();
    expect(name).not.toBe('');

    await chip.click();

    // The cell stops the row's own click, so this is a navigation and not a panel.
    await expect(page).toHaveURL(/\/app\/briefs\//);
    await expect(page.locator('[data-slot="copy-panel"]')).toHaveCount(0);
  });

  test('Linked Creative is a select of brief names, never a text input', async ({ page }) => {
    await page.goto(copywritingPath);
    await page
      .locator('[data-slot="copy-row"]')
      .first()
      .locator('[data-slot="copy-row-title"]')
      .click();

    const panel = page.locator('[data-slot="copy-panel"]');
    const select = panel.locator('[data-slot="copy-creative-select"]');

    await expect(select).toHaveRole('combobox');
    // The value it carries is the brief's generated name, which is what the row's chip shows.
    const linked = (
      (await page
        .locator('[data-slot="copy-row"]')
        .first()
        .locator('[data-slot="copy-row-creative"]')
        .textContent()) ?? ''
    ).trim();
    await expect(select).toContainText(linked);

    // The submitted value is a hidden id, not something anyone types.
    await expect(panel.locator('input[name="creativeBriefId"]')).toHaveAttribute('type', 'hidden');
    await expect(panel.locator('input[type="text"][name="creativeBriefId"]')).toHaveCount(0);
  });

  test('the panel is read-only and the save is disabled with the reason on hover', async ({
    page,
  }) => {
    await page.goto(copywritingPath);
    await page
      .locator('[data-slot="copy-row"]')
      .first()
      .locator('[data-slot="copy-row-title"]')
      .click();

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel.locator('[data-slot="copy-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="copy-save"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-save"]').locator('..')).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );
    await expect(panel.locator('#copy-field-headline')).toHaveAttribute('readonly', '');
    await expect(panel.locator('[data-slot="copy-creative-select"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-status-select"]')).toBeDisabled();

    // The New copy button is a write too, so it is disabled everywhere it appears.
    await expect(page.locator('[data-slot="new-copy"]')).toBeDisabled();
  });

  test('the search narrows the list and says so when nothing matches', async ({ page }) => {
    await page.goto(copywritingPath);

    const search = page.locator('[data-slot="copy-search"]');
    await search.fill('rota');
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-count"]')).toContainText('1 of 4 copy rows');
    await expect(page).toHaveURL(/\?q=rota/);

    await search.fill('nothing matches this at all');
    await expect(page.locator('[data-slot="copy-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="copy-empty"]')).toContainText('No copy matches');

    await page.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);
  });

  test('fits a 390px viewport with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(copywritingPath);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
