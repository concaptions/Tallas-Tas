import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3000';

// Playwright launches `webServer` before it discovers tests, so the dev server is declared only once
// apps/web exists (TICKET-002). Until then `--pass-with-no-tests` turns the run into a no-op.
const webAppPresent = existsSync(new URL('./apps/web/package.json', import.meta.url));

export default defineConfig({
  testDir: 'apps/web/e2e',
  fullyParallel: true,
  reporter: 'list',
  /**
   * `webServer` below runs `next dev`, which compiles each route the first time it is REQUESTED,
   * not at startup. So the first click that navigates into a dynamic route — `/app/briefs/[id]`,
   * `/app/concepts/[id]` — waits for that route to be built, and with `fullyParallel` four workers
   * ask for four different uncompiled routes at once. Playwright's default 5s `expect` timeout is
   * shorter than that cold compile, which made the "a row click lands on the detail route" tests
   * fail intermittently while the assertion itself was correct: the URL did change, just later.
   *
   * These two timeouts buy the compile time and nothing else. No assertion is relaxed and no test
   * waits longer once the route is warm — an expectation that is going to hold still resolves on
   * the first poll, and one that is going to fail still fails, just after a longer wait. Retries
   * are deliberately NOT set: a retry would hide a genuine regression behind a second attempt,
   * whereas a timeout that matches how the server actually behaves does not.
   */
  expect: { timeout: 15_000 },
  timeout: 60_000,
  // Fetches a Clerk testing token when keys exist; the Clerk-gated E2E tests skip without them (D-008).
  globalSetup: './apps/web/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: webAppPresent
    ? {
        command: 'pnpm --filter @tas/web dev',
        url: baseURL,
        // The E2E suite is demo mode (no Clerk, in-repo fixtures — the describe blocks
        // `test.skip(clerkKeys() !== undefined)`). The dev server also loads `.env.local`, so a
        // developer with Clerk keys there gets a LIVE server under a demo run: every `/app/*` route
        // 307s to a Clerk sign-in page and all demo tests fail (and cold-start as "Cannot navigate to
        // invalid URL"). Pinning these empty forces the launched server to demo mode regardless of
        // `.env.local` — `@tas/env` treats the empty string as unset, and `@next/env` will not
        // override an already-set process var. (Read via literals, not `process.env`, per the repo's
        // env-access rule; a future live-mode E2E setup would supply real keys here.)
        env: {
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
          CLERK_SECRET_KEY: '',
        },
        // Never reuse a server that happens to be on the port — it may be a live-mode dev server,
        // which is exactly the misconfiguration above. Always start the pinned demo-mode server.
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
