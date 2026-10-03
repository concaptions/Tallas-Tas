import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { creativeModulesPath } from '../src/lib/routes';
import { closePanelWithEscape } from './support/close-panel';

/**
 * The Creative Modules route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures
 * (`demoCreativeModules` in `packages/db/src/demo-creative-modules.ts`: four modules, newest edit
 * first), and the page is fully usable read-only: a grid with the two link counts, a side panel that
 * is not a modal with a labelled control for every Airtable field, the open module in the URL, and
 * every write disabled with a reason.
 */
const FIRST_MODULE_ID = '1234abcd-1234-4abc-8abc-000000000001';
const NO_BOARD_MODULE_ID = '1234abcd-1234-4abc-8abc-000000000003';
const NO_DESIGNS_MODULE_ID = '1234abcd-1234-4abc-8abc-000000000004';

test.describe('creative modules in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/creative-modules needs a session and real data',
  );

  test('lists the four fixture modules with their link counts in five columns', async ({
    page,
  }) => {
    await page.goto(creativeModulesPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Modules');
    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="creative-module-count"]')).toContainText('4 modules');

    await expect(page.locator('[data-slot="creative-modules-table"] thead th')).toHaveText([
      // The resolver's labels. `Concepts` is the parent base's own name for the angles junction —
      // the parent table whose id is called `Themes` is CREATIVE MODULES by its field set, which is
      // why ID_ANCHORED_TABLES exists. `Foreplay Link` and `Creative Designs` are platform rows: the
      // parent audit declined to assert a field for either, and both were Gratsi-only until now, so
      // an inheriting brand would otherwise have lost them. `Updated` is off every grid.
      'Module Name',
      'Concepts',
      'Foreplay Link',
      'Creative Designs',
    ]);

    // The board link shows its host, with the full URL in the cell's title.
    const first = page.locator(`[data-creative-module-id="${FIRST_MODULE_ID}"]`);
    await expect(first.locator('td[data-column="foreplay_link"]')).toHaveText('app.foreplay.co');
    await expect(first.locator('td[data-column="foreplay_link"]')).toHaveAttribute(
      'title',
      /^https:\/\/app\.foreplay/,
    );

    // The counts are the shared StatusChip, never bare text, and they pluralise.
    await expect(
      first
        .locator('td[data-column="creative_module_angles"]')
        .locator('[data-slot="status-chip"]'),
    ).toHaveText('2 angles');
    await expect(
      first
        .locator('td[data-column="creative_module_designs"]')
        .locator('[data-slot="status-chip"]'),
    ).toHaveText('3 designs');

    // A module with no board link renders the em dash, never an empty cell.
    const noBoard = page.locator(`[data-creative-module-id="${NO_BOARD_MODULE_ID}"]`);
    await expect(noBoard.locator('td[data-column="foreplay_link"]')).toHaveText('—');

    // A module with no design yet renders a zero in the mute tone, never a blank.
    const zero = page
      .locator(`[data-creative-module-id="${NO_DESIGNS_MODULE_ID}"]`)
      .locator('td')
      .nth(3)
      .locator('[data-slot="status-chip"]');
    await expect(zero).toHaveText('0 designs');
    await expect(zero).toHaveAttribute('data-tone', 'mute');
  });

  test('a row opens the panel with a labelled control for every Airtable field, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(creativeModulesPath);

    const firstRow = page.locator('[data-slot="creative-module-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="creative-module-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creative-module-panel-title"]')).toHaveText(name);

    // Module Name (singleLineText) and Foreplay Link (url): labelled inputs.
    await expect(panel.locator('#creative-module-field-moduleName')).toBeVisible();
    await expect(panel.locator('label[for="creative-module-field-moduleName"]')).toContainText(
      'Module Name',
    );
    await expect(panel.locator('#creative-module-field-foreplayLink')).toBeVisible();
    await expect(panel.locator('label[for="creative-module-field-foreplayLink"]')).toContainText(
      'Foreplay Link',
    );

    // "Concepts" (multipleRecordLinks → Angles): a chip picker labelled by its heading, one toggle
    // per angle of the brand, the module's two links pressed.
    const anglePicker = panel.locator('[data-slot="angle-picker"]');
    await expect(anglePicker).toBeVisible();
    await expect(anglePicker).toHaveAttribute('aria-labelledby', 'creative-module-angle-heading');
    await expect(panel.locator('#creative-module-angle-heading')).toContainText('Angles');
    await expect(anglePicker.locator('[data-slot="angle-toggle"]')).toHaveCount(5);
    await expect(
      anglePicker.locator('[data-slot="angle-toggle"][aria-pressed="true"]'),
    ).toHaveCount(2);

    // "(Internal) Creative Design" (multipleRecordLinks → briefs): the same picker over the briefs.
    const designPicker = panel.locator('[data-slot="design-picker"]');
    await expect(designPicker).toBeVisible();
    await expect(designPicker).toHaveAttribute('aria-labelledby', 'creative-module-design-heading');
    await expect(panel.locator('#creative-module-design-heading')).toContainText(
      'Creative Designs',
    );
    expect(
      await designPicker.locator('[data-slot="design-toggle"]').count(),
    ).toBeGreaterThanOrEqual(3);
    await expect(
      designPicker.locator('[data-slot="design-toggle"][aria-pressed="true"]'),
    ).toHaveCount(3);

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?module=/);
    await page.reload();
    await expect(page.locator('[data-slot="creative-module-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(4);

    await closePanelWithEscape(page, 'creative-module-panel');
    await expect(page).not.toHaveURL(/\?module=/);
  });

  test('the panel is read-only in demo mode and refuses to save', async ({ page }) => {
    await page.goto(`${creativeModulesPath}?module=${FIRST_MODULE_ID}`);

    const panel = page.locator('[data-slot="creative-module-panel"]');
    await expect(panel.locator('[data-slot="creative-module-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="creative-module-save"]')).toBeDisabled();
    await expect(panel.locator('#creative-module-field-moduleName')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('[data-slot="angle-toggle"]').first()).toBeDisabled();
    await expect(panel.locator('[data-slot="design-toggle"]').first()).toBeDisabled();

    // The counts beside the pickers are the shared StatusChip in the info tone.
    const angleCount = panel.locator(
      '[data-slot="creative-module-angle-count"] [data-slot="status-chip"]',
    );
    await expect(angleCount).toHaveText('2 angles');
    await expect(angleCount).toHaveAttribute('data-tone', 'info');
  });

  test('search filters the grid, lives in ?q=, and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(creativeModulesPath);

    // "thermostat" is in one module's name and in its linked angle; one row either way.
    await page.locator('[data-slot="creative-module-search"]').fill('thermostat');
    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="creative-module-count"]')).toContainText(
      '1 of 4 modules',
    );
    await expect(page).toHaveURL(/[?&]q=thermostat/);

    await page.locator('[data-slot="creative-module-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="creative-modules-empty"]');
    await expect(empty).toContainText('Nothing matches');

    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(4);
    await expect(page).not.toHaveURL(/[?&]q=/);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(creativeModulesPath);

    await expect(page.locator('[data-slot="creative-module-row"]')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
