import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { collectionsPath, copywritingPath, propagationPath } from '../src/lib/routes';

/**
 * The Copywriting route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: four rows in six columns, a side panel that is not a modal, the open
 * row in the URL, and every write control disabled with the reason on hover.
 *
 * The two record links the copy side owns (module parity, phase 2) render from the same fixtures:
 * `demoCopyTypes` tags Copy #1 with "Problem / Agitate / Solve" and nothing else, which is what the
 * picker must show pressed, and `copywriting_campaigns` has no fixture — nor a writer — so the
 * Campaigns & Offers list is the read-only empty state with its reason.
 *
 * The Collections list is the inverse of `collections.copywriting_id`: the BFCM collection fixture
 * points at Copy #1 and the summer one points at nothing, so Copy #1 lists one collection and
 * Copy #2 shows the em dash.
 */
const COPY_BODY_CLOCK_ID = '88888888-8888-4888-8888-000000000001';
const COPY_NOT_YOUR_AGE_ID = '88888888-8888-4888-8888-000000000002';
/** The unattached copy fixture — PRD §5.11's nullable `creative_brief_id` case. */
const COPY_BUNDLE_UNATTACHED_ID = '88888888-8888-4888-8888-000000000004';
/** The collection fixture whose `copywriting_id` is Copy #1. */
const BFCM_COLLECTION_ID = '11223344-1122-4334-8556-000000000001';

