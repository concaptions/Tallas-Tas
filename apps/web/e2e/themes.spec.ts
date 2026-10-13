import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { themesPath } from '../src/lib/routes';

/**
 * The shell stamps `data-hydrated` from its first client effect (`src/lib/hydration-replay.ts`).
 * A click or a right-click that lands before React has attached its handlers is dropped, so the
 * multi-select test waits for the stamp first — same helper as `creative-sheet.spec.ts`.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/**
 * The Themes route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: the GLOBAL badge, five active cards across the three categories,
 * two filters that live in the URL, an empty state that says so in words, and every write
 * disabled with a reason.
 *
 * The fixtures are `demoThemes` in `packages/db/src/demo-data.ts`: six themes, newest edit first,
 * two per category. One of them (Spring x Soccer, Seasonal) is `isActive: false`, and the
 * workspace now splits the library into Active/Archived tabs that open on Active — so the grid
 * shows FIVE cards by default and the sixth sits behind the Archived tab. Four active themes are
 * each used by the one demo brand ("Used by 1 brand"), leaving Holiday Gifting as the only active
 * worded zero.
 */
const PROBLEM_SOLUTION = 'Problem/Solution';

test.describe('themes in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/themes needs a session and real data',
  );

  test('opens with the GLOBAL badge, above the heading and impossible to miss', async ({
    page,
  }) => {
    await page.goto(themesPath);

    const badge = page.locator('[data-slot="global-badge"]');
    await expect(badge).toBeVisible();

    // The word GLOBAL comes through the shared StatusChip in the warn tone, never a local pill.
    const chip = badge.locator('[data-slot="status-chip"]');
    await expect(chip).toHaveText('GLOBAL');
    await expect(chip).toHaveAttribute('data-tone', 'warn');

    await expect(badge).toContainText('shared by every brand');
    await expect(badge).toContainText('available to every client immediately');

    // Above the heading, not beside it: the badge is the page's premise, not a title decoration.
    const badgeBox = await badge.boundingBox();
    const headingBox = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(badgeBox?.y ?? 0).toBeLessThan(headingBox?.y ?? 0);
  });

  test('opens on the grid: five active rows, every stored column, the name frozen', async ({
    page,
  }) => {
    await page.goto(themesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Themes');

    // The library opens on an Active/Archived tab split. Spring x Soccer is the one archived
    // fixture, so the default Active tab shows five of the six rows and counts both tabs.
    const rows = page.locator('[data-slot="theme-row"]');
    await expect(rows).toHaveCount(5);
    await expect(page.locator('[data-slot="tab-active"]')).toHaveText('Active (5)');
    await expect(page.locator('[data-slot="tab-archived"]')).toHaveText('Archived (1)');

    // Every stored field of a theme is a column, readable without opening a row.
    await expect(page.locator('[data-slot="themes-table"] thead th')).toHaveText([
      // Ticket 8: the leading header cell is the select-all checkbox the shared grid prepends.
      '',
      'Name',
      'Category',
      'Status',
      'Assignee',
      'Notes',
      'Attachments',
      'Attachment Summary',
      'Reference Links',
      'Used by',
      'Active',
    ]);
    await expect(page.locator('[data-slot="themes-table"] thead th').first()).toHaveCSS(
      'position',
      'sticky',
    );

    // Every row carries a category chip and a usage line; neither is ever blank.
    for (let index = 0; index < 5; index += 1) {
      const row = rows.nth(index);
      await expect(row.locator('[data-slot="status-chip"]').first()).not.toHaveText('');
      await expect(row.locator('[data-slot="theme-usage"]')).not.toHaveText('');
    }

    // Zero reads as words, never "0 brands"; a used theme reads singular. The demo brand's four
    // concepts sit on four different themes, and the aggregate counts distinct BRANDS, so four rows
    // read "Used by 1 brand". The other worded zero (Spring x Soccer) is archived, leaving
    // Holiday Gifting as the only zero on the Active tab.
    const used = rows.filter({ hasText: PROBLEM_SOLUTION });
    await expect(used.locator('[data-slot="theme-usage"]')).toHaveText('Used by 1 brand');
    await expect(page.getByText('Used by 1 brand')).toHaveCount(4);
    await expect(page.getByText('Used by no brands yet')).toHaveCount(1);
    await expect(page.getByText('0 brands')).toHaveCount(0);
    await expect(page.getByText('Used by 4 brands')).toHaveCount(0);

    // The count line is the platform's, not the brand's — the point of a global library.
    await expect(page.locator('[data-slot="theme-count"]')).toHaveText(
      '5 themes across the whole platform',
    );

    // An assignee cell never reads "null": the fixtures store none, so every cell is the dash.
    await expect(page.locator('[data-slot="theme-assignee"]')).toHaveCount(5);
    await expect(page.getByText('null', { exact: true })).toHaveCount(0);
  });

  test('a row opens the theme panel with the full card, the URL carries it, Escape closes it', async ({
    page,
  }) => {
    await page.goto(themesPath);

    const row = page.locator('[data-slot="theme-row"]').filter({ hasText: 'Yapper Style' });
    await row.click();

    const panel = page.locator('[data-slot="theme-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="theme-panel-title"]')).toHaveText('Yapper Style');
    await expect(page).toHaveURL(/theme=/);

    // The panel hosts the labelled card: the reference links are host-only chips there.
    await expect(panel.locator('[data-slot="theme-card"]')).toHaveCount(1);
    await expect(panel.locator('[data-slot="theme-link"]').first()).toHaveText('foreplay.example');

    // NOT a modal: the grid stays beside it.
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(5);

    await page.reload();
    await expect(page.locator('[data-slot="theme-panel"]')).toBeVisible();

    // After a reload the panel is visible before React has hydrated its window listener, so a
    // single Escape can land on nothing; retry until the handler is live (the Angles pattern).
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="theme-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass();
    await expect(page).not.toHaveURL(/theme=/);
  });

  test('the category chips filter the grid, write ?category= and survive a reload', async ({
    page,
  }) => {
    await page.goto(themesPath);

    // All, then the three kinds in the vocabulary order — and nothing else.
    await expect(page.locator('[data-slot="category-filter"]')).toHaveText([
      'All',
      'Framework',
      'Production Style',
      'Seasonal',
    ]);

    await page.locator('[data-slot="category-filter"][data-category="Framework"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(2);
    await expect(page).toHaveURL(/\?category=Framework/);
    await expect(
      page.locator('[data-slot="category-filter"][data-category="Framework"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    // A category with a space round-trips through the URL as %20 and comes back selected.
    await page.locator('[data-slot="category-filter"][data-category="Production Style"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(2);
    await expect(page).toHaveURL(/\?category=Production%20Style/);

    await page.reload();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(2);
    await expect(
      page.locator('[data-slot="category-filter"][data-category="Production Style"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    // Spring x Soccer is archived, so Holiday Gifting is the only Seasonal card on the Active tab.
    await page.locator('[data-slot="category-filter"][data-category="Seasonal"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(1);

    await page.locator('[data-slot="category-filter"][data-category="All"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(5);
    await expect(page).not.toHaveURL(/category=/);
  });

  test('search narrows the grid, combines with the category, and the empty state offers a way out', async ({
    page,
  }) => {
    await page.goto(themesPath);

    await page.locator('[data-slot="theme-search"]').fill('green');
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(1);
    // The narrowed total is the Active tab's five, not the library's six: the archived
    // Spring x Soccer fixture is not part of the grid being filtered.
    await expect(page.locator('[data-slot="theme-count"]')).toHaveText(
      '1 of 5 themes across the whole platform',
    );
    await expect(page).toHaveURL(/\?q=green/);

    // Green Screen is a Production Style, so pairing the search with Framework matches nothing
    // and the empty state is reached by COMBINING the two filters, not by either one alone.
    await page.locator('[data-slot="category-filter"][data-category="Framework"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="themes-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No theme matches these filters');

    await empty.locator('[data-slot="clear-filters"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(5);
    await expect(page).not.toHaveURL(/[?&](q|category)=/);

    // Both filters are URL-backed, so a narrowed library is a shareable link.
    await page.goto(`${themesPath}?category=Framework&q=problem`);
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="theme-row"]')).toContainText(PROBLEM_SOLUTION);
  });

  test('every write is disabled with a reason', async ({ page }) => {
    await page.goto(themesPath);

    const newTheme = page.locator('[data-slot="new-theme"]');
    await expect(newTheme).toBeVisible();
    await expect(newTheme).toBeDisabled();

    // A disabled button receives no pointer events, so the tooltip lives on the wrapper.
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // Disabled means disabled: clicking it opens no dialog.
    await newTheme.click({ force: true });
    await expect(page.locator('[data-slot="new-theme-dialog"]')).toHaveCount(0);
  });

  test('multi-select: the bar with its demo-held archive, select-all, and the right-click menu', async ({
    page,
  }) => {
    await page.goto(themesPath);
    await hydrated(page);

    const rows = page.locator('[data-slot="theme-row"]');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ticking a row selects it without opening the panel.
    await rows.nth(0).locator('[data-slot="row-select"]').check();
    await expect(rows.nth(0)).toHaveAttribute('data-checked', 'true');
    await expect(page.locator('[data-slot="theme-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'some');

    const bar = page.locator('[data-slot="selection-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('role', 'toolbar');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('1');
    await expect(bar).toContainText('theme selected');
    // The Active tab's one bulk write is Archive, held in demo with the shared hint.
    await expect(bar.locator('[data-slot="selection-archive"]')).toHaveText('Archive (1)');
    await expect(bar.locator('[data-slot="selection-archive"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );
    // The library is GLOBAL (non-negotiable 3): no bulk Delete, no Change status, no Duplicate.
    await expect(bar.locator('[data-slot="selection-delete"]')).toHaveCount(0);
    await expect(bar.locator('[data-slot="selection-change-status"]')).toHaveCount(0);
    await expect(bar.locator('[data-slot="selection-duplicate"]')).toHaveCount(0);

    // The header checkbox selects every row on screen, then clears them.
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'all');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('5');
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Right-click opens the menu with the page's two items — nothing destructive on the GLOBAL
    // library — and Escape closes it.
    await rows.nth(1).click({ button: 'right' });
    const menu = page.locator('[data-slot="row-context-menu"]');
    await expect(menu).toBeVisible();
    await expect(rows.nth(1)).toHaveAttribute('data-context', 'open');
    await expect(menu.locator('[role="menuitem"]')).toHaveText(['Open', 'Copy link']);
    await expect(menu.locator('[data-slot="context-delete"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // Copy link writes nothing, so it stays live in demo: headless Chromium may refuse the
    // clipboard, in which case the notice IS the URL — either way the notice names the outcome.
    await rows.nth(1).click({ button: 'right' });
    await menu.locator('[data-slot="context-copy-link"]').click();
    await expect(page.locator('[data-slot="selection-notice"]')).toHaveText(
      /^(Link copied\.|http.*\/app\/themes\?theme=.+)$/,
    );

    // Open is the row click's own panel, via the menu.
    await rows.nth(1).click({ button: 'right' });
    await menu.locator('[data-slot="context-open"]').click();
    await expect(page.locator('[data-slot="theme-panel"]')).toBeVisible();
    await expect(page).toHaveURL(/theme=/);

    // The Archived tab swaps the one bulk action for Restore: the flip is reversible.
    await page.locator('[data-slot="tab-archived"]').click();
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(1);
    await page.locator('[data-slot="theme-row"]').locator('[data-slot="row-select"]').check();
    await expect(bar.locator('[data-slot="selection-restore"]')).toHaveText('Restore (1)');
    await expect(bar.locator('[data-slot="selection-restore"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="selection-archive"]')).toHaveCount(0);
  });

  test('fits a 390px phone with no horizontal page scroll; the grid scrolls inside itself', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(themesPath);

    // Five rows: the Active tab hides the one archived fixture.
    await expect(page.locator('[data-slot="theme-row"]')).toHaveCount(5);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the sidebar links Themes and marks it active, so its SoonChip is gone', async ({
    page,
  }) => {
    await page.goto(themesPath);

    const link = page.getByRole('link', { name: 'Themes' });
    await expect(link).toHaveAttribute('href', themesPath);
    await expect(link).toHaveAttribute('aria-current', 'page');
  });
});
