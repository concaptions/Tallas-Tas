import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { conceptPath, conceptsPath } from '../src/lib/routes';

/**
 * The Concepts route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and both
 * pages are fully usable read-only: four concepts in a seven-column table, the same four as gallery
 * cards, a real detail route with a generated name that is not a field, five inherited fields that
 * are not editable, the two-track rail with the client bar shut, and every write disabled with a
 * reason.
 *
 * NO BOARD. Kanban was dropped from the data tables on 2026-09-28 (AI-18): Concepts offers Grid and
 * Gallery, and a `?view=board` link written before that lands on the grid rather than nowhere.
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

    // TASK 5: Persona and Product ride along from the linked angle, so the table carries seven
    // columns now — an intentional UX change, updated with the feature.
    await expect(page.locator('[data-slot="concepts-table"] thead th')).toHaveText([
      'Name',
      'Batch',
      'Angle',
      'Persona',
      'Product',
      'Theme',
      'Internal Status',
      'Client Status',
      'Approval Status',
      'Category',
      'Concept Style',
      'Formats to create',
      'Hook Examples',
      'Script Idea',
      'Description',
      'Pain Points',
      'USP',
      'Client Comments',
      'Collection',
      'Creators',
      'Ad Inspo',
    ]);
    // Production Status is hidden from the grid on purpose (docs/decisions.md); the name is frozen
    // and the header row is pinned too, so both stay put while the grid is scrolled (AI-22).
    await expect(page.locator('[data-slot="concepts-table"] thead th').first()).toHaveCSS(
      'position',
      'sticky',
    );
    await expect(page.locator('[data-slot="concepts-table"] thead')).toHaveCSS(
      'position',
      'sticky',
    );

    // Two lenses, not three: Kanban is gone from the data tables (AI-18).
    await expect(page.locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]')).toHaveText([
      'Grid',
      'Gallery',
    ]);

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

  test('Kanban is gone: a stale ?view=board link opens the grid, and Gallery is the other lens', async ({
    page,
  }) => {
    // AI-18: the board was dropped from the data tables. An old link still resolves — on the grid.
    await page.goto(`${conceptsPath}?view=board`);

    await expect(page.locator('[data-slot="concept-board"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-column"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="concept-row"]')).toHaveCount(4);

    // The view switch is the shared toolbar (Sprint 8): Grid / Gallery only, no pill controls.
    const options = page.locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]');
    await expect(options).toHaveText(['Grid', 'Gallery']);
    for (let index = 0; index < 2; index += 1) {
      expect(await options.nth(index).getAttribute('class')).not.toContain('rounded-full');
    }

    // Gallery writes itself into the URL; switching back writes a clean one (a default is not written).
    await options.filter({ hasText: 'Gallery' }).click();
    await expect(page).toHaveURL(/\?view=gallery$/);
    await expect(page.locator('[data-slot="gallery-view"]')).toBeVisible();
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(4);

    await options.filter({ hasText: 'Grid' }).click();
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();
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

    // The same filter runs on the gallery, so both lenses always show the same rows.
    await page.goto(`${conceptsPath}?view=gallery&q=green`);
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="concept-card"] [data-slot="gallery-name"]')).toHaveText(
      NOT_YOUR_AGE_NAME,
    );
    await expect(page.locator('[data-slot="concept-count"]')).toHaveText('1 of 4 concepts');
  });

  test('a row click lands on the concept own route, and Back restores the view', async ({
    page,
  }) => {
    // The table's row is the same click target the gallery's card is.
    await page.goto(conceptsPath);
    await page.locator(`[data-slot="concept-row"][data-concept-id="${BODY_CLOCK}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${conceptPath(BODY_CLOCK)}$`));
    await page.goBack();
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    await page.goto(`${conceptsPath}?view=gallery`);

    await page.locator(`[data-slot="concept-card"][data-gallery-id="${NOT_YOUR_AGE}"]`).click();

    // A real route segment, not a panel: the URL is the detail path and the list is gone.
    await expect(page).toHaveURL(new RegExp(`${conceptPath(NOT_YOUR_AGE)}$`));
    await expect(page.locator('[data-slot="concepts-table"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="gallery-view"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-rail"]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\?view=gallery$/);
    await expect(page.locator('[data-slot="gallery-view"]')).toBeVisible();
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

  test('every field says whether it is required, and the marker is explained once (AI-37)', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    // The meaning of the marker is stated once for the whole form, naming the required fields in
    // the order `CONCEPT_REQUIRED_FIELDS` lists them — never a bare asterisk with no legend.
    const note = page.locator('[data-slot="concept-required-note"]');
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText(
      'Batch, Angle, Theme and Category are marked Required and cannot be left empty — a concept is not saveable without them. Everything else is marked Optional.',
    );

    // Four fields carry the rule, and they are the four the domain validator enforces: Batch,
    // Angle, Theme and Category. Every other field is marked Optional rather than left silent.
    const markers = page.locator('[data-slot="field-requirement"]');
    await expect(markers.filter({ hasText: 'Required' })).toHaveCount(4);
    await expect(page.locator('[data-slot="field-requirement"][data-required="true"]')).toHaveCount(
      4,
    );
    // Twelve optional markers: the two unrestricted dropdowns (Concept Style, Approval), the six
    // prose fields, the Creator picker, both format toggle groups and Ad Inspo. That is every
    // editable control in the form, which is what makes the note's last sentence true — "Everything
    // else is marked Optional" is only honest if no control is left silent.
    await expect(markers.filter({ hasText: 'Optional' })).toHaveCount(12);
    const form = page.locator('[data-slot="concept-form"]');
    await expect(form.locator('[data-slot="field-requirement"]')).toHaveCount(16);

    // The four controls that are neither a dropdown nor a textarea each carry their own marker, so
    // none of them relies on the note alone.
    for (const slot of [
      'concept-creator-field',
      'concept-formats-to-create-field',
      'concept-formats-field',
      'concept-ad-inspo',
    ]) {
      await expect(
        page.locator(
          `[data-slot="${slot}"] [data-slot="field-requirement"][data-required="false"]`,
        ),
      ).toHaveCount(1);
    }

    // Accessible as well as visible: the dropdowns are `combobox`es, where `aria-required` is
    // valid, so a required one announces itself and an optional one says it is not.
    await expect(page.locator('[data-slot="concept-batch"]')).toHaveAttribute(
      'aria-required',
      'true',
    );
    await expect(page.locator('[data-slot="concept-themeIds"]')).toHaveAttribute(
      'aria-required',
      'true',
    );
    await expect(page.locator('[data-slot="concept-category"]')).toHaveAttribute(
      'aria-required',
      'true',
    );
    await expect(page.locator('[data-slot="concept-conceptStyle"]')).toHaveAttribute(
      'aria-required',
      'false',
    );

    // The Angle picker's trigger is a button, not a widget `aria-required` is valid on, so its
    // marker is real text ahead of the control — and its empty state names the rule too.
    const angleField = page.locator('[data-slot="concept-angle-field"]');
    await expect(
      angleField.locator('[data-slot="field-requirement"][data-required="true"]'),
    ).toHaveCount(1);
    // Every linked angle is a chip in that picker (AI-35); the fixture links exactly one, so the
    // "nothing linked" line is absent and the extra-angle note has nothing to disambiguate.
    await expect(angleField.locator('[data-slot="concept-angleIds-chip"]')).toHaveCount(1);
    await expect(angleField.locator('[data-slot="concept-angleIds-empty"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-naming-angle"]')).toHaveCount(0);
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
      `${conceptsPath}?view=gallery`,
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
