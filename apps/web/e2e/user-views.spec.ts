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
    field: { key: 'updated', header: 'Updated' },
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
    field: { key: 'updated', header: 'Updated' },
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

async function switchView(page: Page, name: 'Grid' | 'Gallery') {
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
