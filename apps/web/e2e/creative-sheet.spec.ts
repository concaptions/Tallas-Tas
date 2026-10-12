import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { creativeSheetPath } from '../src/lib/routes';

/**
 * The Creative Sheet route with no environment variables at all — the Vercel deployment as it
 * stands. The middleware lets the route through, the data source serves the in-repo fixtures, and
 * the page is fully usable read-only: one row per brief in the grid, a side panel that is not a modal with
 * a labelled control for every stored Airtable field, the open row in the URL, and a Kanban board
 * grouped by either status.
 */

/**
 * Every field the panel edits on the brief, by the panel's `data-slot` (the sheet is a view over
 * `creative_briefs` since the single-source cutover, 2026-10-09).
 */
const STORED_FIELDS = [
  'internalStatus',
  'status',
  'qaVideoEditor',
  'qaDesigner',
  'qaStrategist',
  'spellCheckRequested',
  'qaChecklistDoc',
  'spellingFeedback',
] as const;

/** The seven Niagara briefs are the seven sheet rows. */
const ROWS = 7;

/** `INTERNAL_STATUS` in flow order — the one internal list since the Oct 12 consolidation (0067). */
const INTERNAL_STATUS_LABELS = [
  'Draft',
  'Sent to Editor / Designer',
  'Under Editing / Designing',
  'Ad Submitted',
  'Revisions Needed',
  'Revisions Submitted',
  'Approved',
];
const DAYLIGHT_BRIEF_ID = '77777777-7777-4777-8777-000000000003';

