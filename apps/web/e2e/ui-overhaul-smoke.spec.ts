import { expect, test, type Page } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { briefPath, creativeSheetPath } from '../src/lib/routes';

/**
 * Oct 12 UI overhaul (Ticket 0, docs/sprint-oct12-ui-gap.md): one short visit to every page the
 * restyled primitives land on, in demo mode. Each test asserts the SHAPE the boards asked for —
 * the drawn `Checkbox`, the `SectionLabel` rules, the `success` Approve, the gate popover on a
 * withheld button, the QA gate's `data-open`, the grouped Activity card — through the slots the
 * components keep, never through a colour or a pixel. Colour literals are the unit tests' job
 * (`no-hex.test.ts`); behaviour is `creative-sheet.spec.ts`'s. This file is the smoke between.
 */

/** `demoBriefs`: the Video on the Body Clock concept, every QA tick set — the gate is OPEN here. */
const BODY_CLOCK_BRIEF_ID = '77777777-7777-4777-8777-000000000001';
/** The Motion Image on the 9am concept: Ad Submitted, strategist unticked — the gate HOLDS Approve. */
const MOTION_BRIEF_ID = '77777777-7777-4777-8777-000000000003';

/** `SHEET_GROUPS` in creative-sheet/fields.ts, the six sections after B2.A4. */
const SHEET_GROUP_HEADINGS = ['Identity', 'Status', 'Content', 'QA', 'Assets', 'Meta'];

const DESIGN_SYSTEM = '/design-system';

/** See creative-sheet.spec.ts: a control is driven only once the shell has hydrated. */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', { timeout: 45_000 });
}

/** The `DisabledWrite` wrapper around a withheld control, by the control's slot. */
function withheld(page: Page, slot: string) {
  return page.locator(`[data-slot="disabled-write"]:has([data-slot="${slot}"])`);
}

