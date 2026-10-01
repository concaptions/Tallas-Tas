import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { collectionsPath, emailCampaignsPath, youtubeCopywritingPath } from '../src/lib/routes';

/**
 * The Collections route with no environment variables at all — the Vercel deployment as it stands.
 * The data source serves the in-repo fixtures and the panel shows, read-only, the records that link
 * TO a collection: the email campaigns (`email_campaign_collections`) and the YouTube copy
 * (`youtube_copy_collections`) whose fixtures carry the collection's id.
 */
const BFCM_COLLECTION_ID = '11223344-1122-4334-8556-000000000001';
const SUMMER_COLLECTION_ID = '11223344-1122-4334-8556-000000000002';

test.describe('collections in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/collections needs a session and real data',
  );

  test('lists the two fixture collections', async ({ page }) => {
    await page.goto(collectionsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Collections');
    await expect(page.locator('[data-slot="collection-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="collection-count"]')).toContainText('2 collections');
  });

  test('the BFCM panel lists the email campaign and the two YouTube copies that link to it', async ({
    page,
  }) => {
    await page.goto(`${collectionsPath}?collection=${BFCM_COLLECTION_ID}`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="collection-linked-work"]')).toBeVisible();

    // One email campaign promotes the BFCM collection; its label opens its own panel and its
    // workflow status is the shared StatusChip.
    const emails = panel.locator('[data-slot="collection-email-campaigns-item"]');
    await expect(emails).toHaveCount(1);
    await expect(emails.first()).toContainText('BFCM Early Access — VIP list');
    await expect(emails.first().locator('a')).toHaveAttribute(
      'href',
      new RegExp(`^${emailCampaignsPath}\\?emailCampaign=`),
    );
    await expect(emails.first().locator('[data-slot="status-chip"]')).toHaveCount(1);

    // Two YouTube copies link to it; the auto-generated titles render in font-mono and link to
    // the YouTube Copywriting panel.
    const copies = panel.locator('[data-slot="collection-youtube-copy-item"]');
    await expect(copies).toHaveCount(2);
    await expect(copies.locator('a')).toHaveText(['Copy 1', 'Copy 3']);
    await expect(copies.first().locator('a')).toHaveClass(/font-mono/);
    await expect(copies.first().locator('a')).toHaveAttribute(
      'href',
      new RegExp(`^${youtubeCopywritingPath}\\?youtube-copy=`),
    );
    await expect(copies.first().locator('[data-slot="status-chip"]')).toHaveCount(1);
  });

  test('the summer panel lists its one campaign and one copy', async ({ page }) => {
    await page.goto(`${collectionsPath}?collection=${SUMMER_COLLECTION_ID}`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel.locator('[data-slot="collection-email-campaigns-item"]')).toHaveText([
      /Summer cooling push/,
    ]);
    await expect(panel.locator('[data-slot="collection-youtube-copy-item"] a')).toHaveText([
      'Copy 2',
    ]);
  });

  test('a new collection has no linked-work section to show', async ({ page }) => {
    await page.goto(`${collectionsPath}?collection=new`);

    const panel = page.locator('[data-slot="collection-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="collection-linked-work"]')).toHaveCount(0);
  });
});
