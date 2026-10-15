import { expect, test, type Page } from '@playwright/test';

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

/**
 * The sidebar's SIX sections — `SHEET_GROUPS` in `creative-sheet/fields.ts` after B2.A4 folded
 * Creative into Identity and Spelling into QA (decision 2, SHEET-02). Every control the old eight
 * carried is still inside one of these.
 */
const SHEET_GROUP_HEADINGS = ['Identity', 'Content', 'Assets', 'QA', 'Status', 'Activity'];

/**
 * `demoBriefs` (packages/db/src/demo-data.ts): the Motion Image on the "Make 9am Look Like 3am"
 * concept — Ad Submitted, video editor ticked, strategist NOT ticked, so the QA gate holds it on
 * every surface. Its brief name is the formula's output, never typed (CLAUDE.md rule 6).
 */
const MOTION_BRIEF_ID = '77777777-7777-4777-8777-000000000003';
const MOTION_BRIEF_NAME = 'TAS-AM1-B2-Make 9am Look Like 3am-POV: X vs Y-V1';
/** The Carousel on the Ninety Minutes concept: Sent to Editor / Designer, the editor board's Incoming. */
const CAROUSEL_BRIEF_ID = '77777777-7777-4777-8777-000000000006';
/** A word exactly ONE fixture name carries — the search reads names and status labels. */
const UNIQUE_SEARCH = '9am';

/**
 * The shell stamps `data-hydrated` from its first client effect (`src/lib/hydration-replay.ts`).
 * A click or a keystroke that lands before React has attached its handlers is dropped — the
 * panel-click and multi-select tests used to race it under two workers — so every test that
 * drives a control waits for the stamp first. Nothing else is relaxed.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/**
 * The board's field picker is the shared `GroupByControl` (Ticket 7) without a "None" row: a
 * popover, so a pick is the trigger, the option by its `data-field`, then Escape — a pick keeps
 * the popover open so the viewer sees the radio move.
 */
async function pickBoardField(page: Page, field: string): Promise<void> {
  await page.locator('[data-slot="creative-sheet-group-by"]').click();
  await page.locator(`[data-slot="creative-sheet-group-by-option"][data-field="${field}"]`).click();
  await page.keyboard.press('Escape');
}

