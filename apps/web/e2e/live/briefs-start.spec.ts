import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { briefPath, briefsPath } from '../../src/lib/routes';
import { expect, test } from '../support/brief-reset';

const EDITOR_BOARD = `${briefsPath}?group=editorStage`;

/**
 * The live half of the editor board (Sprint 10): Start claims an Incoming brief through the real
 * Server Action against the E2E database, the card moves, and the Activity log names the status
 * change and the signed-in user. Runs in the `live` Playwright project only (docs/runbook.md,
 * "Playwright live mode"); without the four variables it reports itself skipped (D-008). The brief
 * it picks is put back by `briefGuard` whether the test passes or not.
 */
test.describe('editor board with Clerk and a database', () => {
  // The editor board lived on the Creative Design LIST page, which the Oct 7 template cleanup
  // retired (`/app/creative-design` now redirects to the Creative Sheet). The Start action and
  // the brief detail assertions below still hold, but the board has no page to mount on until it
  // is re-homed — see docs/decisions.md, "Template cleanup".
  test.skip(
    true,
    'Creative Design list page retired on 2026-10-07; the editor board needs a new home before this can run.',
  );
  test.skip(
    liveE2eEnv() === undefined,
    'No live-mode variables (CLERK_PUBLISHABLE_KEY_TEST, CLERK_SECRET_KEY_TEST, CLERK_E2E_USER_PASSWORD, DATABASE_URL_E2E): Start writes a status and an activity row, which demo mode refuses (D-008). See docs/runbook.md, "Playwright live mode".',
  );

  test('Start moves an Incoming brief to Under Editing and the log names the status change and the user', async ({
    page,
    briefGuard,
    workerSession,
  }) => {
    await page.goto(EDITOR_BOARD);
    const board = page.locator('[data-slot="kanban-board"]');
    const columns = board.locator(':scope > div');
    const card = columns.nth(0).locator('[data-slot="kanban-card"]').first();
    await expect(card).toBeVisible();
    const id = (await card.getAttribute('data-card-id')) ?? '';
    expect(id).not.toBe('');

    // Snapshot first: the fixture restores status, assignee and activity rows in teardown.
    const before = await briefGuard.track(id);
    const who = workerSession.displayName;
    expect(who).not.toBe('');

    await card.locator('[data-slot="brief-start"]').click();

    // The card moves: a real status write, read back by the board.
    await expect(columns.nth(1).locator(`[data-card-id="${id}"]`)).toHaveCount(1);
    await expect(columns.nth(0).locator(`[data-card-id="${id}"]`)).toHaveCount(0);

    // The database agrees: the status went forward, the assignee is the signed-in user, and the
    // action wrote at least the two activity_log rows (status, assignee) on top of what was there.
    const after = await briefGuard.inspect(id);
    expect(after.internalStatus).not.toBe(before.internalStatus);
    expect(after.internalStatus).toMatch(/in_progress$/);
    expect(after.assignee).toBe(who);
    expect(after.activityIds.length).toBeGreaterThanOrEqual(before.activityIds.length + 2);

    // The full page shows those rows: old → new status, the actor, and the assignee.
    await page.goto(briefPath(id));
    const entry = page
      .locator('[data-slot="brief-activity-entry"][data-field="internalStatus"]')
      .first();
    await expect(entry.locator('[data-slot="brief-activity-old"]')).toContainText(
      before.internalStatus,
    );
    await expect(entry.locator('[data-slot="brief-activity-new"]')).toContainText('in_progress');
    await expect(entry.locator('[data-slot="brief-activity-actor"]')).toHaveText(who);
    await expect(
      page.locator('[data-slot="brief-activity-entry"][data-field="assignee"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-slot="brief-assignee"]')).toHaveText(who);
  });
});
