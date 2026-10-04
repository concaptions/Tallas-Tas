import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { conceptPath, conceptsPath } from '../src/lib/routes';

/**
 * The Concepts route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and both
 * pages are fully usable read-only: four concepts in a seven-column table, the same four grouped on
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

  test('opens on the table, with the seven columns in order and the four fixtures', async ({
    page,
  }) => {
    await page.goto(conceptsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concepts');
    await expect(page.locator('[data-slot="concept-count"]')).toHaveText('4 concepts');

    // Table is the default: no ?view= in the URL, the table present and the board absent.
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="concept-board"]')).toHaveCount(0);

    /*
     * The headers are the RESOLVER's labels now, from `column_definitions`, not strings in
     * concepts-workspace.tsx. Demo mode's brand is `DEMO_BRAND_ID` (Niagara), which owns no rows of
     * its own, so it inherits the template: the parent base's Airtable field names in the Meta API's
     * order, then the eleven columns the PLATFORM owns — the generated name, the two approval tracks
     * and the eight the parent base reads back from its Angles link as lookups.
     *
     * The wording differs from the hand-written array in a few places because the template's own
     * field names differ: 'Angle' reads 'Angles', 'Hook Examples' reads 'Hook examples', 'Script
     * Idea' reads 'Script idea', 'Creators' reads 'Creator'. Gratsi's own set — including its
     * misspelt 'Decription', which is how its base spells it — is asserted against PGlite in
     * packages/db/src/column-seed.test.ts.
     */
    await expect(page.locator('[data-slot="concepts-table"] thead th')).toHaveText([
      'Concept Name',
      'Batch',
      'Angles',
      'Category',
      'Concept Style',
      'Approval Status',
      'Hook examples',
      'Script idea',
      'Formats to create',
      'Ad Inspo',
      'Creator',
      'Internal Status',
      'Client Status',
      'Theme',
      'Description',
      'Pain Points',
      'USP',
      'Product',
      'Persona',
      'Client Comments',
      'Collection',
    ]);
    /*
     * Production Status is GONE, not reported missing.
     *
     * This assertion used to be the other way round — it required the words "production_status" to
     * appear in the missing-columns notice — which meant the field Talal asked to take out was
     * printed on the page for every brand. The column is seeded `is_hidden` now
     * (packages/db/src/column-seed.ts), so the resolver never returns it, nothing can report it
     * missing, and no notice is drawn at all. The Postgres column and its 73 stored values are
     * untouched; this is about what the page shows.
     */
    await expect(page.locator('[data-slot="concept-missing-columns"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concepts-table"]')).not.toContainText(
      'production_status',
    );
    // The first column is frozen, so the generated name stays on screen as the grid scrolls.
    await expect(page.locator('[data-slot="concepts-table"] thead th').first()).toHaveCSS(
      'position',
      'sticky',
    );

    const rows = page.locator('[data-slot="concept-row"]');
    await expect(rows).toHaveCount(4);

    // The generated name is monospace, because it is system output and not a typed field.
    const name = page.locator(`[data-concept-id="${NOT_YOUR_AGE}"] [data-slot="concept-row-name"]`);
    await expect(name).toHaveText(NOT_YOUR_AGE_NAME);
    await expect(name).toHaveCSS('font-family', /mono/i);

    // Every status is a StatusChip with a tone from chipTone, never a locally coloured pill.
    // One Internal Status chip and one Client Status chip per row (two-track approval, PRD §9).
    const chips = page.locator('[data-slot="concept-row"] [data-slot="status-chip"]');
    await expect(chips).toHaveCount(8);
    const revisions = page
      .locator(`[data-concept-id="${BODY_CLOCK}"] [data-slot="status-chip"]`)
      .first();
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

    // The view switch is the shared toolbar (Sprint 8): Grid / Kanban / Gallery, no pill controls.
    const options = page.locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]');
    await expect(options).toHaveText(['Grid', 'Kanban', 'Gallery']);
    for (let index = 0; index < 3; index += 1) {
      expect(await options.nth(index).getAttribute('class')).not.toContain('rounded-full');
    }

    // Switching back writes a clean URL (the default is not written), then the board again.
    await options.filter({ hasText: 'Grid' }).click();
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    await options.filter({ hasText: 'Kanban' }).click();
    await expect(page).toHaveURL(/\?view=board$/);
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

  /**
   * The three parts of the name are the three the save path rejects a concept without, so what the
   * pairing POSTS has to be what the action reads. It was not: the Theme posted `themeIds` (its
   * field key) while the action read `themeId`, and every save of a filled form was refused. Demo
   * mode cannot press Save, but it renders the same controls, so the names are assertable here.
   */
  test('the pairing posts the three names the save path reads', async ({ page }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const pairing = page.locator('[data-slot="concept-pairing"]');
    for (const name of ['batch', 'angleId', 'themeId']) {
      await expect(pairing.locator(`input[name="${name}"]`)).toHaveCount(1);
    }
    // The plural is a field KEY, never a posted name: nothing on the server reads it.
    await expect(page.locator('input[name="themeIds"]')).toHaveCount(0);
    await expect(page.locator('input[name="angleIds"]')).toHaveCount(0);
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

  test('the rail lists the campaigns running on the concept, read-only, after the creatives', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const rail = page.locator('[data-slot="concept-rail"]');
    const campaigns = rail.locator('[data-slot="concept-campaigns"]');
    await expect(campaigns).toBeVisible();
    await expect(campaigns.getByRole('heading', { level: 2 })).toHaveText('Campaigns & Offers');

    // The section sits in the rail after the Creatives section, never above the approval widget.
    const sections = rail.locator(
      '[data-slot="concept-creatives"], [data-slot="concept-campaigns"]',
    );
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(1)).toHaveAttribute('data-slot', 'concept-campaigns');

    // `campaign_concepts` is read through `@tas/db` (PARITY-24): the fixture links this concept to
    // the BFCM campaign, so the list renders one generated campaign name, in font-mono, linking to
    // the Campaigns & Offers page — and no empty state.
    await expect(campaigns.locator('[data-slot="concept-campaigns-empty"]')).toHaveCount(0);
    const links = campaigns.locator('[data-slot="concept-campaign"]');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText('BFCM-20%OFF-BFCM26');
    await expect(links.first()).toHaveAttribute('href', /\/app\/campaigns-offers\?campaign=/);

    // Read-only: nothing in the section can be typed into or submitted.
    await expect(
      campaigns.locator('input, textarea, select, button, [role="combobox"]'),
    ).toHaveCount(0);
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
