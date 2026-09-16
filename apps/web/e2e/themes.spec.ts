import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { themesPath } from '../src/lib/routes';

/**
 * The Themes route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: the GLOBAL badge, six cards across the three categories, two filters
 * that live in the URL, an empty state that says so in words, and every write disabled with a
 * reason.
 *
 * The fixtures are `demoThemes` in `packages/db/src/demo-data.ts`: six themes, newest edit first,
 * two per category, and exactly one of them (Problem/Solution) actually used by a brand — so the
 * singular "Used by 1 brand" appears once and "Used by no brands yet" five times.
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

  test('renders the six fixtures as cards, never a table, each with its chip and usage line', async ({
    page,
  }) => {
    await page.goto(themesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Themes');
    await expect(page.locator('table')).toHaveCount(0);

    const cards = page.locator('[data-slot="theme-card"]');
    await expect(cards).toHaveCount(6);

    // Every card carries a category chip and a usage line; neither is ever blank.
    await expect(cards.locator('[data-slot="status-chip"]').first()).toBeVisible();
    for (let index = 0; index < 6; index += 1) {
      const card = cards.nth(index);
      await expect(card.locator('[data-slot="status-chip"]').first()).not.toHaveText('');
      await expect(card.locator('[data-slot="theme-usage"]')).not.toHaveText('');
    }

    // Zero reads as words, never "0 brands"; the one used theme reads singular.
    const used = cards.filter({ hasText: PROBLEM_SOLUTION });
    await expect(used.locator('[data-slot="theme-usage"]')).toHaveText('Used by 1 brand');
    await expect(page.getByText('Used by no brands yet')).toHaveCount(5);
    await expect(page.getByText('0 brands')).toHaveCount(0);

    // The count line is the platform's, not the brand's — the point of a global library.
    await expect(page.locator('[data-slot="theme-count"]')).toHaveText(
      '6 themes across the whole platform',
    );

    // The reference links are host-only chips, so a swipe-file URL cannot widen a card.
    await expect(
      cards.filter({ hasText: 'Yapper Style' }).locator('[data-slot="theme-link"]').first(),
    ).toHaveText('foreplay.example');
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
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(2);
    await expect(page).toHaveURL(/\?category=Framework/);
    await expect(
      page.locator('[data-slot="category-filter"][data-category="Framework"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    // A category with a space round-trips through the URL as %20 and comes back selected.
    await page.locator('[data-slot="category-filter"][data-category="Production Style"]').click();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(2);
    await expect(page).toHaveURL(/\?category=Production%20Style/);

    await page.reload();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(2);
    await expect(
      page.locator('[data-slot="category-filter"][data-category="Production Style"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.locator('[data-slot="category-filter"][data-category="Seasonal"]').click();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(2);

    await page.locator('[data-slot="category-filter"][data-category="All"]').click();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(6);
    await expect(page).not.toHaveURL(/category=/);
  });

  test('search narrows the grid, combines with the category, and the empty state offers a way out', async ({
    page,
  }) => {
    await page.goto(themesPath);

    await page.locator('[data-slot="theme-search"]').fill('green');
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="theme-count"]')).toHaveText(
      '1 of 6 themes across the whole platform',
    );
    await expect(page).toHaveURL(/\?q=green/);

    // Green Screen is a Production Style, so pairing the search with Framework matches nothing
    // and the empty state is reached by COMBINING the two filters, not by either one alone.
    await page.locator('[data-slot="category-filter"][data-category="Framework"]').click();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="themes-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No theme matches these filters');

    await empty.locator('[data-slot="clear-filters"]').click();
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(6);
    await expect(page).not.toHaveURL(/[?&](q|category)=/);

    // Both filters are URL-backed, so a narrowed library is a shareable link.
    await page.goto(`${themesPath}?category=Framework&q=problem`);
    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="theme-card"]')).toContainText(PROBLEM_SOLUTION);
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

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(themesPath);

    await expect(page.locator('[data-slot="theme-card"]')).toHaveCount(6);

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
