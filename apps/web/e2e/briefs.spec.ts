import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { briefPath, briefsPath } from '../src/lib/routes';

/**
 * The Creative Briefs route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures, and
 * both pages are fully usable read-only: six briefs in a six-column table, a real detail route with
 * a generated name that is not a field, three columns, the inspiration previews, the two-track rail
 * and every write disabled with a reason.
 *
 * The fixtures are `demoBriefs` in `packages/db/src/demo-data.ts`: six rows, newest edit first, in
 * six different internal statuses across both tracks, with exactly one `approved` — so
 * `isClientTrackOpen` is true on that one row and false on the other five.
 */
const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';
const BUNDLE_STANDALONE = '77777777-7777-4777-8777-000000000005';

const BODY_CLOCK_NAME = 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2';
const BUNDLE_NAME = 'RS1-B4-Standalone-V3-NIGHT RESET BUNDLE';

test.describe('creative briefs in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/briefs needs a session and real data',
  );

  test('lists the six fixtures in six columns, with the standalone chip in the concept cell', async ({
    page,
  }) => {
    await page.goto(briefsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Briefs');
    await expect(page.locator('[data-slot="brief-count"]')).toHaveText('6 briefs');

    await expect(page.locator('[data-slot="briefs-table"] thead th')).toHaveText([
      'Name',
      'Concept',
      'Type',
      'Priority',
      'Assignee',
      'Internal Status',
    ]);

    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(6);

    // The generated name is monospace, because it is system output and not a typed field.
    const name = page.locator(`[data-brief-id="${BODY_CLOCK}"] [data-slot="brief-row-name"]`);
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // A brief with no concept says so in a chip, never a blank cell or a bare em dash.
    const standalone = page.locator(
      `[data-brief-id="${BUNDLE_STANDALONE}"] [data-slot="brief-standalone"] [data-slot="status-chip"]`,
    );
    await expect(standalone).toHaveText('Standalone');
    await expect(standalone).toHaveAttribute('data-tone', 'mute');

    // Every status is a StatusChip with a tone from chipTone, never a locally coloured pill.
    const approved = page
      .locator(`[data-brief-id="${BODY_CLOCK}"] [data-slot="status-chip"]`)
      .last();
    await expect(approved).toHaveText('Approved');
    await expect(approved).toHaveAttribute('data-tone', 'ok');

    // "New brief" is a write: disabled, and it explains itself.
    const newBrief = page.locator('[data-slot="new-brief"]');
    await expect(newBrief).toBeDisabled();
    await expect(page.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      /.+/,
    );
  });

  test('the search narrows the list into ?q= and the empty state offers a way out', async ({
    page,
  }) => {
    await page.goto(briefsPath);

    await page.locator('[data-slot="brief-search"]').fill('standalone');
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="brief-count"]')).toHaveText('1 of 6 briefs');
    await expect(page).toHaveURL(/\?q=standalone/);

    // A filter that matches nothing says so in words and offers to clear itself.
    await page.locator('[data-slot="brief-search"]').fill('zzzzz');
    await expect(page.locator('[data-slot="briefs-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="briefs-empty"]')).toContainText('No brief matches');
    await page.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(6);
  });

  test('a row click lands on the detail route, and Back restores the list', async ({ page }) => {
    await page.goto(briefsPath);
    await page.locator(`[data-brief-id="${BODY_CLOCK}"]`).click();

    await expect(page).toHaveURL(new RegExp(`${briefPath(BODY_CLOCK)}$`));
    await expect(page.locator('[data-slot="briefs-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BODY_CLOCK_NAME);

    await page.goBack();
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(6);
  });

  test('an unknown id is a 404, not a crash', async ({ page }) => {
    const response = await page.goto(`${briefsPath}/77777777-7777-4777-8777-999999999999`);

    expect(response?.status()).toBe(404);
  });

  test('the detail page is three columns, the name is copyable and the Version dropdown renames it with no navigation', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(briefPath(BODY_CLOCK));

    // Criterion 6: three real columns, left, centre and right.
    await expect(page.locator('[data-slot="brief-left"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-centre"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-right"]')).toBeVisible();

    // Criterion 4: the name is monospace, is not held by any field, and copies with a confirmation.
    const name = page.locator('[data-slot="brief-name"]');
    await expect(name).toHaveText(BODY_CLOCK_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);
    await expect(page.locator(`input[value="${BODY_CLOCK_NAME}"]`)).toHaveCount(0);

    const copy = page.locator('[data-slot="brief-name-copy"]');
    await expect(copy).toHaveText('Copy');
    await copy.click();
    await expect(copy).toHaveText('Copied');

    // Criterion 7: the Version dropdown rewrites the name in the browser, with no round trip.
    const url = page.url();
    await page.locator('[data-slot="brief-version"]').click();
    await page.getByRole('option', { name: 'V4' }).click();
    await expect(name).toHaveText(BODY_CLOCK_NAME.replace('-V2', '-V4'));
    expect(page.url()).toBe(url);

    // Criterion 7: the concept context card links to the concept, and the ratio grid is the §8 set.
    await expect(page.locator('[data-slot="brief-concept"]')).toHaveAttribute(
      'href',
      /\/app\/concepts\//,
    );
    await expect(page.locator('[data-slot="brief-dimension"]')).toHaveCount(3);

    // Criterion 8: the three prose sections, in order.
    await expect(page.locator('[data-slot="brief-briefToDesign"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-scriptContent"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-elementsTested"]')).toBeVisible();

    // Criterion 9: one preview per pasted link, with the provider named on each.
    const cards = page.locator('[data-slot="inspiration-card"]');
    await expect(cards).toHaveCount(2);
    await expect(cards.first().locator('[data-slot="inspiration-source"]')).toHaveText(
      'Meta Ad Library',
    );
    await expect(cards.nth(1).locator('[data-slot="inspiration-embed"]')).toHaveAttribute(
      'src',
      /youtube\.com\/embed\//,
    );
  });

  test('the rail shows both tracks, open on the approved brief and shut on the others', async ({
    page,
  }) => {
    await page.goto(briefPath(BODY_CLOCK));

    const rail = page.locator('[data-slot="brief-rail"]');
    await expect(rail.locator('[data-slot="internal-track"]')).toBeVisible();
    await expect(rail.locator('[data-slot="client-track"]')).toHaveAttribute('data-open', 'true');

    await page.goto(briefPath(BUNDLE_STANDALONE));
    await expect(page.locator('[data-slot="brief-name"]')).toHaveText(BUNDLE_NAME);
    const shut = page.locator('[data-slot="brief-rail"] [data-slot="client-track"]');
    await expect(shut).toHaveAttribute('data-open', 'false');
    await expect(shut.locator('[data-slot="status-chip"]')).toHaveText('locked');

    // A standalone brief says why it has no concept card, rather than showing an empty one.
    await expect(page.locator('[data-slot="brief-concept"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="brief-concept-standalone"]')).toContainText(
      'No parent concept',
    );
  });

  test('every write on the detail page is disabled, with a reason on hover', async ({ page }) => {
    await page.goto(briefPath(BODY_CLOCK));

    const checks = page.locator('[data-slot="brief-qa-check"]');
    await expect(checks).toHaveCount(3);
    for (const check of await checks.all()) {
      await expect(check).toBeDisabled();
    }
    await expect(page.locator('[data-slot="brief-qa"]')).toContainText('Video Editor QA');

    await expect(page.locator('[data-slot="brief-spelling-rerun"]')).toBeDisabled();
    await expect(page.locator('[data-slot="brief-save"]')).toBeDisabled();
    await expect(page.locator('[data-slot="brief-advance"]')).toBeDisabled();

    // Each disabled write carries its explanation on the enabled wrapper around it.
    const wrapper = page.locator('[data-slot="brief-save"]').locator('xpath=..');
    await expect(wrapper).toHaveAttribute('title', 'Sign in required to save changes');
  });

  test('reads down to 390px with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(briefPath(BODY_CLOCK));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.goto(briefsPath);
    const listOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(listOverflow).toBeLessThanOrEqual(0);
  });
});
