import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { creativeSheetPath } from '../src/lib/routes';

/**
 * The Creative Sheet route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures, and
 * the page is fully usable read-only: five rows in the grid, a side panel that is not a modal with
 * a labelled control for every stored Airtable field, the open row in the URL, and a Kanban board
 * grouped by either status.
 */

/** Every stored field of Airtable's Creative Sheet, by the panel's `data-slot`. */
const STORED_FIELDS = [
  'briefId',
  'internalStatus',
  'status',
  'winning',
  'qaVideoEditor',
  'qaDesigner',
  'qaStrategist',
  'used',
  'deniedRevisionsNeeded',
  'spellCheckRequested',
  'clientComments',
  'qaChecklistDoc',
  'spellingFeedback',
] as const;

test.describe('creative sheet in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/creative-sheet needs a session and real data',
  );

  test('lists the five fixture rows in the seven-column grid, named by the formula', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Sheet');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText('5 rows');

    await expect(page.locator('[data-slot="creative-sheet-table"] thead th')).toHaveText([
      'Name',
      'Brief',
      'Internal Status',
      'Status',
      'Winning',
      'Used',
      'QA',
    ]);

    // The name is the month plus the brief's name, generated and rendered in the mono face.
    const first = page.locator('[data-slot="creative-sheet-row"]').first();
    await expect(first.locator('td').first()).toContainText(/^October-/);
    await expect(first.locator('td').first().locator('.font-mono')).toHaveCount(1);

    // A row with no creative linked is named by its month alone and dashes its Brief cell.
    const unlinked = page.locator(
      '[data-creative-sheet-id="c5c5c5c5-c5c5-4c5c-8c5c-000000000002"]',
    );
    await expect(unlinked.locator('td').first()).toHaveText('October');
    await expect(unlinked.locator('td').nth(1)).toHaveText('—');

    // Statuses are the shared chip, never bare text, and QA is three ticks per row.
    await expect(first.locator('[data-slot="status-chip"]').first()).toBeVisible();
    await expect(first.locator('[data-slot="sheet-qa"] [data-slot="sheet-tick"]')).toHaveCount(3);
  });

  test('a row opens the panel with every stored field, the URL carries it and Escape closes it', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    const firstRow = page.locator('[data-slot="creative-sheet-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creative-sheet-panel-title"]')).toHaveText(name);

    // Every stored Airtable field is a labelled control in the panel.
    for (const field of STORED_FIELDS) {
      const control = panel.locator(`[data-slot="creative-sheet-field-${field}"]`);
      await expect(control, field).toBeVisible();
      await expect(control.locator('label'), field).toBeVisible();
      await expect(control.locator(`#creative-sheet-field-${field}`), field).toBeVisible();
    }

    // The brief's lookups are shown read-only beneath the picker.
    await expect(panel.locator('[data-slot="creative-sheet-brief-lookups"]')).toBeVisible();

    // Open state is in the URL, so a refresh reopens it and the link is shareable.
    await expect(page).toHaveURL(/\?creative-sheet=/);
    await page.reload();
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toBeVisible();

    // Not a modal: the grid is still there beside the panel.
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(5);

    // After the reload the client bundle can still be hydrating when a single Escape lands (the

    // tracked panel Escape-close race; products/personas specs keep the strict form as sentinels).

    // Re-press until the close takes.

    await expect(async () => {
      await page.keyboard.press('Escape');

      await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0, {
        timeout: 1_000,
      });
    }).toPass({ timeout: 45_000 });
    await expect(page).not.toHaveURL(/\?creative-sheet=/);
  });

  test('the panel is read-only and refuses to save', async ({ page }) => {
    await page.goto(`${creativeSheetPath}?creative-sheet=c5c5c5c5-c5c5-4c5c-8c5c-000000000004`);

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel.locator('[data-slot="creative-sheet-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="creative-sheet-save"]')).toBeDisabled();
    await expect(panel.locator('#creative-sheet-field-clientComments')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('#creative-sheet-field-qaVideoEditor')).toBeDisabled();
    // The daylight row carries the AI's spelling feedback, shown but never editable.
    await expect(panel.locator('#creative-sheet-field-spellingFeedback')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('#creative-sheet-field-spellingFeedback')).toHaveValue(
      /ninety to one/,
    );
  });

  test('the Kanban board groups every row by internal status, then by status', async ({ page }) => {
    await page.goto(creativeSheetPath);

    await page.getByRole('tab', { name: 'Kanban' }).click();
    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(5);

    await page.locator('[data-slot="creative-sheet-group-by"]').selectOption('status');
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(5);
    // The unlinked row has no client status yet, and still sits on the board under Not set.
    await expect(board).toContainText('Not set');
  });

  test('search reads the name, the brief and the status labels', async ({ page }) => {
    await page.goto(creativeSheetPath);

    await page.locator('[data-slot="creative-sheet-search"]').fill('september');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText('3 of 5 rows');

    await page.locator('[data-slot="creative-sheet-search"]').fill('launched');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(1);

    await page.locator('[data-slot="creative-sheet-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(0);
    await page.locator('[data-slot="creative-sheet-empty"] [data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(5);
  });
});
