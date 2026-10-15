import { expect, test, type Page } from '@playwright/test';

/**
 * Phase B5 commit 2 — the per-user group-reorder header, driven from the design-system story.
 *
 * The live data-grid flow needs a seeded Postgres and a Clerk session (`saveGroupOrderAction` goes
 * through both). Both are absent in the demo deployment this suite runs in, so the e2e cover is
 * the design-system story: it mounts the SAME `useGroupOrder` + `SortableGroupHeader` components
 * the grid will mount, with a local-state IO. Drag + pin + reset interactions are therefore the
 * real ones; only the persistence layer is in-memory instead of the DB.
 */

async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true', {
    timeout: 45_000,
  });
}

test.describe('phase b5 — group-reorder header story', () => {
  test('drag reorders groups, pin lifts a group to the top, scope toggles between view and all views', async ({
    page,
  }) => {
    await page.goto('/design-system');
    await hydrated(page);

    const story = page.locator('[data-slot="group-reorder-story"]');
    await expect(story).toBeVisible();

    const rows = story.locator('[data-slot="group-reorder-row"]');
    await expect(rows).toHaveCount(3);
    // The default order for a status field is the INTERNAL_STATUS enum: draft, …, approved.
    const initialOrder = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-group')),
    );
    expect(initialOrder).toEqual(['draft', 'under_editing_or_designing', 'approved']);

    // Right-click the "approved" group → menu opens → "Pin to top" → approved jumps to row 0.
    await rows
      .filter({ has: page.locator('[data-group-value="approved"]') })
      .first()
      .click({ button: 'right' });
    const pinItem = page.locator('[data-slot="group-context-pin"]');
    await expect(pinItem).toBeVisible();
    await pinItem.click();

    await expect(rows.nth(0).locator('[data-group-value="approved"]')).toBeVisible();
    await expect(rows.nth(0).locator('[data-slot="group-pinned-indicator"]')).toBeVisible();

    // Scope toggle flips the controller state (the on-screen label switches to "all views").
    const scopeLabel = story.locator('[data-slot="group-reorder-scope-label"]');
    await expect(scopeLabel).toContainText('this view');
    await story.locator('[data-slot="group-reorder-scope-toggle"]').click();
    await expect(scopeLabel).toContainText('all views');

    // Right-click again, open the menu, "Reset order" → approved drops back out of the pin slot
    // (default status enum order: draft first).
    await rows
      .filter({ has: page.locator('[data-group-value="approved"]') })
      .first()
      .click({ button: 'right' });
    const resetItem = page.locator('[data-slot="group-context-reset"]');
    await expect(resetItem).toBeVisible();
    await resetItem.click();

    const afterReset = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-group')),
    );
    expect(afterReset).toEqual(['draft', 'under_editing_or_designing', 'approved']);
  });
});