test.describe('copywriting in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/copywriting needs a session and real data',
  );

  test('lists the four fixture rows under the resolver-driven columns', async ({ page }) => {
    await page.goto(copywritingPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Copywriting');
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="copy-count"]')).toContainText('4 copy rows');

    /*
     * The resolver's labels, in the template's order, and FOUR MORE than the hand-written array
     * drew (GRATSI-MATCH, 2026-10-04, docs/audits/gratsi-column-diff-2026-10-04.md): demo mode is
     * an inheriting base, so this is the template base's own full ten-field Copywriting set —
     * `Copy #` and the reverse-link `Collection` column included, both freshly seeded. Gratsi's
     * thirty-field order is asserted against the resolver in `copy-source.test.ts`, where the
     * seeded database is Gratsi's.
     */
    await expect(page.locator('[data-slot="copy-table"] thead th')).toHaveText([
      'Copy #',
      'Creative',
      'Status',
      'Collection',
      'Product',
      'Primary Copy',
      'Headline',
      'News Feed / Link Description',
      'CTA',
      'USED',
    ]);

    // The title is the auto-generated Copy #, in font-mono, never an input.
    const titles = page.locator('[data-slot="copy-row-title"]');
    await expect(titles).toHaveCount(4);
    for (const title of await titles.all()) {
      await expect(title).toHaveText(/^Copy #\d+$/);
    }

    // Every status is the shared chip, never a bare string. Nine chips, counted exactly: the four
    // Status chips, the four USED Yes/No chips, and the ONE Collections chip — only the BFCM
    // fixture collection points its `copywriting_id` at a copy row (Copy #1), so the reverse-read
    // Collection column renders one chip and three em dashes.
    await expect(page.locator('[data-slot="copy-table"] [data-slot="status-chip"]')).toHaveCount(9);

    // Three rows link to a creative; the unattached one shows the muted em dash (criterion 4).
    await expect(page.locator('[data-slot="copy-row-creative"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="copy-row-unlinked"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-row-unlinked"]')).toHaveText('—');

    // The registry covers every resolved column, so the "not drawn here" notice never renders.
    await expect(page.locator('[data-slot="copy-missing-columns"]')).toHaveCount(0);
  });

  test('the sidebar links Copywriting and marks it active, with no Soon chip on it', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    // Oct 5 Talal sync (commit 105be26): the sidebar label dropped the "Meta" prefix; the h1
    // followed (2026-10-09, audit item 3). Only the route path still carries the old name.
    const link = page.getByRole('link', { name: 'Copywriting', exact: true });
    await expect(link).toHaveAttribute('href', copywritingPath);
    await expect(link).toHaveAttribute('aria-current', 'page');

    // A SoonChip somewhere else in the rail used to be the control here, proving the assertions
    // below were about Copywriting and not about a selector that had stopped matching. Propagation
    // shipped in ticket `propagation` and was the last section without a page, so no chip is
    // rendered anywhere any more and the control has to be made the other way round: the rail still
    // renders the section that shipped last, as a real link, and carries no muted placeholder at
    // all. Without that positive half the zero-counts below would also pass on a sidebar that
    // failed to render. `pendingSections()` in `nav.test.ts` fails if a section loses its href.
    await expect(page.getByRole('link', { name: 'Propagation' })).toHaveAttribute(
      'href',
      propagationPath,
    );
    await expect(page.locator('[data-slot="shell-sidebar"] [aria-disabled="true"]')).toHaveCount(0);

    // It has a page now, so nothing in the sidebar says Copywriting is still coming.
    await expect(
      page.locator('[data-slot="soon-chip"]').locator('..').filter({ hasText: 'Copywriting' }),
    ).toHaveCount(0);
    await expect(link.locator('[data-slot="soon-chip"]')).toHaveCount(0);
  });

  test('a row opens the panel with its four copy fields, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    const firstRow = page.locator('[data-slot="copy-row"]').first();
    const title = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(title).not.toBe('');

    // The title cell, not the row's centre: the Linked Creative cell sits there and carries its
    // own link to the brief, which is the one place in the row that deliberately does not open
    // the panel (see the cell's own test below).
    await firstRow.locator('[data-slot="copy-row-title"]').click();

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="copy-panel-title"]')).toHaveText(title);

    // Exactly the four PRD §5.11 copy fields, in order, each with its guidance.
    await expect(panel.locator('#copy-field-primaryCopy')).toBeVisible();
    await expect(panel.locator('#copy-field-headline')).toBeVisible();
    await expect(panel.locator('#copy-field-linkDescription')).toBeVisible();
    await expect(panel.locator('#copy-field-cta')).toBeVisible();
    await expect(panel.locator('[data-slot="copy-counter"]')).toHaveCount(3);
    await expect(panel).toContainText('~125 characters');
    await expect(panel).toContainText('~40 characters');
    await expect(panel).toContainText('~27 characters');

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?copy=/);
    await page.reload();
    await expect(page.locator('[data-slot="copy-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);

    // Escape still closes the panel (copy-panel.tsx keeps its window keydown listener), but the
    // Sprint 5 view switcher and Kanban board made this workspace's client bundle heavier, so the
    // reloaded page can still be hydrating when a single keypress lands and the listener is not
    // attached yet. Re-press until the close takes instead of pressing exactly once.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="copy-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?copy=/);
  });

  test('the Oct 5 client-status badge + dropdown mount in the copy panel', async ({ page }) => {
    await page.goto(copywritingPath);

    const firstRow = page.locator('[data-slot="copy-row"]').first();
    await firstRow.locator('[data-slot="copy-row-title"]').click();

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel).toBeVisible();

    const section = panel.locator('[data-slot="copy-client-status"]');
    await expect(section).toBeVisible();
    await expect(section.locator('[data-slot="status-chip"]').first()).toBeVisible();

    const dropdown = section.locator('[data-slot="client-status-dropdown"]');
    await expect(dropdown).toHaveAttribute('data-table-key', 'copywriting');

    // COPY_STATUS has `disapproved` AND `revisions_needed`. The Textarea is hidden until the
    // chosen key is a note-required branch; the first copy row opens on `approved`, so it is
    // not shown.
    await expect(section.locator('textarea[name="client_status_note"]')).toHaveCount(0);
  });

  test('the Linked Creative chip goes to the brief instead of opening the panel', async ({
    page,
  }) => {
    await page.goto(copywritingPath);

    const chip = page.locator('[data-slot="copy-row-creative"]').first();
    const name = ((await chip.textContent()) ?? '').trim();
    expect(name).not.toBe('');

    await chip.click();

    // The cell stops the row's own click, so this is a navigation and not a panel.
    await expect(page).toHaveURL(/\/app\/creative-design\//);
    await expect(page.locator('[data-slot="copy-panel"]')).toHaveCount(0);
  });

  test('Linked Creative is a select of brief names, never a text input', async ({ page }) => {
    await page.goto(copywritingPath);
    await page
      .locator('[data-slot="copy-row"]')
      .first()
      .locator('[data-slot="copy-row-title"]')
      .click();

    const panel = page.locator('[data-slot="copy-panel"]');
    const select = panel.locator('[data-slot="copy-creative-select"]');

    await expect(select).toHaveRole('combobox');
    // The value it carries is the brief's generated name, which is what the row's chip shows.
    const linked = (
      (await page
        .locator('[data-slot="copy-row"]')
        .first()
        .locator('[data-slot="copy-row-creative"]')
        .textContent()) ?? ''
    ).trim();
    await expect(select).toContainText(linked);

    // The submitted value is a hidden id, not something anyone types.
    await expect(panel.locator('input[name="creativeBriefId"]')).toHaveAttribute('type', 'hidden');
    await expect(panel.locator('input[type="text"][name="creativeBriefId"]')).toHaveCount(0);
  });

  test('the Linked Creative chip under the select opens the brief detail', async ({ page }) => {
    // Copy #1 is tied to the night-shift video brief; the panel renders a chip-link beside the
    // select so the reader can jump to that brief without opening the drop-down.
    await page.goto(`${copywritingPath}?copy=${COPY_BODY_CLOCK_ID}`);

    const panel = page.locator('[data-slot="copy-panel"]');
    const chip = panel.locator('[data-slot="copy-creative-chip"]');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Open ');
    await expect(chip).toHaveAttribute('href', /\/app\/creative-design\//);

    // The unattached copy row has nothing to point at (`creative_brief_id` null), so no chip
    // renders at all — only the "No creative" option in the select.
    await page.goto(`${copywritingPath}?copy=${COPY_BUNDLE_UNATTACHED_ID}`);
    await expect(page.locator('[data-slot="copy-panel"]')).toBeVisible();
    await expect(page.locator('[data-slot="copy-creative-chip"]')).toHaveCount(0);
  });

  test('the panel carries the Copy Types picker with the fixture tag pressed, and the read-only campaigns and collections lists', async ({
    page,
  }) => {
    await page.goto(`${copywritingPath}?copy=${COPY_BODY_CLOCK_ID}`);

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="copy-panel-title"]')).toHaveText('Copy #1');

    // "Copy Type" (multipleRecordLinks → copy_types, owned by the copy side): a chip picker
    // labelled by its heading, one toggle per copy type of the brand, the row's one tag pressed.
    const picker = panel.locator('[data-slot="copy-copy-types"]');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute('aria-labelledby', 'copy-copy-types-heading');
    await expect(panel.locator('#copy-copy-types-heading')).toHaveText('Copy Types');
    await expect(picker.locator('[data-slot="copy-type-toggle"]')).toHaveCount(4);
    const pressed = picker.locator('[data-slot="copy-type-toggle"][aria-pressed="true"]');
    await expect(pressed).toHaveCount(1);
    await expect(pressed).toHaveText('Problem / Agitate / Solve');

    // The selection travels as repeated hidden ids behind an empty-valued marker, never as text.
    await expect(panel.locator('[data-slot="copy-types-marker"]')).toHaveAttribute('value', '');
    await expect(panel.locator('input[name="copyTypeIds"]:not([value=""])')).toHaveCount(1);
    await expect(panel.locator('input[type="text"][name="copyTypeIds"]')).toHaveCount(0);

    // A write, so every toggle is inert in demo mode — and still shows which tag is on.
    for (const toggle of await picker.locator('[data-slot="copy-type-toggle"]').all()) {
      await expect(toggle).toBeDisabled();
    }

    // "Campaign Code" (multipleRecordLinks → campaigns_offers): read through `copywriting_campaigns`
    // (PARITY-24) — this copy carries the BFCM campaign — and still read-only, saying why there is
    // no picker instead of leaving a gap.
    const campaigns = panel.locator('[data-slot="copy-campaigns"]');
    await expect(campaigns).toBeVisible();
    await expect(campaigns).toContainText('BFCM-20%OFF-BFCM26');
    await expect(campaigns).not.toContainText('No campaign is linked to this copy yet.');
    await expect(campaigns.locator('input, textarea, select, [role="combobox"]')).toHaveCount(0);
    await expect(panel).toContainText('ships with the campaign-links writer');

    // "Collections" (the inverse of `collections.copywriting_id`): the BFCM collection points at
    // this copy, so its hand-typed name links to the Collections page with that row open — and the
    // list is read-only here because the collection owns the link.
    const collections = panel.locator('[data-slot="copy-collections"]');
    await expect(collections).toBeVisible();
    const collectionLinks = collections.locator('[data-slot="copy-collection-link"]');
    await expect(collectionLinks).toHaveText(['BFCM 2026 Collection']);
    await expect(collectionLinks).toHaveAttribute(
      'href',
      `${collectionsPath}?collection=${BFCM_COLLECTION_ID}`,
    );
    await expect(collections.locator('input, textarea, select, [role="combobox"]')).toHaveCount(0);
  });

  test('the Collections list shows the em dash on a copy no collection points at', async ({
    page,
  }) => {
    await page.goto(`${copywritingPath}?copy=${COPY_NOT_YOUR_AGE_ID}`);

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel.locator('[data-slot="copy-panel-title"]')).toHaveText('Copy #2');

    // No fixture collection's `copywriting_id` is Copy #2, so the section renders the module's
    // empty-state dash rather than a blank, and still no link.
    const collections = panel.locator('[data-slot="copy-collections"]');
    await expect(collections).toHaveText('—');
    await expect(collections.locator('[data-slot="copy-collection-link"]')).toHaveCount(0);
  });

  test('the Linked Collection single-select pre-fills from the owner-side FK (Oct 5)', async ({
    page,
  }) => {
    // Copy #1 is pointed at by the BFCM collection (`collections.copywriting_id`), so the Linked
    // Collection control pre-fills with its name AND renders the chip-link.
    await page.goto(`${copywritingPath}?copy=${COPY_BODY_CLOCK_ID}`);

    const panel = page.locator('[data-slot="copy-panel"]');
    const select = panel.locator('[data-slot="copy-collection-select"]');
    await expect(select).toHaveRole('combobox');
    await expect(select).toContainText('BFCM 2026 Collection');

    const chip = panel.locator('[data-slot="copy-collection-chip"]');
    await expect(chip).toContainText('Open BFCM 2026 Collection');
    await expect(chip).toHaveAttribute(
      'href',
      `${collectionsPath}?collection=${BFCM_COLLECTION_ID}`,
    );

    // Copy #2 has no collection pointing at it, so the control falls back to "No collection".
    await page.goto(`${copywritingPath}?copy=${COPY_NOT_YOUR_AGE_ID}`);
    await expect(page.locator('[data-slot="copy-collection-select"]')).toContainText(
      'No collection',
    );
    await expect(page.locator('[data-slot="copy-collection-chip"]')).toHaveCount(0);
  });

  test('the Linked Product single-select renders on every row (Oct 5)', async ({ page }) => {
    // No fixture copy row carries a product id, so the control always reads "No product" and the
    // chip-link does not render; the Select itself is on screen as a disabled combobox and the
    // hidden submit input mirrors the empty value.
    await page.goto(`${copywritingPath}?copy=${COPY_BODY_CLOCK_ID}`);

    const panel = page.locator('[data-slot="copy-panel"]');
    const select = panel.locator('[data-slot="copy-product-select"]');
    await expect(select).toHaveRole('combobox');
    await expect(select).toContainText('No product');
    await expect(select).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-product-chip"]')).toHaveCount(0);
    await expect(panel.locator('input[name="productId"]')).toHaveAttribute('type', 'hidden');
    await expect(panel.locator('input[name="productId"]')).toHaveValue('');
  });

  test('the panel is read-only and the save is disabled with the reason on hover', async ({
    page,
  }) => {
    await page.goto(copywritingPath);
    await page
      .locator('[data-slot="copy-row"]')
      .first()
      .locator('[data-slot="copy-row-title"]')
      .click();

    const panel = page.locator('[data-slot="copy-panel"]');
    await expect(panel.locator('[data-slot="copy-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="copy-save"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-save"]').locator('..')).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );
    await expect(panel.locator('#copy-field-headline')).toHaveAttribute('readonly', '');
    await expect(panel.locator('[data-slot="copy-creative-select"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-collection-select"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="copy-status-select"]')).toBeDisabled();

    // The New copy button is a write too, so it is disabled everywhere it appears.
    await expect(page.locator('[data-slot="new-copy"]')).toBeDisabled();
  });

  test('the search narrows the list and says so when nothing matches', async ({ page }) => {
    await page.goto(copywritingPath);

    const search = page.locator('[data-slot="copy-search"]');
    await search.fill('rota');
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="copy-count"]')).toContainText('1 of 4 copy rows');
    await expect(page).toHaveURL(/\?q=rota/);

    await search.fill('nothing matches this at all');
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="copy-empty"]')).toContainText('No copy matches');

    await page.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="copy-row"]')).toHaveCount(4);
  });

  test('fits a 390px viewport with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(copywritingPath);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
