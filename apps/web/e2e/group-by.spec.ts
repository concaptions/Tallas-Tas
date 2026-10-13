import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import {
  anglesPath,
  conceptsPath,
  copywritingPath,
  personasPath,
  productsPath,
  themesPath,
  ugcPath,
} from '../src/lib/routes';

/**
 * Group-by on every data table (Ticket 7; PRD §14), in demo mode.
 *
 * One test per page, the same four steps on each. The Group popover offers ONLY the columns the
 * grid can bucket: a render-only column — a chip strip, a clipped paragraph, a bare link — is a
 * grid column the grid cannot read, and offering it was the ticket's defect ("Group: Formats" above
 * a grid that stayed flat). A pick draws one counted `grid-group-header` per value with every row
 * still underneath. A reload reads the choice back from this viewer's view (demo mode: this
 * browser profile's `localStorage`; live mode: `user_table_views.group_by` under `user_id`, pinned
 * by its PGlite test). "None" hands the flat grid back.
 *
 * The counts are the demo fixtures (`packages/db/src/demo-data.ts`). The Creative Sheet is covered
 * in `creative-sheet.spec.ts`: it joined the per-user views in the same ticket, and its Kanban field
 * picker is the other flavour of the control.
 */
interface GroupCase {
  readonly label: string;
  readonly path: string;
  /** The `data-slot` of the grid, whose header cells carry the column keys. */
  readonly tableSlot: string;
  /** The `data-slot` of one data row: every row stays rendered under its group header. */
  readonly rowSlot: string;
  /** How many rows the demo brand has on this grid. */
  readonly rows: number;
  /** The column grouped by, and the header the trigger then names it with. */
  readonly groupBy: { readonly key: string; readonly label: string };
  /** How many distinct values the fixtures hold under that column: one header each. */
  readonly groups: number;
  /** One group header, by its raw `data-group` value, and the count it prints. */
  readonly group: { readonly value: string; readonly count: number };
  /**
   * A column the grid draws but cannot read (no `sortValue`, no `cellTitle`), which the popover
   * must not offer — or null where every column of this grid reads a value, in which case the
   * popover offers all of them.
   */
  readonly renderOnly: string | null;
}

const TABLES: readonly GroupCase[] = [
  {
    label: 'Products / Landing Pages',
    path: productsPath,
    tableSlot: 'products-table',
    rowSlot: 'product-row',
    rows: 3,
    // Every demo landing page is on the one host, so the Link column is a single group of three.
    groupBy: { key: 'link', label: 'Link' },
    groups: 1,
    group: { value: 'niagarasleep.example', count: 3 },
    // Products draws nothing it cannot read: even the collection host carries its URL as the title.
    renderOnly: null,
  },
  {
    label: 'Personas',
    path: personasPath,
    tableSlot: 'personas-table',
    rowSlot: 'persona-row',
    rows: 3,
    groupBy: {
      key: 'stage_of_awareness',
      label: 'Stage of Market Awareness (Breakthrough Advertising)',
    },
    groups: 3,
    // The stage column sorts by its stored key, so that key is the header's raw value.
    group: { value: 'problem_aware', count: 1 },
    // A clipped paragraph with the whole text on hover: drawn, never read.
    renderOnly: 'psychographic',
  },
  {
    label: 'Angles',
    path: anglesPath,
    tableSlot: 'angles-table',
    rowSlot: 'angle-row',
    rows: 5,
    groupBy: { key: 'status', label: 'Status' },
    groups: 3,
    group: { value: 'Approved', count: 2 },
    // The formats chip strip: the column the defect was first seen on.
    renderOnly: 'formats',
  },
  {
    label: 'Themes',
    path: themesPath,
    tableSlot: 'themes-table',
    rowSlot: 'theme-row',
    rows: 5,
    // The Active tab: two Frameworks, two Production Styles, one Seasonal (the other is archived).
    groupBy: { key: 'category', label: 'Category' },
    groups: 3,
    group: { value: 'Framework', count: 2 },
    renderOnly: 'notes',
  },
  {
    label: 'Concepts',
    path: conceptsPath,
    tableSlot: 'concepts-table',
    rowSlot: 'concept-row',
    rows: 4,
    groupBy: { key: 'category', label: 'Category' },
    groups: 2,
    group: { value: 'New', count: 2 },
    renderOnly: 'hook_examples',
  },
  {
    label: 'Copywriting',
    path: copywritingPath,
    tableSlot: 'copy-table',
    rowSlot: 'copy-row',
    rows: 4,
    groupBy: { key: 'cta', label: 'CTA' },
    groups: 3,
    group: { value: 'Shop Now', count: 2 },
    // The primary copy is clipped but carries its whole text in the cell title, so it reads too.
    renderOnly: null,
  },
  {
    label: 'UGC Management',
    path: ugcPath,
    tableSlot: 'creators-table',
    rowSlot: 'creator-row',
    rows: 5,
    groupBy: { key: 'internal_creator_status', label: "Internal Creator's Status" },
    groups: 3,
    group: { value: 'Approved', count: 3 },
    renderOnly: 'ethnicity',
  },
];

