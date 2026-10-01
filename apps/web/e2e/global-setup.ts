import { clerkSetup } from '@clerk/testing/playwright';

import { clerkKeys } from '../src/lib/clerk-keys';
import { liveE2eEnv } from '../src/lib/live-e2e-env';

/**
 * Fetches a Clerk testing token (bypasses bot protection on the dev instance) when keys exist: the
 * live-mode pair (`CLERK_*_TEST`, docs/runbook.md "Playwright live mode") first, else the app's own
 * pair. Without either the Clerk-gated tests skip themselves (D-008). `clerkSetup` stores the token
 * in this process's environment, which Playwright hands to every worker.
 */
export default async function globalSetup(): Promise<void> {
  const live = liveE2eEnv();
  const keys =
    live === undefined
      ? clerkKeys()
      : { publishableKey: live.publishableKey, secretKey: live.secretKey };
  if (keys !== undefined) {
    await clerkSetup(keys);
  }
}
