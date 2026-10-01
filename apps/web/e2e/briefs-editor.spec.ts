import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { briefPath, briefsPath } from '../src/lib/routes';

/**
 * The editor's board (Sprint 10): the Creative Design Kanban grouped by Editing stage — Incoming,
 * Under Editing, Under Review — the Start button on an Incoming card, the quick-look panel, and the
 * full page's facts, stage chip, Scripts table and Activity log.
 *
 * Demo mode has no session and refuses every write, so this file proves the board, the mapping,
 * the disabled Start with its reason, and the full page. The live half — Start a brief, see it
 * move, see the log name the status change and the user — is `e2e/live/briefs-start.spec.ts`,
 * which runs in the `live` Playwright project against a Clerk dev instance and the E2E database
 * and skips itself without them (D-008).
 */
/** `demoBriefs`: the one Incoming fixture (sent_to_video_editor), a carousel on the video track. */
const NINETY_MINUTES_CAROUSEL = '77777777-7777-4777-8777-000000000006';
/** Under Editing: the static brief in design. */
const NOT_YOUR_AGE_STATIC = '77777777-7777-4777-8777-000000000002';
/** Under Review: the motion image whose ad was submitted. */
const DAYLIGHT_MOTION = '77777777-7777-4777-8777-000000000003';
/** Off the board: approved. */
const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';

const EDITOR_BOARD = `${briefsPath}?group=editorStage`;

test.describe('editor board in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the board needs a session and real data',
  );

  test('groups the board into Incoming, Under Editing and Under Review, in that order', async ({
    page,
  }) => {
    await page.goto(EDITOR_BOARD);

    const board = page.locator('[data-slot="kanban-board"]');
    await expect(board).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Group by' })).toHaveValue('editorStage');

    // Three columns, the mapping's order; the headers are the stage labels, never status keys.
    const columns = board.locator(':scope > div');
    await expect(columns).toHaveCount(3);
    await expect(columns.nth(0)).toContainText('Incoming');
    await expect(columns.nth(1)).toContainText('Under Editing');
    await expect(columns.nth(2)).toContainText('Under Review');

    // One fixture per stage, by the mapping: sent_to_video_editor → Incoming,
    // static_design_in_progress → Under Editing, ad_submitted → Under Review.
    await expect(
      columns
        .nth(0)
        .locator(`[data-slot="kanban-card"][data-card-id="${NINETY_MINUTES_CAROUSEL}"]`),
    ).toHaveCount(1);
    await expect(
      columns.nth(1).locator(`[data-slot="kanban-card"][data-card-id="${NOT_YOUR_AGE_STATIC}"]`),
    ).toHaveCount(1);
    await expect(
      columns.nth(2).locator(`[data-slot="kanban-card"][data-card-id="${DAYLIGHT_MOTION}"]`),
    ).toHaveCount(1);

    // Approved and launched briefs have left the editor's desk: off the board, counted in words.
    await expect(board.locator(`[data-card-id="${BODY_CLOCK}"]`)).toHaveCount(0);
    await expect(page.locator('[data-slot="brief-off-board"]')).toContainText(
      'off the editor board',
    );
  });

  test('an Incoming card carries Start, disabled with the reason; other stages do not', async ({
    page,
  }) => {
    await page.goto(EDITOR_BOARD);

    const incoming = page.locator(
      `[data-slot="kanban-card"][data-card-id="${NINETY_MINUTES_CAROUSEL}"]`,
    );
    const start = incoming.locator('[data-slot="brief-start"]');
    await expect(start).toHaveText('Start');
    await expect(start).toBeDisabled();
    await expect(incoming.locator('[data-slot="disabled-write"]')).toHaveAttribute(
      'title',
      'Sign in required to save changes',
    );

    await expect(
      page
        .locator(`[data-slot="kanban-card"][data-card-id="${NOT_YOUR_AGE_STATIC}"]`)
        .locator('[data-slot="brief-start"]'),
    ).toHaveCount(0);
  });

  test('a card opens the quick look; the full page shows the facts, the stage, the scripts and the log', async ({
    page,
  }) => {
    await page.goto(EDITOR_BOARD);
    await page
      .locator(`[data-slot="kanban-card"][data-card-id="${NINETY_MINUTES_CAROUSEL}"]`)
      .click();
    const panel = page.locator('[data-slot="brief-panel"]');
    await expect(panel).toBeVisible();
    await panel.locator('[data-slot="brief-panel-open-full"]').click();
    await expect(page).toHaveURL(new RegExp(`${briefPath(NINETY_MINUTES_CAROUSEL)}$`), {
      timeout: 45_000,
    });

    // The facts: assignee, priority, due date, type, linked concept, internal status (the rail).
    await expect(page.locator('[data-slot="brief-assignee"]')).not.toHaveText('');
    await expect(page.locator('[data-slot="brief-priority"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-dueDate"]')).toHaveAttribute('type', 'date');
    await expect(page.locator('[data-slot="brief-type"]')).not.toHaveText('');
    await expect(page.locator('[data-slot="brief-concept"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-rail"]')).toBeVisible();

    // Colour-coded by stage: the chip carries the stage and its tone.
    const stage = page.locator('[data-slot="brief-stage"]');
    await expect(stage).toHaveAttribute('data-stage', 'incoming');
    await expect(stage.locator('[data-slot="status-chip"]')).toHaveText('Incoming');
    await expect(stage.locator('[data-slot="status-chip"]')).toHaveAttribute('data-tone', 'info');

    // The Scripts table under the details, and the Activity log with its worded empty state.
    await expect(page.locator('[data-slot="brief-scripts-table"] thead th')).toHaveText([
      'Script',
      'Kind',
      'Status',
    ]);
    await expect(page.locator('[data-slot="brief-activity"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-activity-empty"]')).toContainText(
      'No activity yet',
    );
  });
});
