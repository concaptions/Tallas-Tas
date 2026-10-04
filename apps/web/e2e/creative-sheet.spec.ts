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

  test('lists the five fixture rows with the resolved columns, named by the formula', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Sheet');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(5);
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText('5 rows');

    /*
     * The resolver's labels, in the template's order. Demo mode's brand is Niagara, which owns no
     * rows, so it inherits the template: the parent base's own field names first — `Name + Angle +
     * Offer` is field 1, a FORMULA, so the column is VIRTUAL and nothing stores it — then the ten
     * fields only GRATSI's base defines, which are the platform's and sort after the parent's
     * 17-field range.
     *
     * THE THREE QA CHECKS ARE THREE COLUMNS NOW, not one `QA` header. Airtable has three separate
     * fields and the rule is to mirror Airtable; the single header also left the resolver returning
     * three columns where the page drew one cell, so an admin hiding "QA" would have been hiding
     * something other than what they saw. Gratsi's own set differs in one label only — it words the
     * primary field `Name` — and that is asserted against PGlite in column-seed.test.ts.
     */
    await expect(page.locator('[data-slot="creative-sheet-table"] thead th')).toHaveText([
      'Name + Angle + Offer',
      'Creative Name',
      'Status',
      "Client's Comments",
      // Template field 17, added by the Gratsi column match (2026-10-04): the one system
      // timestamp the parent base genuinely has, `updated_at` under Airtable's own label. The
      // thirteen lookups are NOT here — the template's copies are dead and seed nothing
      // (docs/decisions/overnight-dead-lookups.md); Gratsi's live 29-field order is asserted
      // against PGlite in creative-sheet-source.test.ts.
      'Last Modified',
      'Internal Status',
      'QA Checklist Doc',
      'Video Editor QA',
      'Graphic Designer QA',
      'Creative Strategist QA',
      'Used',
      'Denied/revisions needed',
      'Winning',
      'Click for AI Spell Checker Again',
      'Spelling Feedback',
    ]);

    /*
     * The name is the month plus the brief's name — computed on read by `creativeSheetName`, with no
     * `name` column behind it, and rendered in the mono face because generated output always is.
     * Cells by COLUMN KEY, not position: the order is configuration now.
     */
    const first = page.locator('[data-slot="creative-sheet-row"]').first();
    await expect(first.locator('td[data-column="name"]')).toContainText(/^October-/);
    await expect(first.locator('td[data-column="name"] .font-mono')).toHaveCount(1);

    // A row with no creative linked is named by its month alone and dashes its Brief cell.
    const unlinked = page.locator(
      '[data-creative-sheet-id="c5c5c5c5-c5c5-4c5c-8c5c-000000000002"]',
    );
    // With no brief there is nothing to concatenate, and Airtable's `&` leaves the separator — the
    // faithful reading, which is why `creativeSheetItemName` and its tidier "October" are gone.
    await expect(unlinked.locator('td[data-column="name"]')).toHaveText('October-');
    await expect(unlinked.locator('td[data-column="brief_id"]')).toHaveText('—');

    // Statuses are the shared chip, never bare text.
    await expect(first.locator('[data-slot="status-chip"]').first()).toBeVisible();
    // The three QA checks are three columns, each with its own tick.
    for (const column of ['qa_video_editor', 'qa_designer', 'qa_strategist']) {
      await expect(
        first.locator(`td[data-column="${column}"] [data-slot="sheet-tick"]`),
        `${column} should draw its own tick`,
      ).toHaveCount(1);
    }
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
