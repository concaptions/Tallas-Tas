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
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: webAppPresent
    ? {
        command: 'pnpm --filter @tas/web dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
