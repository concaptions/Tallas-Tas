import { clerkSetup } from '@clerk/testing/playwright';

import { clerkKeys } from '../src/lib/clerk-keys';

/**
 * Fetches a Clerk testing token (bypasses bot protection on the dev instance) only when both keys
 * exist. Without them the Clerk-gated tests in auth.spec.ts skip themselves (D-008).
 */
export default async function globalSetup(): Promise<void> {
  const keys = clerkKeys();
  if (keys !== undefined) {
    await clerkSetup(keys);
  }
}
