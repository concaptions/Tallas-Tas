import { expect, test } from '@playwright/test';

import { clerkKeys } from '../src/lib/clerk-keys';
import { appPath, creativeReportingPath } from '../src/lib/routes';

/**
 * Creative Reporting is HIDDEN as of 2026-10-02 (template-base alignment). The Airtable TEMPLATE
 * base `appnaSGAgOUbJ0f9m` became the source of truth and has no table for this module
 * (`docs/audits/template-base-diff-2026-10-02.md`, "Drizzle tables with no table in the template
 * base"), so the sidebar no longer lists it and `/app/creative-reporting` `redirect`s
 * to `/app`.
 *
 * WHAT THIS FILE USED TO ASSERT, AND WHY IT NO LONGER CAN. It covered the
 * `demoCreativeReporting` fixtures in the grid, the panel with a labelled control for every
 * stored Airtable field and the CPA/ROAS-against-target chips, the `?creativeReport=` open
 * state, search in `?q=`, and the phone layout. Every one of those assertions was about a page
 * that this route no longer renders, so they are retired rather than relaxed: there is no weaker
 * version of "the grid shows its rows" that is still true once the route redirects. Nothing
 * underneath them was deleted — the `creative_reporting` table, its query functions, its demo
 * fixtures and this module's `page.tsx` siblings (workspace, panel, `fields.ts`, Server Actions,
 * and the `fields.test.ts` unit tests, which still run) are all in the repo, so restoring this
 * spec is restoring the page. `docs/decisions/data-loss-blockers-2026-10-02.md` says why.
 *
 * The sidebar's side of the claim — that no link to this module is rendered — is asserted once,
 * for all six hidden modules together, in `module-parity.spec.ts`.
 */
const A_FIXTURE_ID = 'c0c0c0c0-c0c0-4c0c-8c0c-000000000001';

test.describe('Creative Reporting is hidden (demo mode, no Clerk publishable key)', () => {
  test.skip(
    clerkKeys() !== undefined,
    'Clerk keys present: this is the demo-mode run; the redirect itself needs no session',
  );

  test('the route redirects to the Overview', async ({ page }) => {
    const response = await page.goto(creativeReportingPath);

    await expect(page).toHaveURL((url) => url.pathname === appPath);
    // The Overview actually rendered; a redirect loop or an error page would not have an h1.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // A `redirect`, so the hop itself is a 307 (temporary — the hide is reversible, and a 308
    // would stay cached after the module came back) and the final document is a 200.
    expect(response?.status()).toBe(200);
  });

  test('a deep link into one record redirects too, and opens no panel', async ({ page }) => {
    await page.goto(`${creativeReportingPath}?creativeReport=${A_FIXTURE_ID}`);

    await expect(page).toHaveURL((url) => url.pathname === appPath);
    // The open-state parameter is dropped with the page it belonged to, not carried to `/app`.
    await expect(page).not.toHaveURL(/creativeReport=/);
  });
});
