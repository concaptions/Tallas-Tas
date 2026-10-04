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

  test('the pipeline shows all eleven reference metrics, revisions and launches included (AI-6)', async ({
    page,
  }) => {
    await page.goto(appPath);

    // Eleven for the demo visitor, who resolves to admin and therefore scans the whole pipeline.
    const cards = page.locator('[data-slot="overview-metric"]');
    await expect(cards).toHaveCount(11);

    // The three action item 6 added, by KEY — a label rename must not be able to satisfy this.
    const metric = (key: string) =>
      page.locator(`[data-slot="overview-metric"][data-metric="${key}"]`);
    for (const key of ['internal_revisions', 'client_revisions', 'ads_to_launch']) {
      await expect(metric(key), key).toHaveCount(1);
    }

    // Ads to Launch lands on the Briefs table filtered to BOTH approvals, and the rows it shows are
    // the ones it counted — the same end-to-end proof the other cards get in smoke.spec.ts.
    const launch = metric('ads_to_launch');
    const count = Number(await launch.locator('[data-slot="overview-metric-count"]').innerText());
    expect(count).toBeGreaterThan(0);
    await launch.click();
    await expect(page).toHaveURL(
      /\/app\/creative-design\?status=approved&client=approved&view=grid$/,
      { timeout: 45_000 },
    );
    await expect(page.locator('[data-slot="brief-row"]')).toHaveCount(count, { timeout: 45_000 });
  });

  test('the hardcoded approval showcase is gone from the Overview; the metrics stay (AI-6)', async ({
    page,
  }) => {
    await page.goto(appPath);

    // The reference dashboard has no such element: the TwoTrackApproval block with its literal
    // statuses no longer renders on the landing page...
    await expect(page.locator('[data-slot="two-track-approval"]')).toHaveCount(0);
    // ...and nothing else moved: the eleven pipeline cards still render over the fixtures.
    await expect(page.locator('[data-slot="overview-metric"]')).toHaveCount(11);

    // The cross-client shell stays OFF here too — the demo workspace is a single brand, the same
    // fallback a signed-in actor with fewer than two assignments gets. The signed-in multi-brand
    // render needs real assignments and a session, which this environment has neither of; its
    // loading logic is unit-tested on PGlite in dashboard-source.test.ts.
    await expect(page.locator('[data-slot="csm-cards"]')).toHaveCount(0);
  });

  test('the showcase and the new card shell both live on /design-system (governance rule 4)', async ({
    page,
  }) => {
    await page.goto('/design-system');

    // The TwoTrackApproval showcase kept its home among the component stories...
    await expect(page.locator('[data-slot="two-track-approval"]').first()).toBeVisible();
    // ...and the cross-client shell's story is mounted: a derived header line, two brand cards,
    // and the dimmed-zero treatment for the empty book.
    const shell = page.locator('[data-slot="csm-cards"]');
    await expect(shell).toHaveCount(1);
    await expect(shell.locator('[data-slot="csm-card"]')).toHaveCount(2);
    await expect(shell.getByRole('heading', { level: 2 })).toContainText(/client/i);
    expect(
      await shell.locator('[data-slot="csm-card-metric"][data-zero="true"]').count(),
    ).toBeGreaterThan(0);
  });
});
