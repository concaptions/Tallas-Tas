import { createAutoDb, restoreBrief, snapshotBrief, type BriefSnapshot } from '@tas/db';

import { liveE2eEnv } from '../../src/lib/live-e2e-env';
import { test as base } from './clerk-login';

export interface BriefGuard {
  /**
   * Snapshot a brief before the test changes it. The fixture restores every tracked brief in
   * teardown, whether the test passed or not; `restoreBrief` is idempotent, so a retry that tracks
   * the same brief again is harmless.
   */
  readonly track: (briefId: string) => Promise<BriefSnapshot>;
  /** The brief as the database holds it now, without tracking it: for asserting what a write did. */
  readonly inspect: (briefId: string) => Promise<BriefSnapshot>;
}

/**
 * `test` for live specs that write to the E2E database: the signed-in worker from `clerk-login`
 * plus a `briefGuard` that puts each tracked brief back (status, assignee, activity rows) when the
 * test ends. The database handle is opened per test and closed in the same teardown.
 */
export const test = base.extend<{ briefGuard: BriefGuard }>({
  // Playwright fixtures declare their dependencies by destructuring; this one has none.
  // eslint-disable-next-line no-empty-pattern
  briefGuard: async ({}, use) => {
    const live = liveE2eEnv();
    if (live === undefined) {
      throw new Error(
        'brief-reset: live-mode variables absent; gate the test on liveE2eEnv() first.',
      );
    }
    const db = createAutoDb(live.databaseUrl);
    const tracked: BriefSnapshot[] = [];
    try {
      await use({
        track: async (briefId) => {
          const snapshot = await snapshotBrief(db, briefId);
          tracked.push(snapshot);
          return snapshot;
        },
        inspect: (briefId) => snapshotBrief(db, briefId),
      });
    } finally {
      for (const snapshot of tracked) {
        await restoreBrief(db, snapshot);
      }
      await db.$client.end();
    }
  },
});

export { expect } from './clerk-login';