test.describe('creative sheet in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: /app/creative-sheet needs a session and real data',
  );

  // `next dev` compiles the route on its first request; warm it once so no test pays for it.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(creativeSheetPath, { waitUntil: 'networkidle' });
    await page.close();
  });

  test('lists one row per fixture brief with the resolved columns, named by the formula', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creative Sheet');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(ROWS);
    // The count is a mute chip beside the title now (B3.V22); the wording is `countLabel`'s.
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText(
      `${String(ROWS)} rows`,
    );
    await expect(
      page.locator('[data-slot="creative-sheet-count"] [data-slot="status-chip"]'),
    ).toHaveAttribute('data-tone', 'mute');

    /*
     * The resolver's labels, in the template's order. Demo mode's brand is Niagara, which owns no
     * rows, so it inherits the template: the parent base's own field names first — `Name + Angle +
     * Offer` is field 1, a FORMULA, so the column is VIRTUAL and nothing stores it — then the
     * fields only GRATSI's base defines, which are the platform's and sort after the parent's
     * 17-field range.
     *
     * Column 0 is the multi-select checkbox column (Oct 12): a control with an `aria-label`, no
     * header text. `Client Approval` is the sheet's client track worded as every table words it
     * (item 5b, 2026-10-11; ruling 13 keeps it). `Dimensions` is the stored ratio set (0059).
     *
     * THE THREE QA CHECKS ARE THREE COLUMNS, not one `QA` header. Airtable has three separate
     * fields and the rule is to mirror Airtable; the single header also left the resolver returning
     * three columns where the page drew one cell, so an admin hiding "QA" would have been hiding
     * something other than what they saw. Gratsi's own set differs in one label only — it words the
     * primary field `Name` — and that is asserted against PGlite in column-seed.test.ts.
     */
    await expect(page.locator('[data-slot="creative-sheet-table"] thead th')).toHaveText([
      '',
      'Name + Angle + Offer',
      'Creative Name',
      'Client Approval',
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
      'Dimensions',
    ]);
    await expect(
      page.locator('[data-slot="creative-sheet-table"] thead [data-slot="select-all"]'),
    ).toHaveAttribute('data-state', 'none');

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
    await hydrated(page);

    const firstRow = page.locator('[data-slot="creative-sheet-row"]').first();
    const name = ((await firstRow.getAttribute('aria-label')) ?? '').trim();
    expect(name).not.toBe('');
    // The Sheet is titled by the BRIEF's name (B2.A1, ruling 11), the grid's `Creative Name`
    // cell; the month-prefixed sheet name stays the dialog's accessible name.
    const briefName = (await firstRow.locator('td[data-column="brief_id"]').innerText()).trim();
    expect(briefName).not.toBe('');

    await firstRow.click();

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creative-sheet-panel-title"]')).toHaveText(briefName);
    // The dialog is named by what it shows: the brief's name, not the sheet's month-prefixed row.
    await expect(panel).toHaveAttribute('aria-label', `Creative: ${briefName}`);
    // One close control: the Sheet primitive's own (B2.V6), no hand-built twin beside it.
    await expect(panel.locator('[data-slot="sheet-close"]')).toHaveCount(1);

    // Every stored Airtable field is a labelled control in the panel.
    for (const field of STORED_FIELDS) {
      const control = panel.locator(`[data-slot="creative-sheet-field-${field}"]`);
      await expect(control, field).toBeVisible();
      await expect(control.locator('label'), field).toBeVisible();
      await expect(control.locator(`#creative-sheet-field-${field}`), field).toBeVisible();
    }

    // The brief's lookups are shown read-only under Identity (B2.A7).
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
    await page.goto(`${creativeSheetPath}?creative-sheet=${MOTION_BRIEF_ID}`);

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
    // The gate line reads the ticks (B4.A12): the strategist's is unset, so Submit stays shut.
    await expect(panel.locator('[data-slot="creative-sheet-qa-gate"]')).toHaveAttribute(
      'data-open',
      'false',
    );
  });

  test('the Kanban board groups every row by internal status, then by status', async ({ page }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

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
    // Every column counts its cards in the mono face (B6.V13).
    await expect(board.locator('[data-slot="column-count"]')).toHaveCount(await columns.count());
    // The refusal line (B4.A11, one slot for both boards) exists only after a refused drop; demo
    // mode never drops, so nothing alerts at rest.
    await expect(page.locator('[data-slot="kanban-move-error"]')).toHaveCount(0);

    await pickBoardField(page, 'status');
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(ROWS);
  });

  test('the Editing stage grouping is the editor board: cards are briefs, Start on Incoming', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    await page.getByRole('tab', { name: 'Kanban' }).click();
    await pickBoardField(page, 'editorStage');
    const board = page.locator('[data-slot="kanban-board"]');
    const columns = board.locator(':scope > div');
    await expect(columns).toHaveCount(3);
    await expect(columns.nth(0)).toContainText('Sent to Editor/Designer');
    await expect(columns.nth(1)).toContainText('Under Editing');
    await expect(columns.nth(2)).toContainText('Under Review');

    // A card is a BRIEF, keyed by the brief id: the Ad Submitted motion image sits under Under
    // Review, titled by its generated name, with the sheet row linked to it as its subtitle.
    const motion = columns.nth(2).locator(`[data-card-id="${MOTION_BRIEF_ID}"]`);
    await expect(motion).toHaveCount(1);
    await expect(motion).toContainText(MOTION_BRIEF_NAME);

    // The Incoming brief is on the board with its own sheet name as subtitle, Start withheld in demo.
    const incoming = columns.nth(0).locator(`[data-card-id="${CAROUSEL_BRIEF_ID}"]`);
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

  /* ── Ticket 7: the sheet joins the per-user views; the board field is the Group control ──── */

  test('the grid groups under Internal Status through the Group popover, keeps it over a reload and flattens on None', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);
    const rows = page.locator('[data-slot="creative-sheet-row"]');
    const headers = page.locator('[data-slot="grid-group-header"]');
    await expect(headers).toHaveCount(0);

    // The popover offers the two status tracks — the columns the grid can bucket — and groups.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await expect(page.locator('[data-slot="grid-group-option"][data-field="status"]')).toHaveCount(
      1,
    );
    await page.locator('[data-slot="grid-group-option"][data-field="internal_status"]').click();
    await page.keyboard.press('Escape');

    // Seven briefs on four internal statuses: four Approved, three singletons. The header's
    // `data-group` is the chip LABEL (the renderer's `sortValue`), counted in the mono face, and
    // every data row still renders under its header.
    await expect(headers).toHaveCount(4);
    await expect(
      page.locator(
        '[data-slot="grid-group-header"][data-group="Approved"] [data-slot="group-count"]',
      ),
    ).toHaveText('4');
    await expect(page.locator('[data-slot="grid-group"]')).toHaveText('Group: Internal Status');
    await expect(rows).toHaveCount(ROWS);

    // It persisted into this viewer's active view ("My view", auto-created), and a reload reads
    // it back — in demo mode from this browser's own store, in live mode from `user_table_views`.
    await expect(page.locator('[data-slot="views-menu"]')).toHaveText('My view');
    await page.reload();
    await expect(headers).toHaveCount(4);
    await expect(page.locator('[data-slot="grid-group"]')).toHaveText('Group: Internal Status');

    // "None" hands the flat grid back.
    await hydrated(page);
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page.locator('[data-slot="grid-group-option"][data-field="__none__"]').click();
    await page.keyboard.press('Escape');
    await expect(headers).toHaveCount(0);
    await expect(rows).toHaveCount(ROWS);
  });

  /* ── Phase B5 commit 3: per-user group ordering wired into the grid ──────────────────────── */

  test('right-click a group header → Pin to top keeps the group at position 0 after reload', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    // Group by Internal Status.
    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page.locator('[data-slot="grid-group-option"][data-field="internal_status"]').click();
    await page.keyboard.press('Escape');
    const headers = page.locator('[data-slot="grid-group-header"]');
    await expect(headers).toHaveCount(4);

    // Pin "Approved" to the top through the right-click menu.
    await page
      .locator('[data-slot="grid-group-header"][data-group="Approved"]')
      .click({ button: 'right' });
    const pinItem = page.locator('[data-slot="group-context-pin"]');
    await expect(pinItem).toBeVisible();
    await pinItem.click();

    await expect(headers.nth(0)).toHaveAttribute('data-group', 'Approved');
    await expect(headers.nth(0).locator('[data-slot="group-pinned-indicator"]')).toBeVisible();

    // Reload: the pin reads back from the per-viewer store (localStorage in demo).
    await page.reload();
    await hydrated(page);
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(0)).toHaveAttribute('data-group', 'Approved');
    await expect(headers.nth(0).locator('[data-slot="group-pinned-indicator"]')).toBeVisible();

    // Reset the order so the next run of this suite starts from the default.
    await page
      .locator('[data-slot="grid-group-header"][data-group="Approved"]')
      .click({ button: 'right' });
    await page.locator('[data-slot="group-context-reset"]').click();
  });

  test('drag a group header below another and the new order survives a reload', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    await page.locator('[data-slot="view-toolbar"] [data-slot="grid-group"]').click();
    await page.locator('[data-slot="grid-group-option"][data-field="internal_status"]').click();
    await page.keyboard.press('Escape');
    const headers = page.locator('[data-slot="grid-group-header"]');
    await expect(headers).toHaveCount(4);

    // Capture the initial order (the enum default: Approved last).
    const initialOrder = await headers.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-group')),
    );
    expect(initialOrder).toContain('Approved');

    // Drag "Approved" from its slot to the first row via its drag handle.
    const sourceHandle = headers
      .filter({ has: page.locator('[data-group-value="Approved"]') })
      .locator('[data-slot="group-drag-handle"]')
      .first();
    const targetHandle = headers.nth(0).locator('[data-slot="group-drag-handle"]').first();
    await sourceHandle.dragTo(targetHandle);

    // The drag persists per-viewer; the controller's optimistic update puts Approved at index 0.
    await expect(headers.nth(0)).toHaveAttribute('data-group', 'Approved');

    await page.reload();
    await hydrated(page);
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(0)).toHaveAttribute('data-group', 'Approved');

    await headers.nth(0).click({ button: 'right' });
    await page.locator('[data-slot="group-context-reset"]').click();
  });

  test('the board field is the Group control: a pick lands in ?groupBy= and a reload opens the same board', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);
    // The picker is a board control: absent on the grid, present once the board is up.
    await expect(page.locator('[data-slot="creative-sheet-group-by"]')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Kanban' }).click();
    const picker = page.locator('[data-slot="creative-sheet-group-by"]');
    await expect(picker).toHaveText('Group: Internal Status');

    // No "None" row on a board — it always groups — and the three fields in capability order.
    await picker.click();
    await expect(page.locator('[data-slot="creative-sheet-group-by-option"]')).toHaveText([
      'Internal Status',
      'Client Approval',
      'Editing stage',
    ]);
    await expect(
      page.locator('[data-slot="creative-sheet-group-by-option"][data-field="__none__"]'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    await pickBoardField(page, 'status');
    await expect(page).toHaveURL(/[?&]groupBy=status/);
    await expect(picker).toHaveText('Group: Client Approval');
    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board.locator(':scope > div').first()).toContainText('Pending for Approval');

    // A reload reads the field back from the URL and lands on the board (the view type is this
    // browser's in demo mode; the per-brand preference's in live mode) on the client track.
    await page.reload();
    await expect(board).toBeVisible();
    await expect(picker).toHaveText('Group: Client Approval');
    await expect(board.locator(':scope > div').first()).toContainText('Pending for Approval');
    await expect(board.locator('[data-slot="kanban-card"]')).toHaveCount(ROWS);
  });

  /* ── Oct 12 client sync: Focus Mode, the Sheet sidebar, multi-select ───────────────────────── */

  test('Focus Mode is the third view: one creative, prev/next, the type-filtered QA list and the gated buttons', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

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
    // The gate box words the progress and carries its state as an attribute (B4.V1 / B4.V2).
    await expect(focus.locator('[data-slot="focus-qa-gate"]')).toContainText(
      'required checks complete',
    );
    await expect(focus.locator('[data-slot="focus-qa-gate"]')).toHaveAttribute(
      'data-open',
      /^(true|false)$/,
    );

    // Demo: every review button is withheld with a reason.
    for (const slot of ['focus-request-changes', 'focus-approve', 'focus-submit']) {
      await expect(focus.locator(`[data-slot="${slot}"]`), slot).toBeDisabled();
    }
    await expect(focus.locator('[data-slot="focus-comment-post"]')).toBeDisabled();
  });

  test('?view=focus opens Focus Mode on the creative the URL names', async ({ page }) => {
    await page.goto(`${creativeSheetPath}?view=focus&creative-sheet=${MOTION_BRIEF_ID}`);

    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toHaveAttribute('data-focus-id', MOTION_BRIEF_ID);
    // A refusal beats the demo hint (B4.V13); the gate's wording is pinned by focus-mode.test.ts.
    await expect(focus.locator('[data-slot="focus-submit"]')).toBeDisabled();
    // The motion image is video-track: the strategist's tick is missing, so the gate is shut.
    await expect(focus.locator('[data-slot="focus-qa-gate"]')).toHaveAttribute(
      'data-open',
      'false',
    );
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
  });

  test('the row panel is a Sheet with its six sections, the brief name as its title and the N/A tick struck through', async ({
    page,
  }) => {
    await page.goto(`${creativeSheetPath}?creative-sheet=${MOTION_BRIEF_ID}`);

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('role', 'dialog');
    await expect(panel).toHaveAttribute('data-side', 'right');
    await expect(panel.locator('[data-slot="creative-sheet-panel-title"]')).toHaveClass(
      /font-mono/,
    );
    await expect(panel.locator('[data-slot="creative-sheet-panel-title"]')).toHaveText(
      MOTION_BRIEF_NAME,
    );
    await expect(panel.locator('[data-slot="creative-sheet-group-heading"]')).toHaveText(
      SHEET_GROUP_HEADINGS,
    );
    // A video-track brief: the designer's tick is listed, struck through, tagged N/A.
    const designer = panel.locator('[data-slot="creative-sheet-field-qaDesigner"]');
    await expect(designer).toHaveAttribute('data-applicable', 'false');
    await expect(designer).toContainText('N/A');
    await expect(panel.locator('[data-slot="creative-sheet-field-qaVideoEditor"]')).toHaveAttribute(
      'data-applicable',
      'true',
    );
    await expect(panel.locator('[data-slot="creative-sheet-open-full"]')).toHaveAttribute(
      'href',
      new RegExp(MOTION_BRIEF_ID),
    );

    // Focus Mode from the footer swaps the view and keeps the creative.
    await hydrated(page);
    await panel.locator('[data-slot="creative-sheet-focus-mode"]').click();
    await expect(page.locator('[data-slot="focus-mode"]')).toHaveAttribute(
      'data-focus-id',
      MOTION_BRIEF_ID,
    );
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
  });

  test('multi-select: the checkbox column, the header state, the action bar and the right-click menu', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    const rows = page.locator('[data-slot="creative-sheet-row"]');
    await expect(page.locator('[data-slot="selection-bar"]')).toHaveCount(0);

    // Ticking a row selects it without opening it. The box is the drawn `Checkbox` primitive
    // (B3.V3); its native input keeps the `row-select` slot, so a `.check()` is still a check.
    await rows.nth(0).locator('[data-slot="row-select"]').check();
    await expect(rows.nth(0)).toHaveAttribute('data-checked', 'true');
    await expect(page.locator('[data-slot="creative-sheet-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="select-all"]')).toHaveAttribute('data-state', 'some');

    const bar = page.locator('[data-slot="selection-bar"]');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('role', 'toolbar');
    await expect(bar.locator('[data-slot="selection-count"]')).toHaveText('1');
    await expect(bar.locator('[data-slot="selection-duplicate"]')).toBeDisabled();
    await expect(bar.locator('[data-slot="selection-delete"]')).toBeDisabled();
    // A bulk result's notice (B3.A29) needs a write; demo mode has none, so none shows.
    await expect(page.locator('[data-slot="selection-notice"]')).toHaveCount(0);

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
    // The row the menu is open on is marked, so the grid can tint it (B3.V5).
    await expect(rows.nth(1)).toHaveAttribute('data-context', 'open');
    await expect(menu.locator('[data-slot="context-duplicate"]')).toBeDisabled();
    await menu.locator('[data-slot="context-focus"]').click();
    await expect(page.locator('[data-slot="focus-mode"]')).toBeVisible();
  });

  test('search reads the name, the brief and the status labels', async ({ page }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    await page.locator('[data-slot="creative-sheet-search"]').fill(UNIQUE_SEARCH);
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="creative-sheet-row"]').first()).toHaveAttribute(
      'aria-label',
      new RegExp(UNIQUE_SEARCH),
    );
    await expect(page.locator('[data-slot="creative-sheet-count"]')).toContainText(
      `1 of ${String(ROWS)} rows`,
    );

    await page.locator('[data-slot="creative-sheet-search"]').fill('nothing matches this');
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(0);
    await page.locator('[data-slot="creative-sheet-empty"] [data-slot="clear-search"]').click();
    await expect(page.locator('[data-slot="creative-sheet-row"]')).toHaveCount(ROWS);
  });

  // Ticket 10: Focus Mode mounts the Review Thread panel and the annotation overlay. In demo mode
  // every write is refused with the demo hint; the thread panel is empty for the first fixture
  // brief and the Approve button is disabled with the QA refusal (not the demo hint).
  test('Ticket 10 — overlay and thread panel mount; writes refused in demo mode', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    await page.getByRole('tab', { name: 'Focus Mode' }).click();
    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toBeVisible();

    // The thread panel mounts empty; the overlay is non-interactive in demo mode.
    await expect(focus.locator('[data-slot="brief-comment-thread"]')).toBeVisible();
    await expect(focus.locator('[data-slot="focus-overlay"]')).toHaveAttribute(
      'data-interactive',
      'false',
    );

    // Approve is disabled with the QA refusal, which beats the demo hint (B4.V13).
    await expect(focus.locator('[data-slot="focus-approve"]')).toBeDisabled();
  });

  // Ticket 11: Focus Mode mounts the version chip row and the Upload control. In demo mode the
  // Upload button is disabled with the demo hint; the chip row mounts even when the fixture carries
  // no submissions (empty state), and no console error is thrown.
  test('Ticket 11 — version chip row and Upload mount; Upload refused in demo mode', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    await hydrated(page);

    await page.getByRole('tab', { name: 'Focus Mode' }).click();
    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toBeVisible();

    // The chip row mounts, and the Upload button is disabled with the demo hint.
    await expect(focus.locator('[data-slot="focus-version-chips"]')).toBeVisible();
    await expect(focus.locator('[data-slot="focus-upload"]')).toBeDisabled();
  });

  /**
   * Ticket 12 — `?tab=stats` mounts the four panels. Demo mode seeds no activity log and no
   * submissions, so every empty-state slot is visible. The role gate passes because demo mode
   * returns `admin` from `loadViewerRole`.
   */
  test('`?tab=stats` renders the KPI, per-editor, weekly and turnaround panels with empty states', async ({
    page,
  }) => {
    await page.goto(`${creativeSheetPath}?tab=stats`);

    await expect(page.locator('[data-slot="brief-stats-tab"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-stats-kpi"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-stats-per-editor"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-stats-weekly"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-stats-turnaround"]')).toBeVisible();

    // Every panel's empty-state slot is present (demo mode has no activity ledger).
    const emptySlots = [
      'brief-stats-in-flight-empty',
      'brief-stats-approved-week-empty',
      'brief-stats-avg-revision-empty',
      'brief-stats-qa-pass-rate-empty',
      'brief-stats-per-editor-empty',
      'brief-stats-weekly-empty',
      'brief-stats-turnaround-empty',
    ];
    for (const slot of emptySlots) {
      await expect(page.locator(`[data-slot="${slot}"]`)).toBeVisible();
    }

    // The tab bar sits above the panels and marks `stats` active.
    await expect(page.locator('[data-slot="creative-sheet-tab-stats"]')).toHaveAttribute(
      'data-active',
      'true',
    );
  });
});
