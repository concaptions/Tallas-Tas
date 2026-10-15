import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { conceptPath, conceptsPath } from '../src/lib/routes';

/**
 * The shell stamps `data-hydrated` from its first client effect (`src/lib/hydration-replay.ts`).
 * A click or a right-click that lands before React has attached its handlers is dropped, so the
 * multi-select test waits for the stamp first — same helper as `creative-sheet.spec.ts`.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/**
 * The Concepts route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and both
 * pages are fully usable read-only: four concepts in a seven-column table, the same four as gallery
 * cards, a real detail route with a generated name that is not a field, five inherited fields that
 * are not editable, the two-track rail with the client bar shut, and every write disabled with a
 * reason. NO BOARD: action item 18 took Kanban off the data tables, and the old `?view=board` link
 * now lands on the grid.
 *
 * The fixtures are `demoConcepts` in `packages/db/src/demo-data.ts`: four rows, newest edit first,
 * each in a different internal status and all four strictly before Approved — so `isClientTrackOpen`
 * is false on every one of them and the client bar is locked on every detail page.
 */
const BODY_CLOCK = '66666666-6666-4666-8666-000000000001';
const NOT_YOUR_AGE = '66666666-6666-4666-8666-000000000002';

const NOT_YOUR_AGE_NAME = 'B2-It Is Not Just Your Age-Green Screen';
const BODY_CLOCK_NAME = 'B1-Your Body Clock Is Not Broken-Problem/Solution';

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
      // Ticket 8: the leading header cell is the select-all checkbox the shared grid prepends.
      '',
      'Concept Name',
      'Batch',
      'Angles',
      'Category',
      'Concept Style',
      // `Approval Status` was dropped by migration 0066 (Oct 12 client sync, Ticket 2); the
      // `client_approval_status` column surfaces at the end instead, labelled 'Client Approval'
      // (the ONE client vocabulary) — a baseline drift the baseline run turned up, picked up here
      // alongside Ticket 8's leading checkbox.
      'Hook examples',
      'Script idea',
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
      'Client Approval',
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
    await expect(revisions).toHaveText('Revisions Needed');
    await expect(revisions).toHaveAttribute('data-tone', 'warn');
  });

  test('the switcher offers Grid, Gallery and List, and an old ?view=board link lands on the grid', async ({
    page,
  }) => {
    // Action item 18: Kanban left the data tables. The board is not reachable and not offered, and
    // the link that used to open it is not a dead end — it opens the grid. AI-17 adds the List: the
    // same rows as compact single-column rows, each wearing its internal status chip.
    await page.goto(`${conceptsPath}?view=board`);

    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();
    await expect(page.locator('[data-slot="concept-board"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-column"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="concept-row"]')).toHaveCount(4);

    // The view switch is the shared toolbar (Sprint 8): no Kanban, no pill controls.
    const options = page.locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]');
    await expect(options).toHaveText(['Grid', 'Gallery', 'List']);
    for (let index = 0; index < 3; index += 1) {
      expect(await options.nth(index).getAttribute('class')).not.toContain('rounded-full');
    }

    // The List (AI-17): one compact row per record, the generated name in font-mono, up to two
    // labelled values, and the internal status as the one StatusChip primitive.
    await options.filter({ hasText: 'List' }).click();
    const listRows = page.locator('[data-slot="concept-list-row"]');
    await expect(listRows).toHaveCount(4);
    await expect(listRows.first().locator('[data-slot="list-name"]')).toHaveCSS(
      'font-family',
      /mono/i,
    );
    await expect(listRows.first().locator('[data-slot="list-field"]')).toHaveCount(2);
    await expect(
      page.locator('[data-slot="concept-list-row"] [data-slot="status-chip"]'),
    ).toHaveCount(4);

    // Switching to the gallery and back writes the view into the URL, and the default is not written.
    await options.filter({ hasText: 'Gallery' }).click();
    await expect(page).toHaveURL(/\?view=gallery$/);
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

    // The same filter runs on the gallery, so the card count is the count of what matched.
    await page.goto(`${conceptsPath}?view=gallery&q=green`);
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="concept-card"]')).toContainText(NOT_YOUR_AGE_NAME);
  });

  test('a row click opens the panel, the concept NAME is the link to the route, and Back restores the view', async ({
    page,
  }) => {
    /*
     * REQUIREMENT CHANGE (AI-17, the operator's ruling for the VIEWS-2 overnight run). This test
     * used to assert the OPPOSITE contract — "a row click lands on the concept own route, and Back
     * restores the view" — and that contract is superseded, not broken: a row click now opens the
     * side panel (the shipped brief-panel pattern), so the list, the search and the view stay put,
     * and the GENERATED NAME — in the grid row and in the panel, a real <Link> per AI-52 — is what
     * navigates to the full page. Back from the route still restores the view it was left from.
     */
    // Warm the dynamic detail route first: `next dev` compiles a route the first time it is
    // REQUESTED (playwright.config.ts documents the hazard), and this test times two client-side
    // Link navigations into it. One up-front visit keeps those assertions about the CONTRACT —
    // the link navigates — rather than about compile contention between parallel workers.
    await page.goto(conceptPath(BODY_CLOCK));
    await expect(page.locator('[data-slot="concept-rail"]')).toBeVisible();

    await page.goto(conceptsPath);
    // The row's onClick is attached by React, so the click has to land after hydration or it is
    // dropped and the sheet never opens; the shared helper waits on the hydration-replay stamp.
    // `dispatchEvent` is used over a real pointer click here for the same reason the row-switch
    // click below needs it: under parallel workers the row's React handler can be attached a tick
    // after the hydration stamp lands, and a dispatched DOM event always reaches it.
    await hydrated(page);
    await page
      .locator(`[data-slot="concept-row"][data-concept-id="${BODY_CLOCK}"]`)
      .dispatchEvent('click');

    // The panel opens with the concept's facts; the grid stays where it was and the sidebar's
    // open row rides along in `?concept=` (Ticket 9, part 3) so the link is shareable.
    const panel = page.locator('[data-slot="record-sheet"]');
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/[?&]concept=/);
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    // The sidebar's counter and both chevrons are the shared `RecordSheet` header.
    await expect(panel.locator('[data-slot="record-sheet-counter"]')).toBeVisible();
    await expect(panel.locator('[data-slot="record-sheet-prev"]')).toBeVisible();
    await expect(panel.locator('[data-slot="record-sheet-next"]')).toBeVisible();

    // The facts: the generated name (font-mono, and a real link), and the two approval tracks as
    // StatusChips (CLAUDE.md non-negotiable 4) — rendered from the SAME grid columns through
    // `ReadOnlyFields`, so a column added to the grid shows up here without a second loop.
    const panelName = panel.locator('[data-slot="concept-panel-name"]');
    await expect(panelName).toHaveText(BODY_CLOCK_NAME);
    await expect(panelName).toHaveCSS('font-family', /mono/i);
    await expect(panelName).toHaveAttribute('href', conceptPath(BODY_CLOCK));
    const chips = panel.locator('[data-slot="status-chip"]');
    await expect(chips.first()).toBeVisible();

    // A click on another row SWITCHES the panel to that concept rather than closing it. The
    // shared `RecordSheet` renders a Radix dialog, whose overlay intercepts pointer events on
    // the grid behind — a real pointer click lands on the overlay, which closes the sheet. The
    // row's onClick (which calls `select(id)` and switches the panel's item in place) is still
    // wired, so the test dispatches the DOM `click` directly on the row to verify the switch
    // handler, matching the semantic the comment above describes.
    await page
      .locator(`[data-slot="concept-row"][data-concept-id="${NOT_YOUR_AGE}"]`)
      .dispatchEvent('click');
    await expect(panelName).toHaveText(NOT_YOUR_AGE_NAME);

    // Escape closes it (RecordSheet carries the dismiss), and nothing has navigated.
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${conceptsPath}$`));

    // The NAME in the grid row is a real <Link> (AI-52): an href a reader can cmd-click, and a
    // plain click follows it to the full page. Back restores the grid.
    const rowName = page.locator(
      `[data-concept-id="${BODY_CLOCK}"] [data-slot="concept-row-name"]`,
    );
    await expect(rowName).toHaveAttribute('href', conceptPath(BODY_CLOCK));
    await rowName.click();
    await expect(page).toHaveURL(new RegExp(`${conceptPath(BODY_CLOCK)}$`));
    await expect(page.locator('[data-slot="concept-rail"]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('[data-slot="concepts-table"]')).toBeVisible();

    // The gallery card opens the same panel, and the panel's name navigates from there; Back
    // restores the gallery with its `?view=` intact. The sheet's row-id rides along as
    // `&concept=…` since Ticket 9, part 3, so the restored URL carries both params.
    await page.goto(`${conceptsPath}?view=gallery`);
    // Hydrate before the card click: the gallery is a fresh navigation, so the card's React
    // onClick needs the hydration stamp first or the first press is dropped. The dispatchEvent
    // route is the same workaround the row-switch above uses — when the parallel-worker scheduler
    // leaves the gallery still mounting its items, a real pointer click can land before Radix is
    // tracking the card's handler, while a dispatched DOM event always reaches React's listener.
    await hydrated(page);
    await page
      .locator(`[data-slot="concept-card"][data-gallery-id="${NOT_YOUR_AGE}"]`)
      .dispatchEvent('click');
    await expect(panel).toBeVisible();
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(4);
    const galleryPanelName = panel.locator('[data-slot="concept-panel-name"]');
    await expect(galleryPanelName).toHaveAttribute('href', conceptPath(NOT_YOUR_AGE));
    await galleryPanelName.click();
    await expect(page).toHaveURL(new RegExp(`${conceptPath(NOT_YOUR_AGE)}$`));
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/[?&]view=gallery(&|$)/);
    await expect(page.locator('[data-slot="concept-card"]')).toHaveCount(4);
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

  /**
   * Which fields are mandatory, said on the form instead of discovered by pressing Save.
   *
   * The marker comes from `Label`'s `required` prop in `@tas/ui`, and which fields carry it comes
   * from `REQUIRED_CONCEPT_FIELDS` in `@tas/domain/concepts` — the same set the Server Action
   * rejects a draft for. Asserting the pairing's three AND Category here is the point: Category was
   * required by the validator and had never been called required anywhere in the UI, so a page that
   * marked a hand-written list would have marked three of the four.
   */
  test('the form says which fields are required, and says it for the set the save path enforces', async ({
    page,
  }) => {
    await page.goto(conceptPath(NOT_YOUR_AGE));

    for (const field of ['batch', 'themeIds']) {
      await expect(
        page.locator(`[data-slot="concept-field-${field}"] [data-slot="label-requirement"]`),
        `${field} is required by validateConceptDraft but the form does not say so`,
      ).toHaveText('Required');
    }
    // The Angle is a LinkField, which draws its own label through the same primitive.
    await expect(
      page.locator('[data-slot="concept-angleIds"] [data-slot="label-requirement"]'),
    ).toHaveText('Required');

    // The Brief's own fields are optional, and say so rather than saying nothing.
    await expect(
      page.locator('[data-slot="concept-field-hookExamples"] [data-slot="label-requirement"]'),
    ).toHaveText('Optional');

    // The word, never an asterisk: these labels sit in panels with no legend to explain one.
    await expect(page.locator('[data-slot="label-requirement"]').first()).not.toContainText('*');
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

  test('the Oct 5 client-status badge and dropdown live in the detail view, not the grid', async ({
    page,
  }) => {
    // The detail view always carries the shared badge + dropdown — even for Gratsi where the grid
    // column is hidden (AI-33 follow-up). Here we assert that on a plain demo-mode detail page
    // (Niagara/template) the section mounts, the badge shows one of the CLIENT_STATUS keys,
    // and the dropdown reveals a reason Textarea only after switching to a note-required branch.
    await page.goto(conceptPath(NOT_YOUR_AGE));

    const section = page.locator('[data-slot="concept-client-status"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-slot="status-chip"]').first()).toBeVisible();

    const dropdown = section.locator('[data-slot="client-status-dropdown"]');
    await expect(dropdown).toHaveAttribute('data-table-key', 'concepts');

    // The reason Textarea is hidden until the chosen key is a note-required branch
    // (revisions_needed / disapproved). It is identified by the `client_status_note` name attribute.
    await expect(section.locator('textarea[name="client_status_note"]')).toHaveCount(0);
  });

  // Oct 6 Talal ruling (docs/decisions.md 2026-10-07): `disapproved` is now a CLIENT_STATUS
  // terminal. The design-system badges story renders every CLIENT_STATUS entry as its own chip,
  // so this is an end-to-end assertion that the vocabulary carries the new key and `bad` tone
  // through SSR into the DOM — a check the demo-mode dropdown cannot make since its Select is
  // disabled (Save-is-off), so the Radix portal of options never mounts.
  test('the design-system badges story renders Disapproved for CLIENT_STATUS (Oct 6 ruling)', async ({
    page,
  }) => {
    await page.goto('/design-system');
    const clientStatusBadges = page
      .locator('text=/CLIENT_STATUS — concepts and creative briefs/')
      .locator('..')
      .locator('[data-slot="status-chip"]');
    await expect(clientStatusBadges.filter({ hasText: 'Disapproved' })).toHaveCount(1);
    await expect(clientStatusBadges.filter({ hasText: 'Disapproved' })).toHaveAttribute(
      'data-tone',
      'bad',
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
    // the BFCM campaign, so the list renders one generated campaign name, in font-mono, as text —
    // the Campaigns & Offers workspace is retired (Oct 7) — and no empty state.
    await expect(campaigns.locator('[data-slot="concept-campaigns-empty"]')).toHaveCount(0);
    const links = campaigns.locator('[data-slot="concept-campaign"]');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toHaveText('BFCM-20%OFF-BFCM26');
    await expect(links.first().locator('a')).toHaveCount(0);
    await expect(links.first()).not.toHaveAttribute('href', /.+/);

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

  test('multi-select: the bar with its demo-held writes, select-all, and the right-click menu', async ({
    page,
  }) => {
    await page.goto(conceptsPath);
    await hydrated(page);

    const rows = page.locator('[data-slot="concept-row"]');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ticking a row selects it without opening the panel.
    await rows.nth(0).locator('[data-slot="row-select"]').check();
    await expect(rows.nth(0)).toHaveAttribute('data-checked', 'true');
    await expect(page.locator('[data-slot="record-sheet"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'some');

    const bar = page.locator('[data-slot="selection-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('role', 'toolbar');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('1');
    await expect(bar).toContainText('concept selected');
    // Demo mode holds both bulk writes, each explaining itself through the shared hint.
    await expect(bar.locator('[data-slot="selection-change-status"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="selection-delete"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="disabled-write"]').first()).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );
    // A concept's name is the Batch-Angle-Theme formula (PRD §7), so the bar offers no Duplicate.
    await expect(bar.locator('[data-slot="selection-duplicate"]')).toHaveCount(0);

    // The header checkbox selects every row on screen, then clears them.
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'all');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('4');
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Right-click opens the menu with the page's four items; Escape closes it.
    await rows.nth(1).click({ button: 'right' });
    const menu = page.locator('[data-slot="row-context-menu"]');
    await expect(menu).toBeVisible();
    await expect(rows.nth(1)).toHaveAttribute('data-context', 'open');
    await expect(menu.locator('[role="menuitem"]')).toHaveText([
      'Open',
      'Open full page',
      'Copy link',
      'Delete',
    ]);
    await expect(menu.locator('[data-slot="context-delete"]')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // Copy link writes nothing, so it stays live in demo: headless Chromium may refuse the
    // clipboard, in which case the notice IS the URL — the concept's REAL route (AI-52), either way.
    await rows.nth(1).click({ button: 'right' });
    await menu.locator('[data-slot="context-copy-link"]').click();
    await expect(page.locator('[data-slot="selection-notice"]')).toHaveText(
      /^(Link copied\.|http.*\/app\/concepts\/.+)$/,
    );

    // Open is the row click's own panel, via the menu.
    await rows.nth(1).click({ button: 'right' });
    await menu.locator('[data-slot="context-open"]').click();
    await expect(page.locator('[data-slot="record-sheet"]')).toBeVisible();
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

  /* ── Phase B5 commit 3: per-user group ordering wired into the Concepts grid ─────────── */

  test('right-click a group header → Pin to top keeps the concepts group at position 0 after reload', async ({
    page,
  }) => {
    await page.goto(conceptsPath);
    await hydrated(page);

    // Group the grid by Client Status (the four fixtures all read "Pending for Approval" plus
    // one empty bucket; the test picks any status column the Group popover offers).
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page
      .locator('[data-slot="grid-group-option"][data-field="internal_status"]')
      .first()
      .click();
    await page.keyboard.press('Escape');
    const headers = page.locator('[data-slot="grid-group-header"]');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(2);

    // Pin the last header to the top.
    const lastGroup = await headers.nth(headerCount - 1).getAttribute('data-group');
    expect(lastGroup).not.toBeNull();
    await headers.nth(headerCount - 1).click({ button: 'right' });
    await page.locator('[data-slot="group-context-pin"]').click();

    await expect(headers.nth(0)).toHaveAttribute('data-group', lastGroup ?? '');
    await expect(headers.nth(0).locator('[data-slot="group-pinned-indicator"]')).toBeVisible();

    // Reload: the pin reads back from the per-viewer store (localStorage in demo).
    await page.reload();
    await hydrated(page);
    await expect(headers.nth(0)).toHaveAttribute('data-group', lastGroup ?? '');
    await expect(headers.nth(0).locator('[data-slot="group-pinned-indicator"]')).toBeVisible();

    await headers.nth(0).click({ button: 'right' });
    await page.locator('[data-slot="group-context-reset"]').click();
  });

  test('drag a concepts group header to the top and the new order survives a reload', async ({
    page,
  }) => {
    await page.goto(conceptsPath);
    await hydrated(page);

    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page
      .locator('[data-slot="grid-group-option"][data-field="internal_status"]')
      .first()
      .click();
    await page.keyboard.press('Escape');
    const headers = page.locator('[data-slot="grid-group-header"]');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(2);

    const lastGroup = await headers.nth(headerCount - 1).getAttribute('data-group');
    const sourceHandle = headers
      .nth(headerCount - 1)
      .locator('[data-slot="group-drag-handle"]')
      .first();
    const targetHandle = headers.nth(0).locator('[data-slot="group-drag-handle"]').first();
    await sourceHandle.dragTo(targetHandle);

    await expect(headers.nth(0)).toHaveAttribute('data-group', lastGroup ?? '');

    await page.reload();
    await hydrated(page);
    await expect(headers.nth(0)).toHaveAttribute('data-group', lastGroup ?? '');

    await headers.nth(0).click({ button: 'right' });
    await page.locator('[data-slot="group-context-reset"]').click();
  });
});
