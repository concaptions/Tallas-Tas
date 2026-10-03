import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { emailFlowsPath } from '../src/lib/routes';
import { closePanelWithEscape } from './support/close-panel';

/**
 * The Email Flows route with no environment variables at all — the Vercel deployment as it stands.
 * The middleware lets the route through, the data source serves the in-repo fixtures, and the page
 * is fully usable read-only: four rows in the spec's columns, a side panel that is not a modal with
 * a labelled control for every stored Airtable field, the open flow in the URL, and every write
 * control disabled while the template download still works.
 */

/** The ten stored fields of `tblubVflAQZgJSxcF`, each a `data-slot="email-flow-field-<name>"`. */
const STORED_FIELDS = [
  'flowName',
  'expectedSetupDate',
  'flowPurpose',
  'status',
  'copywriting',
  'design',
  'klaviyoLink',
  'type',
  'inspo',
  'assigneeId',
] as const;

test.describe('email flows in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/email-flows needs a session and real data',
  );

  test('lists the four fixture flows in the spec’s columns', async ({ page }) => {
    await page.goto(emailFlowsPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Email Flows');
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(4);
    await expect(page.locator('[data-slot="email-flow-count"]')).toContainText('4 flows');

    await expect(page.locator('[data-slot="email-flows-table"] thead th')).toHaveText([
      /*
       * The resolver's labels, in the template's order. The parent base has no Email Flows table, so
       * the whole set is platform-owned and takes the Gratsi base's own field names and positions.
       * `Design Due Date` and `Copywriting Due Date` are VIRTUAL — formulas chained off the expected
       * setup date, nothing stored — and render in `font-mono`. `Updated` is off every grid
       * (docs/decisions/gratsi-display-spec-2026-10-02.md).
       */
      'Flow Name',
      'Expected Setup Date',
      'Status',
      'Copywriting Due Date',
      'Design Due Date',
      'Klaviyo Link',
      'Type',
      'Assignee',
    ]);
    // Five template columns this grid has never drawn are stated, not silently omitted.
    await expect(page.locator('[data-slot="email-flow-missing-columns"]')).toContainText(
      'flow_purpose',
    );

    /*
     * Cells by COLUMN KEY, not position: the order is configuration now, and a reorder in Column
     * Admin would silently repoint a positional assertion at a different column.
     */
    const first = page.locator('[data-slot="email-flow-row"]').first();
    await expect(first.locator('td[data-column="status"] [data-slot="status-chip"]')).toHaveText(
      'Template Design',
    );
    await expect(first.locator('td[data-column="type"] [data-slot="status-chip"]')).toHaveText(
      'Email',
    );
    // The typed date, then the two VIRTUAL ones: design due five days before setup, copywriting
    // five before that. Neither is stored; both are the formula's answer for this read.
    await expect(first.locator('td[data-column="expected_setup_date"]')).toHaveText('Oct 20, 2026');
    await expect(first.locator('td[data-column="design_due_date"]')).toHaveText('Oct 15, 2026');
    await expect(first.locator('td[data-column="copywriting_due_date"]')).toHaveText(
      'Oct 10, 2026',
    );
    // The Klaviyo link shows its host, with the full URL in the cell's title.
    await expect(first.locator('td[data-column="klaviyo_link"]')).toHaveText('klaviyo.com');
    await expect(first.locator('td[data-column="klaviyo_link"]')).toHaveAttribute(
      'title',
      /^https:\/\/www\.klaviyo/,
    );

    // A flow with no setup date renders the dash in all three date cells, never an empty cell.
    const push = page.locator('[data-email-flow-id="ef10ef10-ef10-4ef1-8ef1-000000000004"]');
    await expect(push.locator('td').nth(3)).toHaveText('—');
    await expect(push.locator('td').nth(4)).toHaveText('—');
    await expect(push.locator('td').nth(5)).toHaveText('—');
  });

  test('a row opens the panel with a labelled control for every stored field, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(emailFlowsPath);

    const firstRow = page.locator('[data-slot="email-flow-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="email-flow-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="email-flow-panel-title"]')).toHaveText(name);

    // Every stored Airtable field is in the panel as a control with a label pointing at it.
    for (const field of STORED_FIELDS) {
      const id = `email-flow-field-${field}`;
      await expect(panel.locator(`[data-slot="${id}"]`), field).toBeVisible();
      await expect(panel.locator(`label[for="${id}"]`), field).toBeVisible();
    }
    // The multi-link is the chip picker, one toggle per demo campaign, the linked one pressed.
    const picker = panel.locator('[data-slot="email-flow-campaign-picker"]');
    await expect(picker).toBeVisible();
    await expect(picker.locator('[data-slot="email-flow-campaign-toggle"]')).toHaveCount(3);
    await expect(
      picker.locator('[data-slot="email-flow-campaign-toggle"][aria-pressed="true"]'),
    ).toHaveText('BFCM-20%OFF-BFCM26');
    // The two formulas are displayed, read-only, in font-mono.
    await expect(panel.locator('[data-slot="email-flow-design-due"]')).toHaveText('Oct 15, 2026');
    await expect(panel.locator('[data-slot="email-flow-copywriting-due"]')).toHaveText(
      'Oct 10, 2026',
    );

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?email-flow=/);
    await page.reload();
    await expect(page.locator('[data-slot="email-flow-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(4);

    await closePanelWithEscape(page, 'email-flow-panel');
    await expect(page).not.toHaveURL(/\?email-flow=/);
  });

  test('the panel is read-only, refuses to save, and every write control is disabled', async ({
    page,
  }) => {
    await page.goto(`${emailFlowsPath}?email-flow=ef10ef10-ef10-4ef1-8ef1-000000000002`);

    const panel = page.locator('[data-slot="email-flow-panel"]');
    await expect(panel.locator('[data-slot="email-flow-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="email-flow-save"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="email-flow-field-flowName"]')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('[data-slot="email-flow-field-status"]')).toBeDisabled();
    await expect(panel.locator('[data-slot="email-flow-campaign-toggle"]').first()).toBeDisabled();

    await expect(page.locator('[data-slot="new-email-flow"]')).toBeDisabled();
    await expect(page.locator('[data-slot="upload-csv"]')).toBeDisabled();
    await expect(page.locator('[data-slot="download-template"]')).toBeEnabled();
  });

  test('search filters the grid and the empty state offers to clear it', async ({ page }) => {
    await page.goto(emailFlowsPath);

    // The assignee name is searchable: two flows are Dorian's.
    await page.locator('[data-slot="email-flow-search"]').fill('dorian');
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(2);
    await expect(page.locator('[data-slot="email-flow-count"]')).toContainText('2 of 4 flows');

    // So is the status label.
    await page.locator('[data-slot="email-flow-search"]').fill('template design');
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(1);

    await page.locator('[data-slot="email-flow-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(0);

    const empty = page.locator('[data-slot="email-flows-empty"]');
    await expect(empty).toContainText('Nothing matches');
    await empty.locator('[data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(4);
  });

  test('the kanban view groups by status and by type, and a card opens the panel', async ({
    page,
  }) => {
    await page.goto(`${emailFlowsPath}?view=kanban`);

    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(4);
    // Grouped by status: every status is a column, the live flow sits under "Live".
    await expect(board.getByText('Live', { exact: true })).toBeVisible();

    await page.locator('[data-slot="email-flow-kanban-group"]').selectOption('type');
    await expect(board.getByText('Push Notification', { exact: true })).toBeVisible();
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(4);

    await board.locator('[data-slot="kanban-card"]').first().click();
    await expect(page.locator('[data-slot="email-flow-panel"]')).toBeVisible();
  });

  test('fits a 390px phone with no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(emailFlowsPath);

    await expect(page.locator('[data-slot="email-flow-row"]')).toHaveCount(4);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
