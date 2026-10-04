import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import {
  anglesPath,
  conceptsPath,
  personasPath,
  productsPath,
  themesPath,
  ugcPath,
} from '../src/lib/routes';

/**
 * Per-user views on the six core tables (Sprint 7, VIEWS-01), in demo mode.
 *
 * For each table: open the Gallery, go back to the Grid, hide one field through the Fields popover,
 * reload, and prove the field is still hidden — then open the same page as a SECOND user and prove
 * the field is visible there. In demo mode there is no Clerk session, so a "user" is a browser
 * profile: the view store is this profile's `localStorage`, which a second browser context does
 * not share. In live mode the same isolation is the `user_id` scope every statement in
 * `packages/db/src/user-table-views.ts` carries, pinned by its PGlite test.
 *
 * Then the Freeze control (action item 22): a prefix of the columns pinned, each at its own left
 * offset rather than all at zero, the header row pinned with them, and the whole choice saved into
 * the same per-user view the Fields popover writes. Then the Cover control (action item 16): which
 * image covers a gallery card, offered only on the Gallery and only where the table declares more
 * than the one media column it already uses.
 */
interface TableCase {
  readonly label: string;
  readonly path: string;
  /** The `data-slot` of the table, whose header cells are read. */
  readonly tableSlot: string;
  /** The column hidden by the test: present on every page, never the frozen name column. */
  readonly field: { readonly key: string; readonly header: string };
}

const TABLES: readonly TableCase[] = [
  {
    label: 'Products',
    path: productsPath,
    tableSlot: 'products-table',
    // NOT `updated`: Products now reads its columns from the resolver, and `Updated` is platform
    // metadata rather than an Airtable field, so it is off every grid
    // (docs/decisions/gratsi-display-spec-2026-10-02.md). `Collection Link` is the template's own
    // label for `collection_link`, which demo mode renders because its brand (Niagara) inherits the
    // template's columns.
    field: { key: 'collection_link', header: 'Collection Link' },
  },
  {
    label: 'Personas',
    path: personasPath,
    tableSlot: 'personas-table',
    // NOT `updated`: a grid shows only the fields its base defines, and `Updated` is platform
    // metadata rather than an Airtable field, so it was removed from every grid
    // (docs/decisions/gratsi-display-spec-2026-10-02.md). The header is the TEMPLATE's label:
    // demo mode's brand is `DEMO_BRAND_ID` (Niagara), which owns no `column_definitions` rows and
    // so inherits the template's. Gratsi's own label for this column is "Personality", which is a
    // per-brand database fact asserted in `packages/db/src/column-seed.test.ts`.
    field: { key: 'psychographic', header: 'Psychographic' },
  },
  {
    label: 'Angles',
    path: anglesPath,
    tableSlot: 'angles-table',
    // NOT `updated`: Angles reads its columns from the resolver now, and `Updated` is platform
    // metadata rather than an Airtable field, so it is off every grid
    // (docs/decisions/gratsi-display-spec-2026-10-02.md).
    field: { key: 'description', header: 'Description' },
  },
  {
    label: 'Themes',
    path: themesPath,
    tableSlot: 'themes-table',
    field: { key: 'notes', header: 'Notes' },
  },
  {
    label: 'Concepts',
    path: conceptsPath,
    tableSlot: 'concepts-table',
    field: { key: 'batch', header: 'Batch' },
  },
  {
    label: 'UGC Management',
    path: ugcPath,
    tableSlot: 'creators-table',
    field: { key: 'gender', header: 'Gender' },
  },
];

function headers(page: Page, entry: TableCase) {
  return page.locator(`[data-slot="${entry.tableSlot}"] thead th`);
}

async function switchView(page: Page, name: 'Grid' | 'Gallery' | 'List') {
  await page
    .locator('[data-slot="view-toolbar"] [data-slot="tabs-trigger"]', { hasText: name })
    .click();
}

