import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { youtubeCopywritingPath } from '../src/lib/routes';

/**
 * The YouTube Copywriting route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures, and
 * the page is fully usable read-only: the fixture rows in the grid, a side panel that is not a
 * modal with a labelled control for every stored Airtable field, the open row in the URL, a kanban
 * by status or funnel, and every write control disabled.
 */

/** Every stored column of Airtable `tblVR1UmkbDoDzJ7z`, by the `data-field` of its panel control. */
const STORED_FIELDS = [
  'copyNumber',
  'angle',
  'headline',
  'descriptions',
  'newsFeed',
  'cta',
  'funnel',
  'status',
  'used',
  'winning',
  'metaRating',
  'clientComment',
] as const;

/** The four record links, each a chip picker. */
const PICKERS = ['collection-picker', 'product-picker', 'campaign-picker', 'copy-type-picker'];

test.describe('youtube copywriting in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/youtube-copywriting needs a session and real data',
  );

  test('lists the fixture rows with the generated Copy # and a status chip per row', async ({
    page,
  }) => {
    await page.goto(youtubeCopywritingPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('YouTube Copywriting');
    const rows = page.locator('[data-slot="youtube-copy-row"]');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('[data-slot="youtube-copy-count"]')).toContainText('4 copy rows');

    await expect(page.locator('[data-slot="youtube-copy-table"] thead th')).toHaveText([
      'Copy #',
      'Headline',
      'Descriptions',
      'Status',
      'CTA',
      'Funnel',
      'Used',
      'Winning',
      'Meta rating',
      'Updated',
    ]);

    // The title is the auto-generated "Copy N", in font-mono, never an input.
    const titles = page.locator('[data-slot="youtube-copy-row-title"]');
    await expect(titles).toHaveCount(4);
    for (const title of await titles.all()) {
      await expect(title).toHaveText(/^Copy \d+$/);
      await expect(title).toHaveClass(/font-mono/);
    }

    // Every status is the shared chip, never a bare string: one per row, plus Used and Winning.
    await expect(
      page.locator('[data-slot="youtube-copy-table"] tbody [data-slot="status-chip"]'),
    ).toHaveCount(12);
  });

  test('a row opens the panel with a labelled control for every stored field, the URL carries it, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(youtubeCopywritingPath);

    const firstRow = page.locator('[data-slot="youtube-copy-row"]').first();
    const title = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(title).toMatch(/^Copy \d+$/);

    await firstRow.click();

    const panel = page.locator('[data-slot="youtube-copy-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="youtube-copy-panel-title"]')).toHaveText(title);

    // Every stored Airtable field has a labelled control, by data-field and by id.
    for (const field of STORED_FIELDS) {
      await expect(
        panel.locator(`[data-slot="youtube-copy-field"][data-field="${field}"]`),
      ).toBeVisible();
      await expect(panel.locator(`#youtube-copy-field-${field}`)).toBeVisible();
    }
    // Descriptions is a textarea that stops at 90 characters, with a live counter.
    const descriptions = panel.locator('#youtube-copy-field-descriptions');
    await expect(descriptions).toHaveAttribute('maxlength', '90');
    await expect(panel.locator('[data-slot="youtube-copy-counter"]')).toHaveText(/^\d+ of 90$/);

    // The four record links are chip pickers; the lookups through them are read-only lines.
    for (const picker of PICKERS) {
      await expect(panel.locator(`[data-slot="${picker}"]`)).toBeVisible();
    }
    await expect(panel.locator('[data-slot="collection-picker-toggle"]')).toHaveCount(2);
    await expect(panel.locator('[data-slot="product-picker-toggle"]')).toHaveCount(3);
    await expect(panel.locator('[data-slot="campaign-picker-toggle"]')).toHaveCount(3);
    await expect(
      panel.locator('[data-slot="youtube-copy-lookup"][data-lookup="offer"]'),
    ).toBeVisible();

    // The section headings, in order.
    await expect(panel.locator('[data-slot="youtube-copy-group-heading"]')).toHaveText([
      'Copy',
      'CTA, funnel & status',
      'Performance',
      "Client's Comment",
      'Linked records',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?youtube-copy=/);
    await page.reload();
    await expect(page.locator('[data-slot="youtube-copy-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="youtube-copy-row"]')).toHaveCount(4);

    // After the reload the client bundle can still be hydrating when a single Escape lands (the

    // tracked panel Escape-close race; products/personas specs keep the strict form as sentinels).

    // Re-press until the close takes.

    await expect(async () => {
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-slot="youtube-copy-panel"]')).toHaveCount(0, {
        timeout: 1_000,
      });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?youtube-copy=/);
  });

  test('the panel is read-only in demo mode and refuses to save', async ({ page }) => {
    await page.goto(`${youtubeCopywritingPath}?youtube-copy=a1b2c3d4-0012-4012-8012-000000000001`);

    const panel = page.locator('[data-slot="youtube-copy-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="youtube-copy-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="youtube-copy-save"]')).toBeDisabled();
    await expect(panel.locator('#youtube-copy-field-headline')).toHaveAttribute('readonly', '');
    await expect(panel.locator('[data-slot="collection-picker-toggle"]').first()).toBeDisabled();

    // The approved body-clock row: its status chip, and its linked campaign's lookups.
    await expect(panel.locator('[data-field="status"] [data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'ok',
    );
    await expect(
      panel.locator('[data-slot="youtube-copy-lookup"][data-lookup="campaign-code"]'),
    ).toContainText('BFCM26');
    await expect(
      panel.locator('[data-slot="youtube-copy-lookup"][data-lookup="offer"]'),
    ).toContainText('20%OFF');
  });

  test('the kanban groups by status, then by funnel, and a card opens the panel', async ({
    page,
  }) => {
    await page.goto(`${youtubeCopywritingPath}?view=kanban`);

    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(page.locator('[data-slot="kanban-card"]')).toHaveCount(4);
    // One column per COPY_STATUS state, empties kept.
    await expect(board).toContainText('Pending For Client Review');
    await expect(board).toContainText('Disapproved');

    await page.locator('[data-slot="youtube-copy-kanban-group"]').getByText('Funnel').click();
    await expect(board).toContainText('MOF & BOF');
    await expect(board).toContainText('No funnel');
    await expect(page.locator('[data-slot="kanban-card"]')).toHaveCount(4);

    await page.locator('[data-slot="kanban-card"]').first().click();
    await expect(page.locator('[data-slot="youtube-copy-panel"]')).toBeVisible();
  });

  test('search narrows the grid and the empty state offers to clear it', async ({ page }) => {
    await page.goto(youtubeCopywritingPath);

    await page.locator('[data-slot="youtube-copy-search"]').fill('BFCM26');
    await expect(page.locator('[data-slot="youtube-copy-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="youtube-copy-count"]')).toContainText(
      '2 of 4 copy rows',
    );

    await page.locator('[data-slot="youtube-copy-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="youtube-copy-row"]')).toHaveCount(0);
    const empty = page.locator('[data-slot="youtube-copy-empty"]');
    await expect(empty).toContainText('No copy matches');
    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="youtube-copy-row"]')).toHaveCount(4);
  });
});
