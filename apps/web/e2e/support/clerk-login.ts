import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, test as base } from '@playwright/test';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { appPath, signInPath } from '../../src/lib/routes';

export interface WorkerSession {
  /** The storage state file this worker's pages start from. */
  readonly storageStatePath: string;
  /** The signed-in user as the shell names them (`[data-slot="user-menu"]`'s label). */
  readonly displayName: string;
}

/**
 * `test` for the live-mode specs (docs/runbook.md, "Playwright live mode"): signs the E2E user in
 * ONCE per worker through Clerk's testing token and the password strategy, saves the browser
 * storage state under the run's output directory, and starts every page of that worker from it.
 * Each page also carries the testing token, so Clerk's bot protection never trips on a frontend
 * API call. Playwright empties the output directory at the start of a run, so a run always signs
 * in afresh; only a restarted worker reuses its file.
 *
 * Gate the describe with `test.skip(liveE2eEnv() === undefined, …)` first: this fixture throws
 * without the live variables rather than silently running against a demo server.
 */
// Playwright's `extend<TestFixtures, WorkerFixtures>` has no way to say "no test fixtures" except an
// empty object type; the worker fixture is the point of this file.
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
export const test = base.extend<Record<never, never>, { workerSession: WorkerSession }>({
  workerSession: [
    async ({ browser }, use, workerInfo) => {
      const live = liveE2eEnv();
      if (live === undefined) {
        throw new Error(
          'clerk-login: live-mode variables absent; gate the test on liveE2eEnv() first.',
        );
      }
      const storageStatePath = join(
        workerInfo.project.outputDir,
        '.auth',
        `worker-${String(workerInfo.parallelIndex)}.json`,
      );
      // A context made from `browser` directly carries none of the project's `use` options, so
      // the live project's baseURL is passed by hand; relative `goto`s below depend on it.
      const baseURL = workerInfo.project.use.baseURL;
      if (!existsSync(storageStatePath)) {
        mkdirSync(dirname(storageStatePath), { recursive: true });
        const page = await browser.newPage({ baseURL });
        // Clerk's helper needs a public page that loads Clerk before it can sign in.
        await page.goto(signInPath);
        await clerk.signIn({
          page,
          signInParams: {
            strategy: 'password',
            identifier: live.userEmail,
            password: live.userPassword,
          },
        });
        await page.goto(appPath);
        await clerk.loaded({ page });
        await expect(page.locator('[data-slot="user-menu"]')).toBeVisible();
        await page.context().storageState({ path: storageStatePath });
        await page.close();
      }

      const context = await browser.newContext({ baseURL, storageState: storageStatePath });
      const page = await context.newPage();
      await setupClerkTestingToken({ page });
      await page.goto(appPath);
      const label =
        (await page.locator('[data-slot="user-menu"]').getAttribute('aria-label')) ?? '';
      await context.close();

      await use({
        storageStatePath,
        displayName: label.replace(/^Account:\s*/, '').trim(),
      });
    },
    { scope: 'worker' },
  ],
  storageState: async ({ workerSession }, use) => {
    await use(workerSession.storageStatePath);
  },
  page: async ({ page }, use) => {
    await setupClerkTestingToken({ page });
    await use(page);
  },
});

export { expect };
