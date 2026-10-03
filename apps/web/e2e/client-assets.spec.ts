import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { clientAssetsPath } from '../src/lib/routes';
import { closePanelWithEscape } from './support/close-panel';

/**
 * The Client Assets route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures
 * (`demoClientAssetFolders` in `packages/db/src/demo-client-asset-folders.ts`: three folders, newest
 * edit first), and the page is fully usable read-only: a grid with the location link and the
 * linked-designs count, a side panel that is not a modal with a labelled control for every Airtable
 * field, the open folder in the URL, and every write disabled with a reason.
 */
const BRAND_KIT_FOLDER_ID = 'f01de125-f01d-4f01-8f01-000000000001';
const NO_LOCATION_FOLDER_ID = 'f01de125-f01d-4f01-8f01-000000000003';

test.describe('client assets in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/client-assets needs a session and real data',
  );

  test('lists the three fixture folders with their link counts in five columns', async ({
    page,
  }) => {
    await page.goto(clientAssetsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Client Assets');
    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="client-asset-folder-count"]')).toContainText(
      '3 folders',
    );

    await expect(page.locator('[data-slot="client-assets-table"] thead th')).toHaveText([
      'Folder name',
      'Description',
      'Location',
      'Linked designs',
      'Updated',
    ]);

    // The location shows its host as a real link, with the full URL in the cell's title.
    const first = page.locator(`[data-client-asset-folder-id="${BRAND_KIT_FOLDER_ID}"]`);
    const location = first.locator('td').nth(2);
    await expect(location).toHaveAttribute('title', /^https:\/\/drive\.google\.com/);
    const link = location.locator('[data-slot="client-asset-location-link"]');
    await expect(link).toHaveText('drive.google.com');
    await expect(link).toHaveAttribute('href', /^https:\/\/drive\.google\.com/);

    // The count is the shared StatusChip, never bare text, and it pluralises.
    await expect(first.locator('td').nth(3).locator('[data-slot="status-chip"]')).toHaveText(
      '2 designs',
    );

    // A folder with no location yet renders the em dash, never an empty cell, and a zero in the
    // mute tone, never a blank.
    const noLocation = page.locator(`[data-client-asset-folder-id="${NO_LOCATION_FOLDER_ID}"]`);
    await expect(noLocation.locator('td').nth(2)).toHaveText('—');
    const zero = noLocation.locator('td').nth(3).locator('[data-slot="status-chip"]');
    await expect(zero).toHaveText('0 designs');
    await expect(zero).toHaveAttribute('data-tone', 'mute');
  });

  test('a row opens the panel with a labelled control for every Airtable field, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(clientAssetsPath);

    const firstRow = page.locator('[data-slot="client-asset-folder-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="client-asset-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="client-asset-panel-title"]')).toHaveText(name);

    // Name [Folder] (singleLineText): a labelled input.
    await expect(panel.locator('#client-asset-field-name')).toBeVisible();
    await expect(panel.locator('label[for="client-asset-field-name"]')).toContainText(
      'Folder Name',
    );

    // Description (multilineText): a labelled text area.
    const description = panel.locator('#client-asset-field-description');
    await expect(description).toBeVisible();
    expect(await description.evaluate((node) => node.tagName)).toBe('TEXTAREA');
    await expect(panel.locator('label[for="client-asset-field-description"]')).toContainText(
      'Description',
    );

    // Location (url): a labelled url input.
    const location = panel.locator('#client-asset-field-locationUrl');
    await expect(location).toBeVisible();
    await expect(location).toHaveAttribute('type', 'url');
    await expect(panel.locator('label[for="client-asset-field-locationUrl"]')).toContainText(
      'Location',
    );

    // "(Internal) Creative Design" (multipleRecordLinks → briefs): a chip picker labelled by its
    // heading, one toggle per brief of the brand, the folder's two links pressed.
    const designPicker = panel.locator('[data-slot="design-picker"]');
    await expect(designPicker).toBeVisible();
    await expect(designPicker).toHaveAttribute('aria-labelledby', 'client-asset-design-heading');
    await expect(panel.locator('#client-asset-design-heading')).toContainText('Creative Designs');
    await expect(designPicker.locator('[data-slot="design-toggle"]')).toHaveCount(7);
    await expect(
      designPicker.locator('[data-slot="design-toggle"][aria-pressed="true"]'),
    ).toHaveCount(2);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?folder=/);
    await page.reload();
    await expect(page.locator('[data-slot="client-asset-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(3);

    await closePanelWithEscape(page, 'client-asset-panel');
    await expect(page).not.toHaveURL(/\?folder=/);
  });

  test('the panel is read-only in demo mode and refuses to save', async ({ page }) => {
    await page.goto(`${clientAssetsPath}?folder=${BRAND_KIT_FOLDER_ID}`);

    const panel = page.locator('[data-slot="client-asset-panel"]');
    await expect(panel.locator('[data-slot="client-asset-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="client-asset-save"]')).toBeDisabled();
    await expect(panel.locator('#client-asset-field-name')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#client-asset-field-description')).toHaveAttribute('readonly', '');
    await expect(panel.locator('[data-slot="design-toggle"]').first()).toBeDisabled();

    // The count beside the picker is the shared StatusChip in the info tone.
    const designCount = panel.locator(
      '[data-slot="client-asset-design-count"] [data-slot="status-chip"]',
    );
    await expect(designCount).toHaveText('2 designs');
    await expect(designCount).toHaveAttribute('data-tone', 'info');
  });

  test('search filters the grid, lives in ?q=, and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(clientAssetsPath);

    // "dropbox" is in one folder's location only; one row.
    await page.locator('[data-slot="client-asset-folder-search"]').fill('dropbox');
    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="client-asset-folder-count"]')).toContainText(
      '1 of 3 folders',
    );
    await expect(page).toHaveURL(/[?&]q=dropbox/);

    await page.locator('[data-slot="client-asset-folder-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="client-assets-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(3);
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(clientAssetsPath);

    await expect(page.locator('[data-slot="client-asset-folder-row"]')).toHaveCount(3);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
