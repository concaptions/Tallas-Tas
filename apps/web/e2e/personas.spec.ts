import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { personasPath } from '../src/lib/routes';

/**
 * The shell stamps `data-hydrated` from its first client effect (`src/lib/hydration-replay.ts`).
 * A click or a right-click that lands before React has attached its handlers is dropped, so the
 * multi-select test waits for the stamp first — the same guard the Creative Sheet spec uses.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/**
 * The Personas route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: three rows, a side panel that is not a modal, and the open persona in
 * the URL.
 *
 * WHICH COLUMNS APPEAR IS NOW CONFIGURATION, resolved per brand from `column_definitions`. Demo mode
 * has no database, so `resolveColumns` cannot run and `loadPersonaColumns()` serves the static
 * fallback instead: the PARENT TEMPLATE'S MASTER SET, read out of `COLUMN_SEED` in `@tas/db`,
 * because the demo fixtures are Niagara Sleep Solutions — a child brand with no departures of its
 * own, which is exactly what the resolver would return for it. So this spec asserts the PARENT's
 * fifteen field names, and asserts that Gratsi's relabels (which belong to one other brand's rows)
 * appear nowhere: a regression that hard-codes any brand's labels back into the page fails here.
 */
test.describe('personas in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/personas needs a session and real data',
  );

  test('lists the three fixture personas', async ({ page }) => {
    await page.goto(personasPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Personas');
    await expect(page.locator('[data-slot="persona-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="persona-count"]')).toContainText('3 personas');
    // The stage of awareness renders as the shared status chip, never a bare string.
    await expect(
      page.locator('[data-slot="personas-table"] [data-slot="status-chip"]'),
    ).toHaveCount(3);

    // The parent template's fifteen Personas fields, in the Airtable field order `display_order`
    // seeds from. Product and Updated are absent because the parent base has no field for them, so
    // the seed writes no row and the resolver never emits one. `Passion` is absent because it is
    // Gratsi's own child-added column, not the parent's.
    await expect(page.locator('[data-slot="personas-table"] thead th')).toHaveText([
      // Ticket 8: the leading header cell is the select-all checkbox the shared grid prepends.
      '',
      'Persona Name',
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires (Cashvertising)',
      'Emotional Triggers (Cashvertising)',
      'Pain Points (Cashvertising)',
      'Success Factors (Buyer Personas)',
      'Perceived Barriers (Buyer Personas)',
      'Stage of Market Awareness (Breakthrough Advertising)',
      'Buying Triggers (Breakthrough Advertising)',
      'Problem/Challenge (StoryBrand)',
      'Success/Transformation (StoryBrand)',
      'Trigger Words (Mindstates)',
      'Angles',
    ]);

    // Every resolved column was drawn: nothing fell through to the missing-renderer notice.
    await expect(page.locator('[data-slot="persona-missing-columns"]')).toHaveCount(0);

    // And the fallback is NOT flagged here. `loadPersonaColumns` serves the same parent master set
    // in two cases and tells them apart: demo mode, where it is the designed answer (this page),
    // and a live brand that resolved nothing, where it is a misconfiguration and the page says so
    // through `persona-unconfigured-columns`. Demo mode must never show that notice.
    await expect(page.locator('[data-slot="persona-unconfigured-columns"]')).toHaveCount(0);
  });

  test('a row opens the panel, Escape closes it, and the URL carries the persona', async ({
    page,
  }) => {
    await page.goto(personasPath);
    // The row's onClick is attached by React, so the click has to land after hydration or it is
    // dropped and the sheet never opens; the shared helper waits on the hydration-replay stamp.
    await hydrated(page);

    const firstRow = page.locator('[data-slot="persona-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    // Ticket 9: the panel rides the shared `RecordSheet`, with the counter and the two
    // prev/next buttons in its header. The counter pads to the total's width, so three rows
    // read `1 / 3` not `01 / 3`. The `persona-panel` body wrapper lives inside the sheet's
    // scrollable body; the `persona-panel-title` is a sibling in the sheet header, so it is
    // addressed through the sheet locator rather than the panel-body locator.
    const sheet = page.locator('[data-slot="record-sheet"]');
    await expect(sheet).toBeVisible();
    const panel = page.locator('[data-slot="persona-panel"]');
    await expect(panel).toBeVisible();
    await expect(sheet.locator('[data-slot="persona-panel-title"]')).toHaveText(name);
    await expect(sheet.locator('[data-slot="record-sheet-counter"]')).toHaveText('1 / 3');
    await expect(sheet.locator('[data-slot="record-sheet-prev"]')).toBeDisabled();
    await expect(sheet.locator('[data-slot="record-sheet-next"]')).toBeEnabled();

    // Grouping is not something `column_definitions` can express, so the panel is one section of
    // the brand's resolved fields plus one section per link column — here the two-way Angles link,
    // whose heading is the resolver's own label for the `angle_personas` junction.
    await expect(panel.locator('[data-slot="persona-group-heading"]')).toHaveText([
      'Persona',
      'Angles',
    ]);

    // Every label is the RESOLVER'S, and the panel's labels are the grid's: same rows, same strings.
    for (const label of [
      'Persona Name',
      'A Day in the Life',
      'Demographic',
      'Psychographic',
      'Core Desires (Cashvertising)',
      'Stage of Market Awareness (Breakthrough Advertising)',
      'Trigger Words (Mindstates)',
    ]) {
      await expect(
        panel.locator(`:not(option):text-is(${JSON.stringify(label)})`).first(),
      ).toBeVisible();
    }

    // Every field this brand resolves has an editor: nothing fell through to the panel's notice.
    await expect(panel.locator('[data-slot="persona-missing-fields"]')).toHaveCount(0);

    // And GRATSI'S names appear nowhere. They are not dropped — they are rows on Gratsi's own base,
    // and this brand departs from the parent nowhere — so a regression that hard-codes one brand's
    // labels back into the page, as `PERSONA_FIELD_GROUPS` did, fails here.
    for (const other of [
      'Description [Age Status Salary]',
      'Personality',
      'Drivers for this persona',
      'Passion',
      'Problem-Solution Awareness Level',
    ]) {
      await expect(page.locator(`:not(option):text-is(${JSON.stringify(other)})`)).toHaveCount(0);
    }

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?persona=/);
    await page.reload();
    await expect(page.locator('[data-slot="persona-panel"]')).toBeVisible();

    // Not a modal: the table is still there beside the panel.
    await expect(page.locator('[data-slot="persona-row"]')).toHaveCount(3);

    // After a reload the panel is visible before React has hydrated and attached its window
    // listener, so a single Escape can land on nothing. Retry until the handler is live — the same
    // pattern the Angles spec uses; the assertion itself is unchanged.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-slot="persona-panel"]')).toHaveCount(0, { timeout: 1_000 });
    }).toPass();
    await expect(page).not.toHaveURL(/\?persona=/);
  });

  test('the panel is read-only and refuses to save', async ({ page }) => {
    await page.goto(personasPath);
    // The row's onClick is attached by React, so the click has to land after hydration or the
    // sheet never opens and every panel-scoped assertion below times out looking for an empty DOM.
    await hydrated(page);
    await page.locator('[data-slot="persona-row"]').first().click();

    const panel = page.locator('[data-slot="persona-panel"]');
    await expect(panel.locator('[data-slot="persona-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="persona-save"]')).toBeDisabled();
    await expect(panel.locator('#persona-field-name')).toHaveAttribute('readonly', '');
  });

  test('the New persona button opens the panel in create mode', async ({ page }) => {
    await page.goto(personasPath);

    await page.locator('[data-slot="new-persona"]').click();

    await expect(page.locator('[data-slot="persona-panel-title"]')).toHaveText('New persona');
    await expect(page).toHaveURL(/\?persona=new$/);
  });

  test('multi-select: the checkbox column, the header state, the bar and the right-click menu', async ({
    page,
  }) => {
    await page.goto(personasPath);
    await hydrated(page);

    const rows = page.locator('[data-slot="persona-row"]');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ticking a row selects it without opening the panel.
    await rows.nth(0).locator('[data-slot="row-select"]').check();
    await expect(rows.nth(0)).toHaveAttribute('data-checked', 'true');
    await expect(page.locator('[data-slot="persona-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'some');

    const bar = page.locator('[data-slot="selection-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('role', 'toolbar');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('1');
    await expect(bar).toContainText('persona selected');
    // Demo: the one write is withheld, with the reason on its wrapper.
    await expect(bar.locator('[data-slot="selection-delete"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="disabled-write"]')).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // The header selects every row on screen, then clears them.
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'all');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('3');
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Right-click: Open, Copy link, Delete — no Duplicate, no Change status; Escape closes it.
    await rows.nth(1).click({ button: 'right' });
    const menu = page.locator('[data-slot="row-context-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[role="menuitem"]')).toHaveText(['Open', 'Copy link', 'Delete']);
    await expect(rows.nth(1)).toHaveAttribute('data-context', 'open');
    await expect(menu.locator('[data-slot="context-delete"]')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    // Copy link: the headless clipboard may refuse the write, and the fallback notice IS the URL.
    await rows.nth(1).click({ button: 'right' });
    await menu.locator('[data-slot="context-copy-link"]').click();
    await expect(page.locator('[data-slot="selection-notice"]')).toHaveText(
      /^Link copied\.$|\?persona=/,
    );

    // Open from the menu opens the same panel a row click does.
    await rows.nth(2).click({ button: 'right' });
    await menu.locator('[data-slot="context-open"]').click();
    await expect(page.locator('[data-slot="persona-panel"]')).toBeVisible();
  });
});
