import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { copyTypesPath } from '../src/lib/routes';

/**
 * The Copy Types route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures
 * (`demoCopyTypes` in `packages/db/src/demo-copy-types.ts`: four types, newest edit first), and the
 * page is fully usable read-only: a grid with the two link counts, a side panel that is not a modal
 * with a labelled control for every stored Airtable field and a read-only list for each record link,
 * the open copy type in the URL, and every write disabled with a reason.
 */
const FIRST_COPY_TYPE_ID = 'c0b7a1d3-0013-4013-8013-000000000001';
const FOUNDER_NOTE_ID = 'c0b7a1d3-0013-4013-8013-000000000004';

test.describe('copy types in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/copy-types needs a session and real data',
  );

  test('lists the four fixture copy types with their link counts in five columns', async ({
    page,
  }) => {
    await page.goto(copyTypesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Copy Types');
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="copy-type-count"]')).toContainText('4 copy types');

    await expect(page.locator('[data-slot="copy-types-table"] thead th')).toHaveText([
      'Name',
      'Description',
      'Meta copies',
      'YouTube copies',
      'Updated',
    ]);

    // The counts are the shared StatusChip, never bare text, and they pluralise.
    const first = page.locator(`[data-copy-type-id="${FIRST_COPY_TYPE_ID}"]`);
    await expect(first.locator('td').nth(2).locator('[data-slot="status-chip"]')).toHaveText(
      '2 Meta copies',
    );
    await expect(first.locator('td').nth(3).locator('[data-slot="status-chip"]')).toHaveText(
      '2 YouTube copies',
    );
    // The description cell shows its first line and keeps the full text in the cell's title.
    await expect(first.locator('td').nth(1)).toHaveAttribute('title', /^Name the 3am problem/);

    // A type with no description renders the em dash, never an empty cell, and a zero in the mute
    // tone, never a blank.
    const founderNote = page.locator(`[data-copy-type-id="${FOUNDER_NOTE_ID}"]`);
    await expect(founderNote.locator('td').nth(1)).toHaveText('—');
    const zero = founderNote.locator('td').nth(2).locator('[data-slot="status-chip"]');
    await expect(zero).toHaveText('0 Meta copies');
    await expect(zero).toHaveAttribute('data-tone', 'mute');
  });

  test('a row opens the panel with a labelled control for every Airtable field, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(copyTypesPath);

    const firstRow = page.locator('[data-slot="copy-type-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="copy-type-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="copy-type-panel-title"]')).toHaveText(name);

    // Name (singleLineText): a labelled input.
    await expect(panel.locator('#copy-type-field-name')).toBeVisible();
    await expect(panel.locator('label[for="copy-type-field-name"]')).toContainText('Name');

    // Description (multilineText): a labelled textarea.
    const description = panel.locator('#copy-type-field-description');
    await expect(description).toBeVisible();
    expect(await description.evaluate((el) => el.tagName)).toBe('TEXTAREA');
    await expect(panel.locator('label[for="copy-type-field-description"]')).toContainText(
      'Description',
    );

    // "Ads Copywriting copy" (multipleRecordLinks → Meta Copywriting): a read-only list labelled by
    // its heading, one entry per linked copy, each named by its headline.
    const metaList = panel.locator('[data-slot="copy-type-meta-copies"]');
    await expect(metaList).toBeVisible();
    await expect(metaList).toHaveAttribute('aria-labelledby', 'copy-type-meta-heading');
    await expect(panel.locator('#copy-type-meta-heading')).toContainText('Meta copies');
    await expect(metaList.locator('[data-slot="copy-type-meta-copy"]')).toHaveCount(2);
    await expect(metaList.locator('[data-slot="copy-type-meta-copy"]').first()).toHaveText(
      'Your Rota Is Broken. You Are Not.',
    );

    // "Copywriting" (multipleRecordLinks → Youtube Copywriting): the same list over YouTube copies.
    const youtubeList = panel.locator('[data-slot="copy-type-youtube-copies"]');
    await expect(youtubeList).toBeVisible();
    await expect(youtubeList).toHaveAttribute('aria-labelledby', 'copy-type-youtube-heading');
    await expect(panel.locator('#copy-type-youtube-heading')).toContainText('YouTube copies');
    await expect(youtubeList.locator('[data-slot="copy-type-youtube-copy"]')).toHaveCount(2);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?copyType=/);
    await page.reload();
    await expect(page.locator('[data-slot="copy-type-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(4);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="copy-type-panel"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\?copyType=/);
  });

  test('the panel is read-only in demo mode and refuses to save', async ({ page }) => {
    await page.goto(`${copyTypesPath}?copyType=${FIRST_COPY_TYPE_ID}`);

    const panel = page.locator('[data-slot="copy-type-panel"]');
    await expect(panel.locator('[data-slot="copy-type-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="copy-type-save"]')).toBeDisabled();
    await expect(panel.locator('#copy-type-field-name')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#copy-type-field-description')).toHaveAttribute('readonly', '');

    // The counts beside the lists are the shared StatusChip in the info tone.
    const metaCount = panel.locator('[data-slot="copy-type-meta-count"] [data-slot="status-chip"]');
    await expect(metaCount).toHaveText('2 Meta copies');
    await expect(metaCount).toHaveAttribute('data-tone', 'info');

    // A type nothing is tagged with yet says so in words, never an empty box.
    await page.goto(`${copyTypesPath}?copyType=${FOUNDER_NOTE_ID}`);
    const emptyPanel = page.locator('[data-slot="copy-type-panel"]');
    await expect(emptyPanel.locator('[data-slot="copy-type-meta-copies"]')).toContainText(
      'No Meta copy carries this type yet.',
    );
    await expect(emptyPanel.locator('[data-slot="copy-type-youtube-copy"]')).toHaveCount(0);
  });

  test('search filters the grid, lives in ?q=, and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(copyTypesPath);

    // "testimonial" is one type's name and appears nowhere else; one row.
    await page.locator('[data-slot="copy-type-search"]').fill('testimonial');
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-type-count"]')).toContainText('1 of 4 copy types');
    await expect(page).toHaveURL(/[?&]q=testimonial/);

    // A linked copy's headline is searchable too: "rota" is in the body-clock Meta copy, tagged on
    // the Problem / Agitate / Solve type only.
    await page.locator('[data-slot="copy-type-search"]').fill('rota');
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveAttribute(
      'data-copy-type-id',
      FIRST_COPY_TYPE_ID,
    );

    await page.locator('[data-slot="copy-type-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="copy-types-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(4);
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(copyTypesPath);

    await expect(page.locator('[data-slot="copy-type-row"]')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