/**
 * The shell stamps `data-hydrated` from its first client effect (`src/lib/hydration-replay.ts`).
 * A click that lands before React has attached its handlers is dropped, so every test that drives
 * a control waits for the stamp first. Nothing else is relaxed.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/** The column keys this grid draws, read off its header cells; a select column carries none. */
async function gridColumns(page: Page, entry: GroupCase): Promise<string[]> {
  const cells = page.locator(`[data-slot="${entry.tableSlot}"] thead th[data-column]`);
  await expect(cells.first()).toBeVisible();
  const keys = await cells.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-column')),
  );
  return keys.filter((key): key is string => key !== null && !key.startsWith('__'));
}

/** The column keys the open Group popover offers, in its order, the "None" row left out. */
async function offeredColumns(page: Page): Promise<string[]> {
  const options = page.locator('[data-slot="grid-group-option"]');
  // The flat reading heads the list on every grid.
  await expect(options.first()).toHaveAttribute('data-field', '__none__');
  const keys = await options.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-field')),
  );
  return keys.filter((key): key is string => key !== null && key !== '__none__');
}

test.describe('group-by on every data table in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the pages need a session and real data',
  );

  for (const entry of TABLES) {
    test.describe(entry.label, () => {
      // `next dev` compiles the route on its first request; warm it once so the test never pays.
      test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        await page.goto(entry.path, { waitUntil: 'networkidle' });
        await page.close();
      });

      test('offers only groupable columns, draws counted headers, keeps them over a reload, and None flattens', async ({
        page,
      }) => {
        await page.goto(entry.path);
        await hydrated(page);
        const columns = await gridColumns(page, entry);
        const trigger = page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]');
        const headers = page.locator('[data-slot="grid-group-header"]');
        const rows = page.locator(`[data-slot="${entry.rowSlot}"]`);
        await expect(rows).toHaveCount(entry.rows);
        await expect(trigger).toHaveText('Group');

        // The option list is the grid's own columns, minus the ones the grid cannot read.
        await trigger.click();
        const offered = await offeredColumns(page);
        for (const key of offered) expect(columns).toContain(key);
        expect(offered).toContain(entry.groupBy.key);
        if (entry.renderOnly === null) {
          expect(offered).toEqual(columns);
        } else {
          expect(columns).toContain(entry.renderOnly);
          expect(offered).not.toContain(entry.renderOnly);
        }

        // One counted header per value, in first-appearance order, every row still underneath.
        await page
          .locator(`[data-slot="grid-group-option"][data-field="${entry.groupBy.key}"]`)
          .click();
        await page.keyboard.press('Escape');
        await expect(trigger).toHaveText(`Group: ${entry.groupBy.label}`);
        await expect(headers).toHaveCount(entry.groups);
        await expect(
          page.locator(
            `[data-slot="grid-group-header"][data-group="${entry.group.value}"] [data-slot="group-count"]`,
          ),
        ).toHaveText(String(entry.group.count));
        await expect(rows).toHaveCount(entry.rows);

        // It persisted into this viewer's active view (auto-created as "My view"), and a reload
        // reads it back: still grouped, the trigger still naming the column.
        await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
        await page.reload();
        await hydrated(page);
        await expect(headers).toHaveCount(entry.groups);
        await expect(trigger).toHaveText(`Group: ${entry.groupBy.label}`);
        await expect(rows).toHaveCount(entry.rows);

        // "None" hands the flat grid back, nothing lost.
        await trigger.click();
        await page.locator('[data-slot="grid-group-option"][data-field="__none__"]').click();
        await page.keyboard.press('Escape');
        await expect(headers).toHaveCount(0);
        await expect(rows).toHaveCount(entry.rows);
        await expect(trigger).toHaveText('Group');
      });
    });
  }
});
