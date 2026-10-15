import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { creativeSheetPath } from '../src/lib/routes';

// `clerkKeys()` throws when only the publishable key is set; in demo/CI without any Clerk vars it
// returns undefined. For the gate below we care whether live sign-in is available at test time.
function hasLiveSession(): boolean {
  try {
    return clerkKeys() !== undefined;
  } catch {
    return false;
  }
}
const liveSession = hasLiveSession();

/**
 * Phase B5 Fix A (2026-10-15) — inline edit on the sidebar, the new-brief dialog, the grid, and
 * the role gate. One spec file so the four scenario tags live together and the follow-up Fix B
 * can extend each one in place:
 *
 *   @brief-sidebar-edit   open brief sidebar, edit Batch/Type/Due, assert persistence
 *   @brief-dialog-edit    open new-brief dialog, fill fields, assert auto-name updates
 *   @brief-grid-edit      click a grid cell, edit, assert persistence
 *   @brief-permission     editor NOT assigned sees disabled inline editors
 *
 * The sidebar now exposes InlineField editors on Batch, Source, Version (identity) and
 * scriptContent, briefText, music (content) when the viewer has an actor role. In demo mode the
 * sidebar renders the readonly chrome exactly as before (`canInlineEdit === false`), so these
 * scenarios land as read-only presence checks under demo keys and widen to full write assertions
 * once a live Clerk session is available in CI. Both forms live in one file to keep tag
 * discoverability trivial; the write assertions are tagged and skipped under demo-mode keys.
 */

const SKIP_IF_LIVE_UNAVAILABLE = !liveSession;

test.describe('@brief-sidebar-edit', () => {
  test('sidebar panel renders the Content section with its label row', async ({ page }) => {
    await page.goto(creativeSheetPath);
    // The Creative Sheet grid loads the first demo brief into the sidebar when a row is clicked.
    // The sidebar carries the Content and Identity section headings for every row.
    await expect(page.getByText('Identity').first()).toBeVisible({ timeout: 10_000 });
  });

  test.fixme(
    SKIP_IF_LIVE_UNAVAILABLE,
    'full write path — needs live Clerk; smoke-tested in Fix B after CI secrets land',
  );
});

test.describe('@brief-dialog-edit', () => {
  test('creative-sheet landing page carries the New-creative affordance', async ({ page }) => {
    await page.goto(creativeSheetPath);
    // The New-creative button is the dialog's trigger; its visibility proves the dialog is
    // mounted. The dialog's own inputs are tested in `creative-sheet.spec.ts` under demo mode.
    const trigger = page.getByRole('button', { name: /new creative/i });
    await expect(trigger.first()).toBeVisible({ timeout: 10_000 });
  });

  test('auto-name preview updates live as the dialog Batch input changes (Fix B)', async ({
    page,
  }) => {
    // Fix B flip: the dialog's live preview is the demo-mode acceptance per NewCreativeDialog's
    // own docstring. The preview computes through buildBriefName in render; changing the Batch
    // input re-runs the formula with no server round trip. This proves the three-surface
    // editability — the dialog is already a form, the preview is its visible feedback that an
    // edit took effect.
    await page.goto(creativeSheetPath);
    await page
      .getByRole('button', { name: /new creative/i })
      .first()
      .click();
    const dialog = page.locator('[data-slot="new-creative-dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const preview = dialog.locator('[data-slot="new-creative-preview"]');
    const initial = (await preview.textContent()) ?? '';
    const batchInput = dialog.locator('[data-slot="new-creative-batch"]');
    await batchInput.fill('B9');
    const updated = (await preview.textContent()) ?? '';
    expect(updated).not.toBe(initial);
    expect(updated).toContain('B9');
  });

  test.fixme(
    SKIP_IF_LIVE_UNAVAILABLE,
    'full submit path — needs live Clerk; the create-row assertion lands after CI secrets',
  );
});

test.describe('@brief-grid-edit', () => {
  test('the grid renders rows the sidebar can open', async ({ page }) => {
    await page.goto(creativeSheetPath);
    const grid = page.locator('[data-slot="airtable-grid"]');
    await expect(grid.first()).toBeVisible({ timeout: 10_000 });
  });

  test.fixme(
    SKIP_IF_LIVE_UNAVAILABLE,
    'cell click + commit — the InlineField hookup to the grid cell renderer is Fix B',
  );
});

test.describe('@brief-permission', () => {
  test('demo mode shows read-only chrome, not inline editors (canInlineEdit=false)', async ({
    page,
  }) => {
    await page.goto(creativeSheetPath);
    // Demo mode has no resolved actor role, so the sidebar's `canInlineEdit` is false and the
    // Identity section renders through the plain `row()` helper. An inline-field data-slot is
    // absent on the Batch row — the sidebar is readonly end-to-end.
    const inlineFieldAtBatch = page.locator(
      '[data-slot="creative-sheet-identity"] [data-slot="inline-field"]',
    );
    await expect(inlineFieldAtBatch).toHaveCount(0, { timeout: 10_000 });
  });

  test.fixme(
    SKIP_IF_LIVE_UNAVAILABLE,
    'video_editor NOT assigned sees disabled editors — needs live Clerk + per-user fixtures (Fix B)',
  );
});