test.describe('Oct 12 UI overhaul: the restyled surfaces in demo mode', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the demo pages need no session; a live server redirects them',
  );

  // Three routes, each compiled by `next dev` on its first request: warmed once, measured never.
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    for (const route of [creativeSheetPath, briefPath(BODY_CLOCK_BRIEF_ID), DESIGN_SYSTEM]) {
      await page.goto(route, { waitUntil: 'networkidle' });
    }
    await page.close();
  });

  test('the grid: the drawn Checkbox in the select column, the icon tabs and the mute count chip', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);

    const table = page.locator('[data-slot="creative-sheet-table"]');
    // The header and every row draw the `Checkbox` primitive (B3.V3); the native input inside
    // keeps the `select-all` / `row-select` slots the behaviour spec drives.
    const headerBox = table.locator('thead [data-slot="checkbox"]');
    await expect(headerBox).toHaveCount(1);
    await expect(headerBox.locator('[data-slot="select-all"]')).toHaveAttribute(
      'data-state',
      'none',
    );
    await expect(
      table.locator('tbody [data-slot="checkbox"] [data-slot="row-select"]'),
    ).toHaveCount(7);

    // The view pill: three tabs, each led by its lucide glyph (B1.V24 / B1.V25).
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText(['Grid', 'Kanban', 'Focus Mode']);
    await expect(tabs.locator('svg')).toHaveCount(3);

    // The row count beside the title is a mute chip (B3.V22).
    const count = page.locator('[data-slot="creative-sheet-count"] [data-slot="status-chip"]');
    await expect(count).toHaveText('7 rows');
    await expect(count).toHaveAttribute('data-tone', 'mute');
  });

  test('Focus Mode: the three bar buttons, the gate popover on the withheld Approve, the Checkbox rows and the gate box', async ({
    page,
  }) => {
    await page.goto(`${creativeSheetPath}?view=focus&creative-sheet=${MOTION_BRIEF_ID}`);

    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toHaveAttribute('data-focus-id', MOTION_BRIEF_ID);

    // The bar: Request Changes, Approve (the `success` variant, B1.V1) and Submit to Client, in
    // that order, every one withheld in demo mode.
    const actions = focus.locator('[data-slot="focus-actions"]');
    await expect(actions.locator('button')).toHaveText([
      'Request Changes',
      'Approve',
      'Submit to Client',
    ]);
    for (const slot of ['focus-request-changes', 'focus-approve', 'focus-submit']) {
      await expect(actions.locator(`[data-slot="${slot}"]`), slot).toBeDisabled();
    }

    // A withheld button explains itself in the styled popover (B1.V6, ruling 8), not only in the
    // OS `title`: the tooltip element is in the tree, hidden until the wrapper is hovered. Here
    // the QA gate holds Approve — the strategist's tick is unset — so the popover carries the
    // warn heading and the missing tick's name (B1.A6).
    const approve = withheld(page, 'focus-approve');
    await expect(approve).toHaveAttribute('title', /.+/);
    const popover = approve.locator('[data-slot="disabled-write-popover"]');
    await expect(popover).toHaveCount(1);
    await expect(popover).toHaveAttribute('role', 'tooltip');
    await expect(popover).toContainText('QA checklist incomplete');
    await expect(popover).toContainText('Creative Strategist QA');
    await expect(popover).toBeHidden();
    await approve.hover();
    await expect(popover).toBeVisible();

    // The QA list draws the Checkbox primitive, two rows for the video track, under a SectionLabel.
    const qa = focus.locator('[data-slot="focus-qa"]');
    await expect(qa.locator('[data-slot="section-label"]')).toHaveText('QA Checklist');
    await expect(qa.locator('[data-slot="checkbox"] [data-slot="focus-qa-check"]')).toHaveCount(2);
    await expect(
      qa.locator('[data-slot="focus-qa-check"][data-check="qaStrategist"]'),
    ).not.toBeChecked();
    // The gate box: shut, with its state readable without parsing the copy (B4.V1 / B4.V2).
    const gate = qa.locator('[data-slot="focus-qa-gate"]');
    await expect(gate).toHaveAttribute('data-open', 'false');
    await expect(gate).toContainText('required checks complete');
  });

  test('the Sheet sidebar: six SectionLabel headings, Checkbox ticks, the gate line, the primitive close and the footer', async ({
    page,
  }) => {
    await page.goto(`${creativeSheetPath}?creative-sheet=${MOTION_BRIEF_ID}`);

    const panel = page.locator('[data-slot="creative-sheet-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="creative-sheet-group-heading"]')).toHaveText(
      SHEET_GROUP_HEADINGS,
    );
    // Internal, client and type chips in the header; nothing else above the sections (B2.V5).
    await expect(
      panel.locator('[data-slot="creative-sheet-panel-chips"] [data-slot="status-chip"]'),
    ).toHaveCount(3);

    // The four ticks are the Checkbox primitive: the other track's in the dashed N/A variant.
    await expect(panel.locator('[data-slot="checkbox"]')).toHaveCount(4);
    await expect(
      panel.locator('[data-slot="creative-sheet-field-qaDesigner"] [data-slot="checkbox"]'),
    ).toHaveAttribute('data-variant', 'na');
    await expect(
      panel.locator('[data-slot="creative-sheet-field-qaVideoEditor"] [data-slot="checkbox"]'),
    ).toHaveAttribute('data-variant', 'default');
    await expect(panel.locator('[data-slot="creative-sheet-qa-gate"]')).toHaveAttribute(
      'data-open',
      'false',
    );

    // One close: the Sheet primitive's (B2.V6). The footer: Focus Mode, Open full page, the demo
    // note and Save — no Cancel (B2.V23, ruling 10).
    await expect(panel.locator('[data-slot="sheet-close"]')).toHaveCount(1);
    const footer = panel.locator('[data-slot="sheet-footer"]');
    await expect(footer.locator('[data-slot="creative-sheet-focus-mode"]')).toBeVisible();
    await expect(footer.locator('[data-slot="creative-sheet-open-full"]')).toBeVisible();
    await expect(footer.locator('[data-slot="creative-sheet-demo-note"]')).toBeVisible();
    await expect(footer.locator('[data-slot="creative-sheet-save"]')).toBeDisabled();
    await expect(footer.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  });

  test('the brief page: QaCheckRow with its N/A tag, the gate line open, and the Activity section', async ({
    page,
  }) => {
    await page.goto(briefPath(BODY_CLOCK_BRIEF_ID));

    // The checklist: three shared rows (B4.V3 / B4.V17); a Video does not need the designer's
    // tick, so that row is N/A and tagged; every input stays the `brief-qa-check` the specs drive.
    const qa = page.locator('[data-slot="brief-qa"]');
    await expect(qa.locator('[data-slot="section-label"]')).toHaveText('QA checklist');
    const rows = qa.locator('[data-slot="qa-check-row"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('[data-slot="brief-qa-check"]')).toHaveCount(3);
    const designer = rows.filter({ has: page.locator('[data-check="qaDesigner"]') });
    await expect(designer).toHaveAttribute('data-applicable', 'false');
    await expect(designer.locator('[data-slot="qa-check-tag"]')).toHaveAttribute('data-kind', 'na');
    await expect(designer.locator('[data-slot="checkbox"]')).toHaveAttribute('data-variant', 'na');
    // Every required tick is set on this fixture: the gate line says so as an attribute.
    await expect(qa.locator('[data-slot="brief-qa-gate"]')).toHaveAttribute('data-open', 'true');

    // The Activity section (B5.V4): a labelled section under a SectionLabel, worded when empty —
    // demo mode logs nothing, so the grouped cards are the live spec's to assert.
    const activity = page.locator('[data-slot="brief-activity"]');
    await expect(activity).toBeVisible();
    await expect(activity.locator('#brief-activity-heading')).toHaveText('Activity');
    await expect(activity.locator('[data-slot="brief-activity-empty"]')).toContainText(
      'No activity yet',
    );
  });

  test('/design-system mounts the Oct 12 stories on the restyled primitives', async ({ page }) => {
    await page.goto(DESIGN_SYSTEM);

    // The primitive sections the overhaul touched are on the page, by their h2.
    for (const title of ['Buttons', 'Form controls', 'StatusChip', 'TwoTrackApproval']) {
      await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
    }
    // The three Oct 12 stories, by their h3 captions.
    for (const caption of [
      /^focus mode \(Oct 12/,
      /^brief row sidebar \(Oct 12\)/,
      /^multi-select \(Oct 12/,
    ]) {
      await expect(page.getByRole('heading', { level: 3, name: caption })).toBeVisible();
    }

    // The Focus Mode story renders the real view in demo mode: the withheld Approve carries the
    // popover, and the QA rows are the Checkbox primitive.
    const focus = page.locator('[data-slot="focus-mode"]');
    await expect(focus).toHaveCount(1);
    await expect(focus.locator('[data-slot="focus-approve"]')).toBeDisabled();
    await expect(
      withheld(page, 'focus-approve').locator('[data-slot="disabled-write-popover"]'),
    ).toHaveCount(1);
    await expect(focus.locator('[data-slot="checkbox"]').first()).toBeVisible();

    // The multi-select story opens with one row ticked: the header box is indeterminate.
    await expect(page.locator('[data-slot="select-all"]').last()).toHaveAttribute(
      'data-state',
      'some',
    );

    // The sidebar story opens the real Sheet with the six headings.
    await hydrated(page);
    await page.locator('[data-slot="brief-sidebar-story-open"]').click();
    await expect(
      page.locator('[data-slot="creative-sheet-panel"] [data-slot="creative-sheet-group-heading"]'),
    ).toHaveText(SHEET_GROUP_HEADINGS);
  });
});
