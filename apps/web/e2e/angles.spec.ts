import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { anglesPath } from '../src/lib/routes';

/**
 * The Angles route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: five rows, five columns, a side panel that is not a modal, the open
 * angle in the URL, rich ad-inspiration cards, and every write control disabled with a reason.
 */
const BODY_CLOCK = '55555555-5555-4555-8555-000000000001';
const DAYLIGHT = '55555555-5555-4555-8555-000000000004';

test.describe('angles in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/angles needs a session and real data',
  );

  test('lists the five fixture angles in five columns', async ({ page }) => {
    await page.goto(anglesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Angles');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="angle-count"]')).toContainText('5 angles');

    await expect(page.locator('[data-slot="angles-table"] thead th')).toHaveText([
      'Name',
      'Persona',
      'Product',
      'Formats',
      'Updated',
    ]);

    // Persona is an info chip carrying the name before the em dash, the whole name in the title.
    const row = page.locator(`[data-angle-id="${DAYLIGHT}"]`);
    const persona = row.locator('td').nth(1).locator('[data-slot="status-chip"]');
    await expect(persona).toHaveText('Marcus');
    await expect(persona).toHaveAttribute('data-tone', 'info');
    await expect(row.locator('td').nth(1)).toHaveAttribute('title', /rotating-shift nurse/);

    // Product is the mute chip on the same row.
    await expect(row.locator('td').nth(2).locator('[data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'mute',
    );

    // Formats are accent chips in the fixed vocabulary order, whatever order the row stored.
    await expect(row.locator('td').nth(3).locator('[data-slot="status-chip"]')).toHaveText([
      'Static',
      'Video',
      'Motion Graphic',
    ]);
  });

  test('a row opens the panel, the URL carries it, a reload reopens it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(anglesPath);

    const firstRow = page.locator('[data-slot="angle-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="angle-panel-title"]')).toHaveText(name);

    // The six groups, in the order fields.ts states.
    await expect(panel.locator('[data-slot="angle-group-heading"]')).toHaveText([
      'Identity',
      'Hypothesis',
      'Pain Points',
      'USP',
      'Targeting',
      'Inspiration',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?angle=/);
    await page.reload();
    await expect(page.locator('[data-slot="angle-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="angle-panel"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\?angle=/);
  });

  test('persona and product are dropdowns, never typed text, and formats are toggles', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);

    const panel = page.locator('[data-slot="angle-panel"]');

    // Both links are Select triggers (a combobox), not inputs a strategist can type into.
    const persona = panel.locator('[data-slot="angle-personaId"]');
    await expect(persona).toHaveAttribute('role', 'combobox');
    await expect(persona).toBeDisabled();
    await expect(persona).toContainText('Marcus');

    const product = panel.locator('[data-slot="angle-productId"]');
    await expect(product).toHaveAttribute('role', 'combobox');
    await expect(product).toBeDisabled();

    // The four formats are toggles; the stored ones are pressed.
    await expect(panel.locator('[data-slot="format-toggle"]')).toHaveCount(4);
    await expect(
      panel.locator('[data-slot="format-toggle"][data-format="Static"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      panel.locator('[data-slot="format-toggle"][data-format="Carousel"]'),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('ad inspiration renders a rich card per link, and an angle with none says so', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${DAYLIGHT}`);

    const cards = page.locator('[data-slot="inspo-card"]');
    await expect(cards).toHaveCount(1);

    const card = cards.first();
    await expect(card).toHaveAttribute('data-kind', 'youtube');
    await expect(card).toHaveAttribute('target', '_blank');
    await expect(card).toHaveAttribute('rel', 'noreferrer noopener');
    await expect(card.locator('[data-slot="inspo-source"]')).toHaveText('YouTube');
    await expect(card.locator('[data-slot="inspo-host"]')).toHaveText('youtube.com');
    await expect(card.locator('[data-slot="inspo-title"]')).toContainText('nm1TxQj9IsQ');

    // The Meta Ad Library entry on another angle resolves to the Meta source, not a bare host.
    await page.goto(`${anglesPath}?angle=55555555-5555-4555-8555-000000000003`);
    await expect(page.locator('[data-slot="inspo-card"]')).toHaveCount(2);
    await expect(
      page.locator('[data-slot="inspo-card"]').first().locator('[data-slot="inspo-source"]'),
    ).toHaveText('Meta');
  });

  test('every write is disabled with a reason', async ({ page }) => {
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);

    await expect(page.locator('[data-slot="new-angle"]')).toBeDisabled();

    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel.locator('[data-slot="angle-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="angle-save"]')).toBeDisabled();
    await expect(panel.locator('#angle-field-name')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#angle-field-description')).toHaveAttribute('readonly', '');

    // Every disabled write explains itself on hover, because a disabled button gets no pointer events.
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // The format toggles are a write as much as the save is, so they are inert and explain why.
    await expect(panel.locator('[data-slot="format-toggle"]').first()).toBeDisabled();
    await expect(
      panel.locator('[data-slot="disabled-write"]:has([data-slot="angle-formats"])'),
    ).toHaveAttribute('title', 'Sign in required to save changes');

    // Type is inert on this page and says so rather than pretending a click was saved.
    await expect(panel.locator('[data-slot="type-toggle"]').first()).toBeDisabled();
  });

  test('search filters the table and the empty state offers to clear it', async ({ page }) => {
    await page.goto(anglesPath);

    // "Denise" is the persona on two of the five angles.
    await page.locator('[data-slot="angle-search"]').fill('denise');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="angle-count"]')).toContainText('2 of 5 angles');

    await page.locator('[data-slot="angle-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="angles-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);

    // The filter is URL-backed, so a narrowed table is a shareable link.
    await page.goto(`${anglesPath}?q=denise`);
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(2);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(anglesPath);

    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);
    const listOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(1);

    // The panel is full width under 900px, so the open state has to fit too.
    await page.goto(`${anglesPath}?angle=${BODY_CLOCK}`);
    await expect(page.locator('[data-slot="angle-panel"]')).toBeVisible();
    const panelOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(panelOverflow).toBeLessThanOrEqual(1);
  });
});
