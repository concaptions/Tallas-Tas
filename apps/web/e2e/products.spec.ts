import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { productsPath } from '../src/lib/routes';

/**
 * The Products route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: three rows, four columns, a side panel that is not a modal, the open
 * product in the URL, and every write control disabled while the template download still works.
 */
test.describe('products in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/products needs a session and real data',
  );

  test('lists the three fixture products in four columns', async ({ page }) => {
    await page.goto(productsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Products');
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="product-count"]')).toContainText('3 products');

    await expect(page.locator('[data-slot="products-table"] thead th')).toHaveText([
      'Product name',
      'Landing page URL',
      'Collection link',
      'Updated',
    ]);

    // The landing page shows its host, with the full URL in the cell's title.
    const first = page.locator('[data-slot="product-row"]').first();
    await expect(first.locator('td').nth(1)).toHaveText('niagarasleep.example');
    await expect(first.locator('td').nth(1)).toHaveAttribute('title', /^https:\/\/niagarasleep/);

    // The sleep mask has no collection link, so its cell is the em dash, never an empty cell.
    const mask = page.locator('[data-product-id="22222222-2222-4222-8222-000000000002"]');
    await expect(mask.locator('td').nth(2)).toHaveText('—');
  });

  test('a row opens the panel, the URL carries it, a reload reopens it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(productsPath);

    const firstRow = page.locator('[data-slot="product-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="product-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="product-panel-title"]')).toHaveText(name);

    // Every PRD §5.1 field is in the panel, editable in place.
    await expect(panel.locator('#product-field-name')).toBeVisible();
    await expect(panel.locator('#product-field-link')).toBeVisible();
    await expect(panel.locator('#product-field-collectionLink')).toBeVisible();

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?product=/);
    await page.reload();
    await expect(page.locator('[data-slot="product-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(3);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="product-panel"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\?product=/);
  });

  test('the panel is read-only, refuses to save, and shows the linked concepts count', async ({
    page,
  }) => {
    await page.goto(`${productsPath}?product=22222222-2222-4222-8222-000000000001`);

    const panel = page.locator('[data-slot="product-panel"]');
    await expect(panel.locator('[data-slot="product-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="product-save"]')).toBeDisabled();
    await expect(panel.locator('#product-field-name')).toHaveAttribute('readonly', '');

    // The blanket carries two concepts; the chip is the shared StatusChip in the info tone, and it
    // pluralises.
    const count = panel.locator('[data-slot="product-concept-count"] [data-slot="status-chip"]');
    await expect(count).toHaveText('2 concepts');
    await expect(count).toHaveAttribute('data-tone', 'info');

    // A product with no linked concept — the reset bundle, which nothing has been built on yet —
    // renders a zero, never a blank or a dash.
    await page.goto(`${productsPath}?product=22222222-2222-4222-8222-000000000003`);
    const zero = page.locator('[data-slot="product-concept-count"] [data-slot="status-chip"]');
    await expect(zero).toHaveText('0 concepts');
    await expect(zero).toHaveAttribute('data-tone', 'mute');
  });

  test('search filters the table and the empty state offers to clear it', async ({ page }) => {
    await page.goto(productsPath);

    // "mask" appears in the sleep mask AND in the bundle that pairs it with the blanket, so the
    // filter is a substring match over every row, not a name lookup.
    await page.locator('[data-slot="product-search"]').fill('mask');
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="product-count"]')).toContainText('2 of 3 products');

    // "cooling" appears in one product only, and only in its name and its landing page URL.
    await page.locator('[data-slot="product-search"]').fill('cooling');
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="product-count"]')).toContainText('1 of 3 products');
    await expect(page.locator('[data-slot="product-row"]')).toHaveAttribute(
      'data-product-id',
      '22222222-2222-4222-8222-000000000002',
    );

    await page.locator('[data-slot="product-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="products-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(3);
  });

  test('Upload CSV is disabled with a reason and Download template still works', async ({
    page,
  }) => {
    await page.goto(productsPath);

    const upload = page.locator('[data-slot="upload-csv"]');
    await expect(upload).toBeDisabled();
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // The template is not a write: it is built in the browser and downloads in demo mode.
    const template = page.locator('[data-slot="download-template"]');
    await expect(template).toBeEnabled();

    const [download] = await Promise.all([page.waitForEvent('download'), template.click()]);
    expect(download.suggestedFilename()).toBe('products-template.csv');
    const file = await download.path();
    expect(readFileSync(file, 'utf8')).toBe('name,link,collection_link');
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(productsPath);

    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(3);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