test.describe('creative sheet in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/creative-sheet needs a session and real data',
  );

  test('lists one row per fixture brief with the resolved columns, named by the formula', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Sheet');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(ROWS);
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText(
      `${String(ROWS)} rows`,
    );

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
      'Click for AI Spell Checker Again',
      'Spelling Feedback',
    ]);

    /*
     * The name is the month plus the brief's name — computed on read by `creativeSheetName`, with no
     * `name` column behind it, and rendered in the mono face because generated output always is.
     * Cells by COLUMN KEY, not position: the order is configuration now.
     */
    const first = page.locator('[data-slot="creative-sheet-row"]').first();
    await expect(first.locator('td[data-column="name"]')).toContainText(/^[A-Z][a-z]+-/);
    await expect(first.locator('td[data-column="name"] .font-mono')).toHaveCount(1);

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
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(ROWS);

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
    await page.goto(`${creativeSheetPath}?creative-sheet=${DAYLIGHT_BRIEF_ID}`);

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel.locator('[data-slot="creative-sheet-demo-note"]')).toContainText(
      'changes are not saved',
    );
    await expect(panel.locator('[data-slot="creative-sheet-save"]')).toBeDisabled();
    await expect(panel.locator('#creative-sheet-field-qaChecklistDoc')).toHaveAttribute(
      'readonly',
      '',
    );
    await expect(panel.locator('#creative-sheet-field-qaVideoEditor')).toBeDisabled();
    // The AI's spelling feedback is shown but never editable.
    await expect(panel.locator('#creative-sheet-field-spellingFeedback')).toHaveAttribute(
      'readonly',
      '',
    );
  });

  test('the Kanban board groups every row by internal status, then by status', async ({ page }) => {
    await page.goto(creativeSheetPath);

    await page.getByRole('tab', { name: 'Kanban' }).click();
    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(ROWS);

    // The columns are the one internal list in flow order (Oct 12 client sync, Ticket 5 / 0067):
    // seven INTERNAL_STATUS labels, empty stages kept, and no per-track pair or On Hold siding.
    const columns = board.locator(':scope > div');
    for (const [index, label] of INTERNAL_STATUS_LABELS.entries()) {
      await expect(columns.nth(index), label).toContainText(label);
    }

    await page.locator('[data-slot="creative-sheet-group-by"]').selectOption('status');
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(ROWS);
  });

  test('the Editing stage grouping is the editor board: cards are briefs, Start on Incoming', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await page.getByRole('tab', { name: 'Kanban' }).click();
    await page.locator('[data-slot="creative-sheet-group-by"]').selectOption('editorStage');
    const board = page.locator('[data-slot="kanban-board"]');
    const columns = board.locator(':scope > div');
    await expect(columns).toHaveCount(3);
    await expect(columns.nth(0)).toContainText('Sent to Editor/Designer');
    await expect(columns.nth(1)).toContainText('Under Editing');
    await expect(columns.nth(2)).toContainText('Under Review');

    // A card is a BRIEF, keyed by the brief id: the Daylight brief sits under Under Review, with
    // the sheet row linked to it as its subtitle.
    const daylight = columns
      .nth(2)
      .locator('[data-card-id="77777777-7777-4777-8777-000000000003"]');
    await expect(daylight).toHaveCount(1);
    await expect(daylight).toContainText('Daylight');

    // The Incoming brief is on the board with its own sheet name as subtitle, Start withheld in demo.
    const incoming = columns
      .nth(0)
      .locator('[data-card-id="77777777-7777-4777-8777-000000000006"]');
    await expect(incoming).toHaveCount(1);
    await expect(incoming).not.toContainText('No sheet row yet');
    await expect(incoming.locator('[data-slot="brief-start"]')).toBeDisabled();
    await expect(incoming.locator('[data-slot="disabled-write"]')).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    // What is not on the board is counted: the four approved briefs; every sheet row is a brief
    // since the cutover, so none is without one.
    await expect(page.locator('[data-slot="brief-off-board"]')).toHaveText(
      '4 creatives off the board (draft or approved) · 0 sheet rows with no creative',
    );
  });

  /* ── Oct 12 client sync: Focus Mode, the Sheet sidebar, multi-select ───────────────────────── */

  test('Focus Mode is the third view: one creative, prev/next, the type-filtered QA list and the gated buttons', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await page.getByRole('tab', { name: 'Focus Mode' }).click();
    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toBeVisible();
    await expect(focus.locator('[data-slot="focus-counter"]')).toHaveText(`1 / ${String(ROWS)}`);
    await expect(focus.locator('[data-slot="focus-name"]')).toHaveClass(/font-mono/);

    // Next moves the counter and the creative in focus into the URL; Prev at the start is inert.
    await expect(focus.locator('[data-slot="focus-prev"]')).toBeDisabled();
    await focus.locator('[data-slot="focus-next"]').click();
    await expect(focus.locator('[data-slot="focus-counter"]')).toHaveText(`2 / ${String(ROWS)}`);
    await expect(page).toHaveURL(/\?creative-sheet=/);

    // The QA checklist never lists the other track's tick: two rows, the strategist always one.
    await expect(focus.locator('[data-slot="focus-qa-check"]')).toHaveCount(2);
    await expect(
      focus.locator('[data-slot="focus-qa-check"][data-check="qaStrategist"]'),
    ).toHaveCount(1);
    await expect(focus.locator('[data-slot="focus-qa-gate"]')).toContainText(
      'required checks complete',
    );

    // Demo: every review button is withheld with a reason.
    for (const slot of ['focus-request-changes', 'focus-approve', 'focus-submit']) {
      await expect(focus.locator(`[data-slot="${slot}"]`), slot).toBeDisabled();
    }
    await expect(focus.locator('[data-slot="focus-comment-post"]')).toBeDisabled();
  });

  test('?view=focus opens Focus Mode on the creative the URL names', async ({ page }) => {
    await page.goto(`${creativeSheetPath}?view=focus&creative-sheet=${DAYLIGHT_BRIEF_ID}`);

    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toHaveAttribute('data-focus-id', DAYLIGHT_BRIEF_ID);
    // In demo mode the demo hint wins; the gate's own wording is pinned by focus-mode.test.ts.
    await expect(focus.locator('[data-slot="focus-submit"]')).toBeDisabled();
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
  });

  test('the row panel is a Sheet with its sections, the brief name as its title and the N/A tick struck through', async ({
    page,
  }) => {
    await page.goto(`${creativeSheetPath}?creative-sheet=${DAYLIGHT_BRIEF_ID}`);

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('data-side', 'right');
    await expect(panel.locator('[data-slot="creative-sheet-panel-title"]')).toHaveClass(
      /font-mono/,
    );
    await expect(panel.locator('[data-slot="creative-sheet-group-heading"]')).toHaveText([
      'Identity',
      'Creative',
      'Status',
      'Content',
      'QA',
      'Assets',
      'Spelling',
      'Meta',
    ]);
    // A video brief: the designer's tick is listed, struck through, tagged N/A.
    const designer = panel.locator('[data-slot="creative-sheet-field-qaDesigner"]');
    await expect(designer).toHaveAttribute('data-applicable', 'false');
    await expect(designer).toContainText('N/A');
    await expect(panel.locator('[data-slot="creative-sheet-field-qaVideoEditor"]')).toHaveAttribute(
      'data-applicable',
      'true',
    );
    await expect(panel.locator('[data-slot="creative-sheet-open-full"]')).toHaveAttribute(
      'href',
      new RegExp(DAYLIGHT_BRIEF_ID),
    );

    // Focus Mode from the footer swaps the view and keeps the creative.
    await panel.locator('[data-slot="creative-sheet-focus-mode"]').click();
    await expect(page.locator('[data-slot="focus-mode"]')).toHaveAttribute(
      'data-focus-id',
      DAYLIGHT_BRIEF_ID,
    );
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
  });

  test('multi-select: the checkbox column, the header state, the action bar and the right-click menu', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    const rows = page.locator('[data-slot="creative-sheet-row"]');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ticking a row selects it without opening it.
    await rows.nth(0).locator('[data-slot="row-select"]').check();
    await expect(rows.nth(0)).toHaveAttribute('data-checked', 'true');
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'some');

    const bar = page.locator('[data-slot="selection-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('1');
    await expect(bar.locator('[data-slot="selection-duplicate"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="selection-delete"]')).toBeDisabled();

    // The header selects every row on screen, then clears them.
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'all');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText(String(ROWS));
    await page.locator('[data-slot="select-all"]').click();
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Right-click opens the menu with the four actions; Open in Focus Mode switches the view.
    await rows.nth(1).click({ button: 'right' });
    const menu = page.locator('[data-slot="row-context-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[role="menuitem"]')).toHaveText([
      /Duplicate/,
      'Open in Focus Mode',
      'Copy link',
      'Delete',
    ]);
    await expect(menu.locator('[data-slot="context-duplicate"]')).toBeDisabled();
    await menu.locator('[data-slot="context-focus"]').click();
    await expect(page.locator('[data-slot="focus-mode"]')).toBeVisible();
  });

  test('search reads the name, the brief and the status labels', async ({ page }) => {
    await page.goto(creativeSheetPath);

    await page.locator('[data-slot="creative-sheet-search"]').fill('daylight');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText(
      `1 of ${String(ROWS)} rows`,
    );

    await page.locator('[data-slot="creative-sheet-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(0);
    await page.locator('[data-slot="creative-sheet-empty"] [data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(ROWS);
  });
});
