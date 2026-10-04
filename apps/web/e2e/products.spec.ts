import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { emailCampaignsPath, productsPath, youtubeCopywritingPath } from '../src/lib/routes';

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

  test('lists the three fixture products with every linked record as a column', async ({
    page,
  }) => {
    await page.goto(productsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Products');
    await expect(page.locator('[data-slot="product-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="product-count"]')).toContainText('3 products');

    /*
     * The headers are now the RESOLVER's labels, from `column_definitions`, not strings in
     * products-workspace.tsx — which is what makes a relabel a data edit. Demo mode's brand is
     * `DEMO_BRAND_ID` (Niagara), which owns no rows of its own, so it inherits the template's
     * labels: these are the parent base's own Airtable field names, read live from
     * `appnaSGAgOUbJ0f9m` on 2026-10-03 and seeded in that order.
     *
     * Two differences from the hand-written array this replaced, both deliberate:
     *   - `Updated` is gone from every grid (docs/decisions/gratsi-display-spec-2026-10-02.md).
     *   - `collections`, `campaigns_offers` and `copywriting` are configured for the template but
     *     this page draws none of them, so they are absent here and named in the missing-columns
     *     notice asserted below instead.
     * Gratsi's own labels are a per-brand database fact and are asserted against PGlite in
     * packages/db/src/column-seed.test.ts.
     */
    await expect(page.locator('[data-slot="products-table"] thead th')).toHaveText([
      'Product Name / Landing Page Name',
      'Link',
      'Angles',
      '(Internal) Creative Design',
      'UGC Management',
      'Collection Link',
      'Email Campaigns',
      'YouTube Copy',
      'Concepts',
    ]);
    // The three template columns this page cannot draw are stated, never silently omitted.
    await expect(page.locator('[data-slot="product-missing-columns"]')).toContainText(
      'collections, campaigns_offers, copywriting',
    );
    // The name column is frozen so it stays put while the rest scroll horizontally.
    await expect(page.locator('[data-slot="products-table"] thead th').first()).toHaveCSS(
      'position',
      'sticky',
    );

    // The landing page shows its host, with the full URL in the cell's title.
    const first = page.locator('[data-slot="product-row"]').first();
    await expect(first.locator('td[data-column="link"]')).toHaveText('niagarasleep.example');
    await expect(first.locator('td[data-column="link"]')).toHaveAttribute(
      'title',
      /^https:\/\/niagarasleep/,
    );

    // The sleep mask has no collection link, so its cell is the em dash, never an empty cell.
    const mask = page.locator('[data-product-id="22222222-2222-4222-8222-000000000002"]');
    await expect(mask.locator('td[data-column="collection_link"]')).toHaveText('—');
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

    // After a reload the panel is visible before React has hydrated and attached its window
    // listener, so a single Escape can land on nothing. Retry until the handler is live — the same
    // pattern the Angles spec uses; the assertion itself is unchanged.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="product-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass();
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

  test('the panel lists the email campaigns, YouTube copy and creative designs read-only, offers the creators as a two-way link, and links back to each', async ({
    page,
  }) => {
    await page.goto(`${productsPath}?product=22222222-2222-4222-8222-000000000001`);
    const panel = page.locator('[data-slot="product-panel"]');

    // The blanket is promoted by two of the five fixture email campaigns (the
    // `email_campaign_products` junction, read from the campaign side), newest edit first, each
    // carrying the Email Campaigns module's own status chip and a link that opens it there.
    const campaigns = panel.locator(
      '[data-slot="product-email-campaigns"] [data-slot="product-email-campaign"]',
    );
    await expect(campaigns).toHaveCount(2);
    await expect(campaigns.nth(0).getByRole('link')).toHaveText('BFCM Early Access — VIP list');
    await expect(campaigns.nth(0).getByRole('link')).toHaveAttribute(
      'href',
      `${emailCampaignsPath}?emailCampaign=ee11ee11-ee11-4e11-8e11-000000000001`,
    );
    await expect(campaigns.nth(0).locator('[data-slot="status-chip"]')).toHaveText(
      'Template Design',
    );
    await expect(campaigns.nth(1).getByRole('link')).toHaveText('Valentine couples bundle');
    await expect(campaigns.nth(1).locator('[data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'warn',
    );

    // Two YouTube copy rows are written for it (`youtube_copy_products`): the generated "Copy N"
    // title in font-mono, never typed, beside the row's COPY_STATUS chip.
    const copy = panel.locator(
      '[data-slot="product-youtube-copy"] [data-slot="product-youtube-copy-row"]',
    );
    await expect(copy).toHaveCount(2);
    await expect(copy.nth(0).getByRole('link')).toHaveText('Copy 1');
    await expect(copy.nth(0).getByRole('link')).toHaveClass(/font-mono/);
    await expect(copy.nth(0).locator('[data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'ok',
    );
    await expect(copy.nth(1).getByRole('link')).toHaveText('Copy 4');
    await expect(copy.nth(1).getByRole('link')).toHaveAttribute(
      'href',
      `${youtubeCopywritingPath}?youtube-copy=a1b2c3d4-0012-4012-8012-000000000004`,
    );

    // No fixture brief carries a `product_id`, so that reverse list renders its empty sentence
    // rather than a blank.
    await expect(panel.locator('[data-slot="product-creative-designs"]')).toHaveText(
      'No creative design is briefed on this product yet.',
    );

    /*
     * The creators are the one link under "Linked work" this panel can WRITE: `creator_products` is
     * two-way (AI-42), so the same `LinkField` the creator panel mounts for its products is mounted
     * here for its creators, and the empty sentence names both ends. No fixture creator books a
     * product, so it is empty — with its picker beside it, inert in demo mode like every other
     * write control.
     */
    await expect(panel.locator('[data-slot="product-creators"]')).toHaveAttribute(
      'data-link',
      'product-creators',
    );
    await expect(panel.locator('[data-slot="product-creators-empty"]')).toHaveText(
      'No creator is booked for this product yet. Link one here or from the creator’s panel.',
    );
    await expect(panel.locator('[data-slot="product-creators-add"]')).toBeDisabled();

    // Read-only: none of the three lists their own modules own holds a control. Those links are
    // edited where they are written.
    await expect(
      panel.locator(
        '[data-slot="product-email-campaigns"] :is(input, select, textarea, button), [data-slot="product-youtube-copy"] :is(input, select, textarea, button), [data-slot="product-creative-designs"] :is(input, select, textarea, button)',
      ),
    ).toHaveCount(0);

    // The bundle is named by one of each, and matches on the junction id, not on a name.
    await page.goto(`${productsPath}?product=22222222-2222-4222-8222-000000000003`);
    await expect(page.locator('[data-slot="product-email-campaign"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="product-youtube-copy-row"]')).toHaveCount(1);
    await expect(
      page.locator('[data-slot="product-youtube-copy-row"]').getByRole('link'),
    ).toHaveText('Copy 3');

    // Two-way: following a link lands on the counterpart's page with its panel open on that row.
    await page.locator('[data-slot="product-youtube-copy-row"]').getByRole('link').click();
    await expect(page).toHaveURL(
      /\/app\/youtube-copywriting\?youtube-copy=a1b2c3d4-0012-4012-8012-000000000003/,
    );
    await expect(page.locator('[data-slot="youtube-copy-panel"]')).toBeVisible();
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