test.describe('per-user views in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the pages need a session and real data',
  );

  for (const entry of TABLES) {
    test(`${entry.label}: gallery opens, a hidden field stays hidden for this user and visible for another`, async ({
      page,
      browser,
    }) => {
      await page.goto(entry.path);
      await expect(headers(page, entry).filter({ hasText: entry.field.header })).toHaveCount(1);

      // The Gallery is the second view option: cards, one per row, with the record's fields.
      await switchView(page, 'Gallery');
      await expect(page.locator('[data-slot="gallery-view"]')).toBeVisible();
      await expect(page.locator(`[data-slot="${entry.tableSlot}"]`)).toHaveCount(0);
      await expect(
        page.locator(`[data-slot="gallery-field"][data-field="${entry.field.key}"]`).first(),
      ).toBeVisible();

      // Back on the Grid, hide the field through the Fields popover.
      await switchView(page, 'Grid');
      await expect(headers(page, entry).filter({ hasText: entry.field.header })).toHaveCount(1);
      await page.locator('[data-slot="view-toolbar"] [data-slot="grid-fields"]').click();
      await page
        .locator(`[data-slot="grid-field-toggle"][data-field="${entry.field.key}"]`)
        .click();
      await page.keyboard.press('Escape');
      await expect(headers(page, entry).filter({ hasText: entry.field.header })).toHaveCount(0);

      // The toggle persisted into this user's active view (auto-created as "My view").
      await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');

      // A reload reads the view back: still hidden, on the Grid and on the Gallery.
      await page.reload();
      await expect(headers(page, entry).first()).toBeVisible();
      await expect(headers(page, entry).filter({ hasText: entry.field.header })).toHaveCount(0);
      await switchView(page, 'Gallery');
      await expect(page.locator('[data-slot="gallery-view"]')).toBeVisible();
      await expect(
        page.locator(`[data-slot="gallery-field"][data-field="${entry.field.key}"]`),
      ).toHaveCount(0);

      // A second user — a fresh browser context, so a different store — still sees the field.
      const other = await browser.newContext();
      const otherPage = await other.newPage();
      await otherPage.goto(entry.path);
      await expect(headers(otherPage, entry).filter({ hasText: entry.field.header })).toHaveCount(
        1,
      );
      await expect(otherPage.locator('[data-slot="views-menu"]')).toHaveText('Views');
      await other.close();
    });
  }

  test('the Freeze control pins a prefix of the columns, and the choice survives a reload', async ({
    page,
    browser,
  }) => {
    // Action item 22. Before this there was no control at all: `frozen_fields` existed end to end as
    // data and production's one real saved view had it empty, because nothing could ever write it.
    await page.goto(conceptsPath);
    const cells = page.locator('[data-slot="concepts-table"] thead th');

    // The table's own default: the name column alone is pinned, everything else scrolls.
    await expect(cells.nth(0)).toHaveCSS('position', 'sticky');
    await expect(cells.nth(1)).not.toHaveCSS('position', 'sticky');

    // The header row is pinned too — the grid is its own scroll region (item 22 asks for ROWS as
    // well as columns, and a header that scrolls away is the row freeze that was missing).
    await expect(page.locator('[data-slot="concepts-table"] thead')).toHaveCSS(
      'position',
      'sticky',
    );
    await expect(page.locator('[data-slot="grid-scroll"]')).toBeVisible();

    // Freeze up to and including the second column.
    const second = await cells.nth(1).getAttribute('data-column');
    expect(second).not.toBeNull();
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-freeze"]').click();
    await page.locator(`[data-slot="grid-freeze-option"][data-field="${second ?? ''}"]`).click();
    await page.keyboard.press('Escape');

    // Both are sticky now, and — the bug the offsets exist for — the second is NOT at left 0 on top
    // of the first: it sits exactly one column width in.
    await expect(cells.nth(0)).toHaveCSS('position', 'sticky');
    await expect(cells.nth(1)).toHaveCSS('position', 'sticky');
    const [firstBox, secondBox] = await Promise.all([
      cells.nth(0).boundingBox(),
      cells.nth(1).boundingBox(),
    ]);
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(secondBox?.x ?? 0).toBeGreaterThan(firstBox?.x ?? 0);
    const firstLeft = await cells.nth(0).evaluate((node) => getComputedStyle(node).left);
    const secondLeft = await cells.nth(1).evaluate((node) => getComputedStyle(node).left);
    expect(firstLeft).toBe('0px');
    expect(secondLeft).not.toBe('0px');

    // It persisted into this viewer's active view, and a reload reads it back.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await expect(cells.nth(1)).toHaveCSS('position', 'sticky');

    // "Table default" hands the single pinned name column back rather than unpinning everything.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-freeze"]').click();
    await page.locator('[data-slot="grid-freeze-option"][data-field="__default__"]').click();
    await page.keyboard.press('Escape');
    await expect(cells.nth(0)).toHaveCSS('position', 'sticky');
    await expect(cells.nth(1)).not.toHaveCSS('position', 'sticky');

    // Another viewer's grid is untouched: the freeze is a per-user lens, not a column definition.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(conceptsPath);
    const otherCells = otherPage.locator('[data-slot="concepts-table"] thead th');
    await expect(otherCells.nth(0)).toHaveCSS('position', 'sticky');
    await expect(otherCells.nth(1)).not.toHaveCSS('position', 'sticky');
    await other.close();
  });

  test('the Cover control picks which image covers a gallery card, and only where there is a choice', async ({
    page,
    browser,
  }) => {
    // Action item 16, "customise the card": the card LINES were already a choice (the Fields
    // popover), the cover was not — every page hard-coded it, so a creator's Video Intro was
    // declared a gallery media field in the capability registry and could never be selected.
    await page.goto(ugcPath);
    await switchView(page, 'Gallery');
    const firstCard = page.locator('[data-slot="creator-gallery-card"]').first();

    // The page default: the creator's profile picture, an <img> on the card.
    await expect(firstCard.locator('img')).toHaveCount(1);
    const cover = page.locator('[data-slot="view-toolbar"] [data-slot="gallery-cover"]');
    await expect(cover).toBeVisible();

    // Choose the Video Intro. The profile <img> goes, whatever the intro URL then loads as — the
    // fallback for a row with no value in the chosen column is unit-tested in gallery-items.test.ts.
    await cover.click();
    await page.locator('[data-slot="gallery-cover-option"][data-field="video_intro_url"]').click();
    await page.keyboard.press('Escape');
    await expect(firstCard.locator('img')).toHaveCount(0);

    // It persisted into this viewer's active view, and a reload reads it back.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await switchView(page, 'Gallery');
    await expect(
      page.locator('[data-slot="creator-gallery-card"]').first().locator('img'),
    ).toHaveCount(0);

    // "Page default" gives the hard-coded cover back rather than leaving the card blank.
    await cover.click();
    await page.locator('[data-slot="gallery-cover-option"][data-field="__default__"]').click();
    await page.keyboard.press('Escape');
    await expect(
      page.locator('[data-slot="creator-gallery-card"]').first().locator('img'),
    ).toHaveCount(1);

    // It is a per-viewer lens: another browser profile still sees the page default.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(ugcPath);
    await switchView(otherPage, 'Gallery');
    await expect(
      otherPage.locator('[data-slot="creator-gallery-card"]').first().locator('img'),
    ).toHaveCount(1);
    await other.close();
  });

  test('the Cover control is a Gallery control, and never offered where there is no media column', async ({
    page,
  }) => {
    await page.goto(ugcPath);
    // Not on the Grid: a frozen name cell is not a card cover.
    await expect(
      page.locator('[data-slot="view-toolbar"] [data-slot="gallery-cover"]'),
    ).toHaveCount(0);
    await switchView(page, 'Gallery');
    await expect(
      page.locator('[data-slot="view-toolbar"] [data-slot="gallery-cover"]'),
    ).toBeVisible();

    // Concepts declares no gallery media field, so its Gallery shows no picker at all rather than
    // an empty one advertising a setting that cannot be made.
    await page.goto(conceptsPath);
    await switchView(page, 'Gallery');
    await expect(page.locator('[data-slot="gallery-view"]')).toBeVisible();
    await expect(
      page.locator('[data-slot="view-toolbar"] [data-slot="gallery-cover"]'),
    ).toHaveCount(0);
  });

  test('Arrange fields reorders the grid columns and the gallery lines, and the order survives a reload', async ({
    page,
  }) => {
    // Action item 16, the second half of "customise the card": `fieldOrder` existed end to end —
    // UserViewConfig, applyUserView, the jsonb column — but no control could ever write it.
    await page.goto(productsPath);
    const cells = page.locator('[data-slot="products-table"] thead th');
    const second = await cells.nth(1).getAttribute('data-column');
    const third = await cells.nth(2).getAttribute('data-column');
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();

    // Fields → Arrange fields…, move the third column up one step. The dialog is ordinary focus
    // territory: every Move button a tab stop, which is the reason reorder is not nested inside
    // the Radix menu (a menu owns Tab and the arrows for itself).
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-fields"]').click();
    await page.locator('[data-slot="fields-arrange"]').click();
    await page.locator(`[data-slot="field-move-up"][data-field="${third ?? ''}"]`).click();
    await page.locator('[data-slot="fields-arrange-done"]').click();

    // The grid follows at once: the moved column renders second, the old second renders third.
    await expect(cells.nth(1)).toHaveAttribute('data-column', third ?? '');
    await expect(cells.nth(2)).toHaveAttribute('data-column', second ?? '');

    // It persisted into this viewer's active view, and a reload reads it back.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await expect(cells.nth(1)).toHaveAttribute('data-column', third ?? '');
    await expect(cells.nth(2)).toHaveAttribute('data-column', second ?? '');

    // The gallery's card lines read the SAME stored order: the moved column is the first line
    // under the card name (the name itself is never a line).
    await switchView(page, 'Gallery');
    await expect(
      page
        .locator('[data-slot="product-card"]')
        .first()
        .locator('[data-slot="gallery-field"]')
        .first(),
    ).toHaveAttribute('data-field', third ?? '');
  });

  test('the List view is one compact row per record, honours hidden fields, and survives a reload', async ({
    page,
  }) => {
    // AI-17: the List is the same rows under the same view config — the name, at most two labelled
    // values derived from the same columns the grid renders, and the Fields popover still rules
    // what shows. It persists like any other view type: into this viewer's view, read back on load.
    await page.goto(productsPath);
    await switchView(page, 'List');
    await expect(page.locator('[data-slot="list-view"]')).toBeVisible();
    await expect(page.locator('[data-slot="products-table"]')).toHaveCount(0);

    const rows = page.locator('[data-slot="product-list-row"]');
    await expect(rows.first()).toBeVisible();
    const fieldCounts = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.querySelectorAll('[data-slot="list-field"]').length),
    );
    expect(fieldCounts.length).toBeGreaterThan(0);
    for (const count of fieldCounts) expect(count).toBeLessThanOrEqual(2);

    // Hide the first labelled value through the SAME Fields popover the grid uses: the list drops
    // it and the next visible column takes its place rather than leaving a hole.
    const firstField = await rows
      .first()
      .locator('[data-slot="list-field"]')
      .first()
      .getAttribute('data-field');
    expect(firstField).not.toBeNull();
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-fields"]').click();
    await page.locator(`[data-slot="grid-field-toggle"][data-field="${firstField ?? ''}"]`).click();
    await page.keyboard.press('Escape');
    await expect(
      rows.first().locator(`[data-slot="list-field"][data-field="${firstField ?? ''}"]`),
    ).toHaveCount(0);

    // The choice persisted into this viewer's view, and a reload comes back ON the List with the
    // field still hidden.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await expect(page.locator('[data-slot="list-view"]')).toBeVisible();
    await expect(
      page
        .locator('[data-slot="product-list-row"]')
        .first()
        .locator(`[data-slot="list-field"][data-field="${firstField ?? ''}"]`),
    ).toHaveCount(0);
  });

  test('a field filter narrows the rows and survives a reload; grouping draws counted headers and clears back to flat', async ({
    page,
  }) => {
    // AI-32: conditions beyond the one search string. The filter is part of the viewer's view —
    // persisted like a hidden field — and the grouping is a grid reading with one counted header
    // per value of the chosen column.
    await page.goto(ugcPath);
    const rows = page.locator('[data-slot="creator-row"]');
    await expect(rows).toHaveCount(5);

    // Add: Gender is Female. The dialog is the same menu-to-dialog step the Views menu takes.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-filter"]').click();
    await page.locator('[data-slot="filter-add"]').click();
    await page.locator('[data-slot="filter-field"]').selectOption('gender');
    await page.locator('[data-slot="filter-op"]').selectOption('is');
    await page.locator('[data-slot="filter-value"]').fill('Female');
    await page.locator('[data-slot="filter-save"]').click();

    // The row set narrows, the control says it is live, and the count line follows.
    await expect(rows).toHaveCount(2);
    await expect(page.locator('[data-slot="grid-filter"]')).toHaveText('Filter (1)');
    await expect(page.locator('[data-slot="ugc-count"]')).toContainText('2 of');

    // It persisted into this viewer's active view, and a reload reads it back.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('[data-slot="grid-filter"]')).toHaveText('Filter (1)');

    // One click removes the one condition, and the whole roster is back.
    await page.locator('[data-slot="grid-filter"]').click();
    await page.locator('[data-slot="filter-clear"]').click();
    await page.keyboard.press('Escape');
    await expect(rows).toHaveCount(5);

    // Group by Gender: one header per value, counted, in first-appearance order — and the data
    // rows all still render underneath their headers.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page.locator('[data-slot="grid-group-option"][data-field="gender"]').click();
    await page.keyboard.press('Escape');
    const headers = page.locator('[data-slot="grid-group-header"]');
    await expect(headers).toHaveCount(3);
    await expect(
      page.locator(
        '[data-slot="grid-group-header"][data-group="Female"] [data-slot="group-count"]',
      ),
    ).toHaveText('2');
    await expect(
      page.locator(
        '[data-slot="grid-group-header"][data-group="Non-binary"] [data-slot="group-count"]',
      ),
    ).toHaveText('1');
    await expect(rows).toHaveCount(5);

    // "None" hands the flat grid back.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page.locator('[data-slot="grid-group-option"][data-field="__none__"]').click();
    await page.keyboard.press('Escape');
    await expect(headers).toHaveCount(0);
    await expect(rows).toHaveCount(5);
  });

  test('the Freeze control is a Grid control: the Gallery does not offer one', async ({ page }) => {
    await page.goto(conceptsPath);
    await expect(
      page.locator('[data-slot="view-toolbar"] [data-slot="grid-freeze"]'),
    ).toBeVisible();
    await switchView(page, 'Gallery');
    await expect(page.locator('[data-slot="view-toolbar"] [data-slot="grid-freeze"]')).toHaveCount(
      0,
    );
  });

  test('a view can be created, renamed and deleted, and it is this user’s alone', async ({
    page,
    browser,
  }) => {
    await page.goto(anglesPath);

    await page.locator('[data-slot="views-menu"]').click();
    await page.locator('[data-slot="view-new"]').click();
    await page.locator('[data-slot="view-name-input"]').fill('Night shift');
    await page.locator('[data-slot="view-name-save"]').click();
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('Night shift');

    await page.locator('[data-slot="views-menu"]').click();
    await page.locator('[data-slot="view-rename"]').click();
    await page.locator('[data-slot="view-name-input"]').fill('Day shift');
    await page.locator('[data-slot="view-name-save"]').click();
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('Day shift');

    await page.reload();
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('Day shift');

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(anglesPath);
    await expect(otherPage.locator('[data-slot="views-menu"]')).toHaveText('Views');
    await other.close();

    await page.locator('[data-slot="views-menu"]').click();
    await page.locator('[data-slot="view-delete"]').click();
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('Views');
  });
});
