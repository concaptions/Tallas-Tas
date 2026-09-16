import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { conceptPath, conceptsPath } from '../src/lib/routes';

/**
 * The Concepts route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and both
 * pages are fully usable read-only: four concepts in a five-column table, the same four grouped on
 * a board, a real detail route with a generated name that is not a field, five inherited fields
 * that are not editable, the two-track rail with the client bar shut, and every write disabled with
 * a reason.
 *
 * The fixtures are `demoConcepts` in `packages/db/src/demo-data.ts`: four rows, newest edit first,
 * each in a different internal status and all four strictly before Approved — so `isClientTrackOpen`
 * is false on every one of them and the client bar is locked on every detail page.
 */
const BODY_CLOCK = '66666666-6666-4666-8666-000000000001';
const NOT_YOUR_AGE = '66666666-6666-4666-8666-000000000002';

const NOT_YOUR_AGE_NAME = 'B2-It Is Not Just Your Age-Green Screen';

test.describe('concepts in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/concepts needs a session and real data',
  );

  test('opens on the table, with the five columns in order and the four fixtures', async ({
    page,
  }) => {
    await page.goto(conceptsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concepts');
    await expect(page.locator('[data-slot="concept-count"]')).toHaveText('4 concepts');

    // Table is the default: no ?view= in the URL, the table present and the board absent.
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="concept-board"]')).toHaveCount(0);

    await expect(page.locator('[data-slot="concepts-table"] thead th')).toHaveText([
      'Name',
      'Batch',
      'Angle',
      'Theme',
      'Internal Status',
    ]);

    const rows = page.locator('[data-slot="concept-row"]');
    await expect(rows).toHaveCount(4);

    // The generated name is monospace, because it is system output and not a typed field.
    const name = page.locator(`[data-concept-id="${NOT_YOUR_AGE}"] [data-slot="concept-row-name"]`);
    await expect(name).toHaveText(NOT_YOUR_AGE_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // Every status is a StatusChip with a tone from chipTone, never a locally coloured pill.
    const chips = page.locator('[data-slot="concept-row"] [data-slot="status-chip"]');
    await expect(chips).toHaveCount(4);
    const revisions = page.locator(`[data-concept-id="${BODY_CLOCK}"] [data-slot="status-chip"]`);
    await expect(revisions).toHaveText('Videos Revisions');
    await expect(revisions).toHaveAttribute('data-tone', 'warn');
  });

  test('?view=board renders the board, and the toggle writes the view into the URL', async ({
    page,
  }) => {
    await page.goto(`${conceptsPath}?view=board`);

    // Seven columns: one per step of the video track, empties kept.
    await expect(page.locator('[data-slot="concept-board"]')).toBeVisible();
    await expect(page.locator('[data-slot="concepts-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-column"]')).toHaveCount(7);
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(4);

    // The same four rows, one per column, each column headed with its label and its count.
    const submitted = page.locator('[data-slot="concept-column"][data-status="ad_submitted"]');
    await expect(submitted.locator('[data-slot="concept-column-label"]')).toHaveText(
      'Ad Submitted',
    );
    await expect(submitted.locator('[data-slot="concept-column-count"]')).toHaveText('1');
    await expect(
      page
        .locator('[data-slot="concept-column"][data-status="approved"]')
        .locator('[data-slot="concept-column-empty"]'),
    ).toBeVisible();

    // The toggle is two controls and neither is a pill.
    const toggle = page.locator('[data-slot="concepts-view-toggle"]');
    const options = toggle.locator('[data-slot="concepts-view-option"]');
    await expect(options).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      expect(await options.nth(index).getAttribute('class')).not.toContain('rounded-full');
    }

    // Back to the table: the parameter is removed rather than written as ?view=table.
    await options.filter({ hasText: 'Table' }).click();
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    // And to the board: the parameter is written, so a reload restores it.
    await options.filter({ hasText: 'Board' }).click();
    await expect(page).toHaveURL(/\?view=board$/);
    await page.reload();
    await expect(page.locator('[data-slot="concept-board"]')).toBeVisible();
  });

  test('search narrows both views, lives in ?q=, and the empty state offers a way out', async ({
    page,
  }) => {
    await page.goto(conceptsPath);

    await page.locator('[data-slot="concept-search"]').fill('green');
    await expect(page.locator('[data-slot="concept-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="concept-row"]')).toContainText(NOT_YOUR_AGE_NAME);
    await expect(page.locator('[data-slot="concept-count"]')).toHaveText('1 of 4 concepts');
    await expect(page).toHaveURL(/\?q=green/);

    // Nothing matches: the no-match sentence, NOT the "no concepts yet" one, and no New concept.
    await page.locator('[data-slot="concept-search"]').fill('zzzznomatch');
    await expect(page.locator('[data-slot="concepts-table"]')).toHaveCount(0);
    const empty = page.locator('[data-slot="concepts-empty"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No concept matches this search');
    await expect(empty.locator('[data-slot="empty-new-concept"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-count"]')).toHaveText('0 of 4 concepts');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="concept-row"]')).toHaveCount(4);
    await expect(page).not.toHaveURL(/[?&]q=/);

    // The same filter runs on the board, so a column's count is the count of what is in it.
    await page.goto(`${conceptsPath}?view=board&q=green`);
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(1);
    await expect(
      page
        .locator('[data-slot="concept-column"][data-status="video_editing_in_progress"]')
        .locator('[data-slot="concept-column-count"]'),
    ).toHaveText('1');
  });

  test('a row click lands on the concept own route, and Back restores the view', async ({
    page,
  }) => {
    // The table's row is the same click target the board's card is.
    await page.goto(conceptsPath);
    await page.locator(`[data-slot="concept-row"][data-concept-id="${BODY_CLOCK}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${conceptPath(BODY_CLOCK)}$`));
    await page.goBack();
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    await page.goto(`${conceptsPath}?view=board`);

    await page.locator(`[data-slot="concept-card"][data-concept-id="${NOT_YOUR_AGE}"]`).click();

    // A real route segment, not a panel: the URL is the detail path and the list is gone.
    await expect(page).toHaveURL(new RegExp(`${conceptPath(NOT_YOUR_AGE)}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-board"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-rail"]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\?view=board$/);
    await expect(page.locator('[data-slot="concept-board"]')).toBeVisible();
  });

  test('the detail page names itself, in monospace, and changes when the Batch changes', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const preview = page.locator('[data-slot="concept-name-preview"]');
    await expect(preview).toHaveText(NOT_YOUR_AGE_NAME);
    await expect(preview).toHaveCSS('font-family', /mono/i);

    // No text field anywhere on the page holds the name, hidden or otherwise.
    await expect(page.locator('[name="name"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-name-note"]')).toContainText('never typed');

    // Changing the Batch re-renders the name in the browser, with no round trip.
    await page.locator('[data-slot="concept-batch"]').click();
    await page.getByRole('option', { name: 'B7', exact: true }).click();
    await expect(preview).toHaveText('B7-It Is Not Just Your Age-Green Screen');
    await expect(page).toHaveURL(new RegExp(`${conceptPath(NOT_YOUR_AGE)}$`));
  });

  test('the five inherited fields are read-only text, each labelled from Angle', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const block = page.locator('[data-slot="concept-inherited"]');
    const fields = block.locator('[data-slot="inherited-field"]');
    await expect(fields).toHaveCount(5);
    await expect(fields.locator('[data-slot="from-angle"]')).toHaveText([
      'from Angle',
      'from Angle',
      'from Angle',
      'from Angle',
      'from Angle',
    ]);

    await expect(fields.nth(0)).toContainText('Description');
    await expect(fields.nth(1)).toContainText('Pain Points');
    await expect(fields.nth(2)).toContainText('USP');
    await expect(fields.nth(3)).toContainText('Persona');
    await expect(fields.nth(4)).toContainText('Product');

    // Not disabled controls: no control at all. Nothing in the block can be typed into.
    await expect(block.locator('input, textarea, select, [role="combobox"]')).toHaveCount(0);
    await expect(fields.nth(3).locator('[data-slot="inherited-value"]')).toContainText('Denise');
  });

  test('the right rail carries both tracks, with the client bar shut behind the gate', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const rail = page.locator('[data-slot="concept-rail"]');
    await expect(rail).toBeVisible();

    const widget = rail.locator('[data-slot="two-track-approval"]');
    await expect(widget).toHaveAttribute('data-track', 'video');
    // clientOnly is false, so BOTH bars render.
    await expect(widget.locator('[data-slot="internal-track"]')).toBeVisible();

    const clientTrack = widget.locator('[data-slot="client-track"]');
    await expect(clientTrack).toBeVisible();
    // None of the four fixtures is Approved, so the gate is shut and the widget says why.
    await expect(clientTrack).toHaveAttribute('data-open', 'false');
    await expect(clientTrack.locator('[data-slot="status-chip"]')).toHaveText('locked');
    await expect(widget.locator('[data-slot="client-track-note"]')).toHaveText(
      'Opens when internal status reaches Approved.',
    );
  });

  test('every write is disabled, with the reason on hover', async ({ page }) => {
    await page.goto(conceptsPath);

    const newConcept = page.locator('[data-slot="new-concept"]');
    await expect(newConcept).toBeDisabled();
    await expect(
      page.locator('[data-slot="disabled-write"]').filter({ has: newConcept }),
    ).toHaveAttribute('title', 'Sign in required to save changes');

    await page.goto(conceptPath(NOT_YOUR_AGE));

    const save = page.locator('[data-slot="concept-save"]');
    await expect(save).toBeDisabled();
    await expect(
      page.locator('[data-slot="disabled-write"]').filter({ has: save }),
    ).toHaveAttribute('title', 'Sign in required to save changes');
    await expect(page.locator('[data-slot="concept-demo-note"]')).toHaveText(
      'Demo mode — changes are not saved',
    );

    // The brief's own controls are inert too, so nothing looks editable that is not saveable.
    await expect(
      page.locator('[data-slot="concept-formats"] [data-slot="format-toggle"]').first(),
    ).toBeDisabled();
    await expect(page.locator('[data-slot="concept-hookExamples"]')).toHaveAttribute(
      'readonly',
      '',
    );
  });

  test('both views and the detail page fit a 390px phone with no sideways scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of [
      conceptsPath,
      `${conceptsPath}?view=board`,
      conceptPath(NOT_YOUR_AGE),
      conceptPath(BODY_CLOCK),
    ]) {
      await page.goto(path);
      await expect(page.locator('[data-slot="app-shell"]')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways at 390px`).toBeLessThanOrEqual(0);
    }
  });
});
