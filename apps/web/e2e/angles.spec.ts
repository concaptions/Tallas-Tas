import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { anglesPath } from '../src/lib/routes';

/**
 * The Angles route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: five rows, four columns, a side panel that is not a modal, the open
 * angle in the URL, document links in the Resources group, and every write control disabled with a
 * reason.
 */
const BODY_CLOCK = '55555555-5555-4555-8555-000000000001';
const DAYLIGHT = '55555555-5555-4555-8555-000000000004';

test.describe('angles in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/angles needs a session and real data',
  );

  test('lists the five fixture angles in four columns', async ({ page }) => {
    await page.goto(anglesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Angles');
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="angle-count"]')).toContainText('5 angles');

    // Talal feedback B+C: the Formats column left the table, so a row is four cells wide and
    // formats live only in the panel now.
    await expect(page.locator('[data-slot="angles-table"] thead th')).toHaveText([
      'Name',
      'Persona',
      'Product',
      'Updated',
    ]);

    // Persona is an info chip carrying the name before the em dash, the whole name in the title.
    const row = page.locator(`[data-angle-id="${DAYLIGHT}"]`);
    await expect(row.locator('td')).toHaveCount(4);
    const persona = row.locator('td').nth(1).locator('[data-slot="status-chip"]');
    await expect(persona).toHaveText('Marcus');
    await expect(persona).toHaveAttribute('data-tone', 'info');
    await expect(row.locator('td').nth(1)).toHaveAttribute('title', /rotating-shift nurse/);

    // Product is the mute chip on the same row; Updated closes the row where Formats used to sit.
    await expect(row.locator('td').nth(2).locator('[data-slot="status-chip"]')).toHaveAttribute(
      'data-tone',
      'mute',
    );
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

    // The six groups, in the order fields.ts states; "Inspiration" became "Resources".
    await expect(panel.locator('[data-slot="angle-group-heading"]')).toHaveText([
      'Identity',
      'Hypothesis',
      'Pain Points',
      'USP',
      'Targeting',
      'Resources',
    ]);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?angle=/);
    await page.reload();
    await expect(page.locator('[data-slot="angle-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="angle-row"]')).toHaveCount(5);

    // After the reload the client bundle may still be hydrating, so the window keydown listener
    // is not always attached when a single Escape lands (the tracked panel Escape-close race —
    // products.spec and personas.spec keep the strict one-press form as its sentinels). Re-press
    // until the close takes.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="angle-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?angle=/);
  });

  test('persona and product are dropdowns, never typed text, and type renders as toggles', async ({
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

    // Talal feedback B+C: the format toggles left the panel; the stored formats still ride along
    // as hidden form inputs so a save round-trips them unchanged.
    await expect(panel.locator('input[name="formats"]')).toHaveCount(2);
    await expect(panel.locator('input[name="formats"]').first()).toHaveValue('Static');

    // Type is the remaining toggle row: all four vocabulary entries, the stored ones pressed.
    await expect(panel.locator('[data-slot="type-toggle"]')).toHaveCount(4);
    await expect(panel.locator('[data-slot="type-toggle"][data-type="Identity"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      panel.locator('[data-slot="type-toggle"][data-type="Functional"]'),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('resources carry a brief URL and an exact script URL as document link fields', async ({
    page,
  }) => {
    await page.goto(`${anglesPath}?angle=${DAYLIGHT}`);

    // Talal feedback B+C: the rich ad-inspiration cards no longer render; the closest current
    // equivalent is the Resources group, whose two URL fields link the angle to its documents.
    const panel = page.locator('[data-slot="angle-panel"]');
    await expect(panel.locator('[data-slot="angle-group-heading"]').last()).toHaveText('Resources');
    await expect(panel.locator('[data-slot="inspo-card"]')).toHaveCount(0);

    const brief = panel.locator('input[name="briefUrl"]');
    await expect(brief).toBeVisible();
    await expect(brief).toHaveAttribute('type', 'url');
    await expect(brief).toHaveAttribute('placeholder', 'https://…');

    const script = panel.locator('input[name="exactScriptUrl"]');
    await expect(script).toBeVisible();
    await expect(script).toHaveAttribute('type', 'url');

    // The fixtures store no document links yet, so both fields sit empty on the placeholder,
    // rendered in font-mono like every machine-readable string.
    await expect(brief).toHaveValue('');
    await expect(script).toHaveValue('');
    await expect(brief).toHaveClass(/font-mono/);
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

    // The Resources URL fields are writes as much as the save is, so demo makes them read-only.
    await expect(panel.locator('input[name="briefUrl"]')).toHaveAttribute('readonly', '');
    await expect(panel.locator('input[name="exactScriptUrl"]')).toHaveAttribute('readonly', '');

    // The format toggles left the panel (Talal feedback B+C); Type is the remaining toggle row,
    // inert on this page, and its wrapper says why rather than pretending a click was saved.
    await expect(panel.locator('[data-slot="type-toggle"]').first()).toBeDisabled();
    await expect(
      panel.locator('[data-slot="disabled-write"]:has([data-slot="angle-types"])'),
    ).toHaveAttribute('title', 'Type is set with the Concepts phase; this page does not write it.');
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
