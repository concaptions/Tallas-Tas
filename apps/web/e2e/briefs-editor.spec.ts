import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { briefPath } from '../src/lib/routes';

/**
 * The editor's view of a brief (Sprint 10): the full page's facts, the Editing-stage chip, the
 * Scripts table and the Activity log.
 *
 * The editor's BOARD — the Creative Design Kanban grouped by Editing stage, with its Start button
 * on a first-stage card — lived on the Creative Design list page, which was retired for every brand
 * on 2026-10-07 (`REMOVED_WORKSPACES` in `@tas/domain`; the old URL redirects to the Creative
 * Sheet, see `removed-workspaces.spec.ts`). The stage mapping itself is still unit-tested in
 * `@tas/domain/state` (`editorStageOf`), and the detail page below still renders the stage chip
 * from it.
 *
 * Demo mode has no session and refuses every write, so this file proves the full page. The live
 * half — Start a brief, see it move, see the log name the status change and the user — is
 * `e2e/live/briefs-start.spec.ts`, which runs in the `live` Playwright project against a Clerk dev
 * instance and the E2E database and skips itself without them (D-008).
 */
/** `demoBriefs`: the one first-stage fixture (sent_to_video_editor), a carousel on the video track. */
const NINETY_MINUTES_CAROUSEL = '77777777-7777-4777-8777-000000000006';

test.describe('editor view of a brief in demo mode (no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: the brief detail page needs a session and real data',
  );

  test('the full page shows the facts, the stage, the scripts and the log', async ({ page }) => {
    await page.goto(briefPath(NINETY_MINUTES_CAROUSEL));

    // The facts: assignee, priority, due date, type, linked concept, internal status (the rail).
    await expect(page.locator('[data-slot="brief-assignee"]')).not.toHaveText('');
    await expect(page.locator('[data-slot="brief-priority"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-dueDate"]')).toHaveAttribute('type', 'date');
    await expect(page.locator('[data-slot="brief-type"]')).not.toHaveText('');
    await expect(page.locator('[data-slot="brief-concept"]')).toBeVisible();
    await expect(page.locator('[data-slot="brief-rail"]')).toBeVisible();

    // AI-54. The concept link auto-fills all FOUR fields PRD §5.10 names, so Persona has a row of
    // its own beside Batch, Angle and Product — the em dash when the angle links none, never a gap.
    const facts = page.locator('[data-slot="brief-concept-facts"]');
    await expect(facts.locator('dt')).toHaveText(['Batch', 'Angle', 'Persona', 'Product']);
    await expect(page.locator('[data-slot="brief-persona"]')).not.toHaveText('');

    // Colour-coded by stage: the chip carries the stage and its tone. `sent_to_video_editor` is the
    // first stage of the editor's ladder, which `editorStageOf` names `incoming`.
    const stage = page.locator('[data-slot="brief-stage"]');
    await expect(stage).toHaveAttribute('data-stage', 'incoming');
    await expect(stage.locator('[data-slot="status-chip"]')).toHaveText('Sent to Editor/Designer');
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
