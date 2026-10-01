import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { emailCampaignsPath } from '../src/lib/routes';

/**
 * The Email Campaigns route in demo mode (no Clerk key): the fixtures render in the grid, a row
 * opens the side panel with a labelled control for every stored Airtable field and the three record
 * links, the formula due dates are read-only, the Kanban board and the send-date Timeline mount, and
 * every write control is disabled with a reason.
 */
const BFCM_EARLY_ACCESS = 'ee11ee11-ee11-4e11-8e11-000000000001';

/** Every stored column of `tblABjVpwRpYtY7de` the panel must carry, plus its three record links. */
const STORED_FIELDS = [
  'name',
  'campaignPurpose',
  'status',
  'type',
  'channel',
  'sendDate',
  'assigneeId',
  'copywriting',
  'copyLink',
  'design',
  'klaviyoLink',
  'assets',
  'campaignOfferIds',
  'productIds',
  'collectionIds',
] as const;

test.describe('email campaigns in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/email-campaigns needs a session and real data',
  );

  test('lists the five fixtures with chips and mono dates, the due dates computed', async ({
    page,
  }) => {
    await page.goto(emailCampaignsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Email Campaigns');
    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="email-campaign-count"]')).toContainText(
      '5 email campaigns',
    );
    await expect(page.locator('[data-slot="email-campaigns-table"] thead th')).toHaveText([
      'Name',
      'Status',
      'Type',
      'Channel',
      'Send date',
      'Design due',
      'Copywriting due',
      'Assignee',
      'Klaviyo',
      'Copy link',
      'Campaigns & Offers',
      'Updated',
    ]);

    const first = page.locator(`[data-email-campaign-id="${BFCM_EARLY_ACCESS}"]`);
    // The status is the shared chip, labelled from the vocabulary, never the stored key.
    await expect(first.locator('td').nth(1).locator('[data-slot="status-chip"]')).toHaveText(
      'Template Design',
    );
    // Send date, and the two formulas: design five days before, copywriting ten.
    await expect(first.locator('td').nth(4)).toHaveText('2026-11-20');
    await expect(first.locator('td').nth(5)).toHaveText('2026-11-15');
    await expect(first.locator('td').nth(6)).toHaveText('2026-11-10');
    await expect(first.locator('td').nth(5).locator('span')).toHaveClass(/font-mono/);
    await expect(first.locator('td').nth(7)).toHaveText('Rhiannon Okafor');
    await expect(first.locator('td').nth(8)).toHaveAttribute('title', /^https:\/\/klaviyo/);
  });

  test('a row opens the panel with every stored field, the URL carries it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(emailCampaignsPath);

    const firstRow = page.locator('[data-slot="email-campaign-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="email-campaign-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="email-campaign-panel-title"]')).toHaveText(name);

    // Every stored Airtable field and record link has a labelled control in the panel.
    for (const field of STORED_FIELDS) {
      const wrapper = panel.locator(`[data-slot="email-campaign-field"][data-field="${field}"]`);
      await expect(wrapper, field).toBeVisible();
      await expect(wrapper.locator('[data-slot="label"]'), field).toBeVisible();
    }
    await expect(panel.locator('#email-campaign-field-name')).toHaveValue(name);
    // The two formulas are shown read-only, in the mono face.
    await expect(panel.locator('[data-slot="email-campaign-design-due"]')).toHaveText('2026-11-15');
    await expect(panel.locator('[data-slot="email-campaign-copywriting-due"]')).toHaveText(
      '2026-11-10',
    );
    await expect(panel.locator('[data-slot="email-campaign-design-due"]')).toHaveClass(/font-mono/);
    // The linked campaign is pressed in its picker.
    await expect(
      panel.locator('[data-slot="campaignOfferIds-toggle"][aria-pressed="true"]'),
    ).toHaveCount(1);

    await expect(page).toHaveURL(/\?emailCampaign=/);
    await page.reload();
    await expect(page.locator('[data-slot="email-campaign-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(5);

    // After the reload the client bundle can still be hydrating when a single Escape lands (the

    // tracked panel Escape-close race; products/personas specs keep the strict form as sentinels).

    // Re-press until the close takes.

    await expect(async () => {
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-slot="email-campaign-panel"]')).toHaveCount(0, {
        timeout: 1_000,
      });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?emailCampaign=/);
  });

  test('the panel is read-only and refuses to save', async ({ page }) => {
    await page.goto(`${emailCampaignsPath}?emailCampaign=${BFCM_EARLY_ACCESS}`);

    const panel = page.locator('[data-slot="email-campaign-panel"]');
    await expect(panel.locator('[data-slot="email-campaign-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="email-campaign-save"]')).toBeDisabled();
    await expect(panel.locator('#email-campaign-field-name')).toHaveAttribute('readonly', '');
    await expect(panel.locator('#email-campaign-field-copywriting')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('[data-slot="productIds-toggle"]').first()).toBeDisabled();
    await expect(page.locator('[data-slot="new-email-campaign"]')).toBeDisabled();
  });

  test('switches to the Kanban board grouped by status, then by channel, and to the Timeline', async ({
    page,
  }) => {
    await page.goto(emailCampaignsPath);

    await expect(page.locator('[data-slot="tabs-trigger"]')).toHaveText([
      'Grid',
      'Kanban',
      'Timeline',
    ]);

    await page.locator('[data-slot="tabs-trigger"]', { hasText: 'Kanban' }).click();
    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(page.locator('[data-slot="kanban-card"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="email-campaign-group-by"]')).toContainText('Status');
    await expect(page).toHaveURL(/view=kanban/);

    await page.locator('[data-slot="email-campaign-group-by"]').click();
    await page.getByRole('option', { name: 'Channel' }).click();
    await expect(page).toHaveURL(/group=channel/);
    // Three channel columns, every fixture placed, no "Not set" column needed.
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(5);
    await expect(board).toContainText('Push Notification');

    await page.locator('[data-slot="tabs-trigger"]', { hasText: 'Timeline' }).click();
    await expect(page.locator('[data-slot="email-campaigns-timeline"]')).toBeVisible();
    await expect(page.locator('[data-slot="kanban-board"]')).toHaveCount(0);
  });

  test('search filters the grid by a status label and the empty state offers to clear it', async ({
    page,
  }) => {
    await page.goto(emailCampaignsPath);

    await page.locator('[data-slot="email-campaign-search"]').fill('template design');
    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="email-campaign-count"]')).toContainText(
      '1 of 5 email campaigns',
    );

    await page.locator('[data-slot="email-campaign-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(0);
    const empty = page.locator('[data-slot="email-campaigns-empty"]');
    await expect(empty).toContainText('Nothing matches');
    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(5);
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(emailCampaignsPath);

    await expect(page.locator('[data-slot="email-campaign-row"]')).toHaveCount(5);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
