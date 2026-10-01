import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { creativeReportingPath } from '../src/lib/routes';

/**
 * The Creative Reporting route in demo mode (no Clerk key): the fixtures render in the grid with
 * the Difference CPA formula as a chip, a row opens the side panel with a labelled control for every
 * stored Airtable field and the brief link, the formula is read-only, and every write control is
 * disabled with a reason.
 */
const BODY_CLOCK_LAUNCHED = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000001';
const BODY_CLOCK_V2 = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000002';
const LEGACY_BUNDLE = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000004';

/** Every stored column of `tblgW4bwDSSeqihlr` the panel must carry, plus the platform's brief link. */
const STORED_FIELDS = [
  'nameAngleOffer',
  'briefId',
  'notes',
  'adDesign',
  'adLink',
  'ctr',
  'thumbStopRate',
  'results',
  'cpa',
  'targetCpa',
  'roas',
  'targetRoas',
] as const;

test.describe('creative reporting in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/creative-reporting needs a session and real data',
  );

  test('lists the four fixtures with formatted metrics and the difference formula as a chip', async ({
    page,
  }) => {
    await page.goto(creativeReportingPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Reporting');
    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="creative-report-count"]')).toContainText('4 reports');
    await expect(page.locator('[data-slot="creative-reporting-table"] thead th')).toHaveText([
      'Name + Angle + Offer',
      'Creative',
      'CTR (%)',
      'Thumb-stop rate',
      'Results',
      'CPA',
      'Target CPA',
      'Difference CPA',
      'ROAS',
      'Target ROAS',
      'Ad link',
      'Updated',
    ]);

    const launched = page.locator(`[data-creative-report-id="${BODY_CLOCK_LAUNCHED}"]`);
    // The Creative is the brief's auto-generated name, in the mono face.
    await expect(launched.locator('td').nth(1)).toHaveText(
      'TAS-TV3-B1-Your Body Clock Is Not Broken-Problem/Solution-V1',
    );
    await expect(launched.locator('td').nth(1).locator('span')).toHaveClass(/font-mono/);
    // CTR is stored as a fraction and read as a percent; CPA and ROAS carry their units.
    await expect(launched.locator('td').nth(2)).toHaveText('4.12%');
    await expect(launched.locator('td').nth(5)).toHaveText('$19.80');
    await expect(launched.locator('td').nth(6)).toHaveText('$22.00');
    await expect(launched.locator('td').nth(8)).toHaveText('3.40x');
    await expect(launched.locator('td').nth(10)).toHaveAttribute(
      'title',
      /^https:\/\/www\.facebook/,
    );
    // Under target: the formula chip is ok and carries its sign.
    const under = launched.locator('td').nth(7).locator('[data-slot="status-chip"]');
    await expect(under).toHaveText('−$2.20');
    await expect(under).toHaveAttribute('data-tone', 'ok');

    // Over target: bad.
    const over = page
      .locator(`[data-creative-report-id="${BODY_CLOCK_V2}"]`)
      .locator('td')
      .nth(7)
      .locator('[data-slot="status-chip"]');
    await expect(over).toHaveText('+$2.50');
    await expect(over).toHaveAttribute('data-tone', 'bad');

    // No CPA yet: the formula is the dash, never a blank, and so is the missing creative.
    const legacy = page.locator(`[data-creative-report-id="${LEGACY_BUNDLE}"]`);
    await expect(legacy.locator('td').nth(1)).toHaveText('—');
    await expect(legacy.locator('td').nth(7)).toHaveText('—');
  });

  test('a row opens the panel with every stored field, the URL carries it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(creativeReportingPath);

    const firstRow = page.locator('[data-slot="creative-report-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="creative-report-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creative-report-panel-title"]')).toHaveText(name);

    // Every stored Airtable field and the brief link has a labelled control in the panel.
    for (const field of STORED_FIELDS) {
      const wrapper = panel.locator(`[data-slot="creative-report-field"][data-field="${field}"]`);
      await expect(wrapper, field).toBeVisible();
      await expect(wrapper.locator('[data-slot="label"]'), field).toBeVisible();
    }
    await expect(panel.locator('#creative-report-field-nameAngleOffer')).toHaveValue(name);
    // The metrics are number inputs; CTR shows the percent, not the stored fraction.
    await expect(panel.locator('#creative-report-field-ctr')).toHaveAttribute('type', 'number');
    await expect(panel.locator('#creative-report-field-ctr')).toHaveValue('4.12');
    await expect(panel.locator('#creative-report-field-cpa')).toHaveValue('19.80');
    await expect(panel.locator('#creative-report-field-targetRoas')).toHaveAttribute('step', '0.1');
    // The brief picker shows the linked creative's name.
    await expect(panel.locator('#creative-report-field-briefId')).toContainText('TAS-TV3-B1');
    // The formula is shown read-only as the shared chip.
    const difference = panel.locator(
      '[data-slot="creative-report-difference-cpa"] [data-slot="status-chip"]',
    );
    await expect(difference).toHaveText('−$2.20');
    await expect(difference).toHaveAttribute('data-tone', 'ok');

    await expect(page).toHaveURL(/\?creativeReport=/);
    await page.reload();
    await expect(page.locator('[data-slot="creative-report-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(4);

    // After the reload the client bundle can still be hydrating when a single Escape lands (the

    // tracked panel Escape-close race; products/personas specs keep the strict form as sentinels).

    // Re-press until the close takes.

    await expect(async () => {
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-slot="creative-report-panel"]')).toHaveCount(0, {
        timeout: 1_000,
      });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?creativeReport=/);
  });

  test('the panel is read-only and refuses to save', async ({ page }) => {
    await page.goto(`${creativeReportingPath}?creativeReport=${BODY_CLOCK_LAUNCHED}`);

    const panel = page.locator('[data-slot="creative-report-panel"]');
    await expect(panel.locator('[data-slot="creative-report-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="creative-report-save"]')).toBeDisabled();
    await expect(panel.locator('#creative-report-field-nameAngleOffer')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('#creative-report-field-cpa')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#creative-report-field-briefId')).toBeDisabled();
    await expect(page.locator('[data-slot="new-creative-report"]')).toBeDisabled();
  });

  test('search filters the grid by the brief name and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(creativeReportingPath);

    // The brief name is searchable, so one §7 name finds every report filed against it.
    await page.locator('[data-slot="creative-report-search"]').fill('body clock is not broken');
    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="creative-report-count"]')).toContainText(
      '2 of 4 reports',
    );

    await page.locator('[data-slot="creative-report-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(0);
    const empty = page.locator('[data-slot="creative-reporting-empty"]');
    await expect(empty).toContainText('Nothing matches');
    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(4);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(creativeReportingPath);

    await expect(page.locator('[data-slot="creative-report-row"]')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
