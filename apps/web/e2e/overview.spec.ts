import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath } from '../src/lib/routes';

/**
 * The Overview, on fixtures. `smoke.spec.ts` already proves the pipeline cards count and click
 * through; this spec covers what the action-item sweep changed about the page, so a regression in
 * either change fails here rather than only in a unit test.
 */
test.describe('the Overview in demo mode (no Clerk publishable key)', () => {
  test.skip(clerkKeys() !== undefined, 'Clerk keys present: /app needs a session and real data');

  test('the library section no longer carries Angles, and the CSM tile is gone with it (AI-8)', async ({
    page,
  }) => {
    await page.goto(appPath);

    const library = page.locator('[data-slot="overview-library"]');
    await expect(library).toBeVisible();
    // Three sections, in order, and Angles is not among them.
    await expect(library.getByRole('link')).toHaveText([/Personas/, /Themes/, /Concepts/]);
    await expect(library.getByRole('link', { name: /Angles/ })).toHaveCount(0);

    // Nor does the role queue carry a library tile — the "Angles in library" tile that counted
    // concepts is gone from every role, admin included (demo mode resolves to admin).
    const queue = page.locator('section[aria-labelledby="role-heading"]');
    await expect(queue).toBeVisible();
    await expect(queue.getByRole('link', { name: /Angles/ })).toHaveCount(0);

    // The Angles table itself is untouched and still reached from the sidebar: nothing was dropped,
    // only the duplicate count on this page.
    await expect(
      page.locator('[data-slot="shell-sidebar"]').getByRole('link', { name: /Angles/ }),
    ).toHaveCount(1);
  });
});
