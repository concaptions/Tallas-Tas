import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';

/**
 * Client portal nav behaviour under the Oct 6/7 interface-config sprint.
 *
 * In DEMO MODE the loader returns the empty snapshot, so the layout falls back to showing every
 * CLIENT_TAB_KEYS tab (`standardFallback` branch) and renders no custom nav entries. The three
 * assertions below pin the fallback: the four standard tabs are present, in order, with no
 * custom-page entries, and the standard nav links resolve under /client/<slug>/<segment>.
 */
test.describe('client portal nav in demo mode (no Clerk)', () => {
  test.skip(clerkKeys() !== undefined, 'Clerk configured; demo-mode fallback does not apply');

  test('shows the four standard tabs when the brand has no interface_tab_visibility rows', async ({
    page,
  }) => {
    await page.goto('/client/niagara-sleep-solutions');

    const nav = page.locator('[data-slot="client-nav"]');
    await expect(nav).toBeVisible();

    const standardLinks = nav.locator('[data-slot="standard-tab-link"]');
    await expect(standardLinks).toHaveCount(4);
    const keys = await standardLinks.evaluateAll((nodes: Element[]) =>
      nodes.map((n) => (n as HTMLElement).dataset.tabKey ?? ''),
    );
    expect(keys).toStrictEqual(['concepts', 'creative_sheet', 'ugc_management', 'copywriting']);
  });

  test('every standard tab opens a page, never a 404 — the Copywriting tab shipped without one (2026-10-09)', async ({
    page,
  }) => {
    await page.goto('/client/niagara-sleep-solutions');
    const nav = page.locator('[data-slot="client-nav"]');
    const hrefs = await nav
      .locator('[data-slot="standard-tab-link"]')
      .evaluateAll((nodes: Element[]) =>
        nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href') ?? ''),
      );
    expect(hrefs).toHaveLength(4);

    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(response?.status(), `${href} should resolve`).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    // The Copywriting tab in particular: its page lists the demo copy with a status chip per row.
    await page.goto('/client/niagara-sleep-solutions/copywriting');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Copywriting');
    await expect(page.locator('[data-slot="client-copy-row"]').first()).toBeVisible();
  });

  test('renders no custom-page entries when the brand has no custom pages', async ({ page }) => {
    await page.goto('/client/niagara-sleep-solutions');
    await expect(page.locator('[data-slot="custom-tab-link"]')).toHaveCount(0);
  });
});
