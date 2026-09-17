import { clientQueueRows } from '@tas/domain/state';

import {
  loadBriefs,
  type BriefListResult,
  type BriefRow,
  type BriefSourceDeps,
  type BriefSourceKind,
} from './briefs-source';

/**
 * Where the Client Queue board gets its rows (PRD §9, §10 — ticket `client-queue` criterion 6).
 *
 * The same demo-mode shape as `personas-source.ts`, `briefs-source.ts` and `internal-queue-source.ts`
 * — the guarantee is one guarantee and it must not drift between routes — and, like the Internal
 * Queue, this module OWNS NO QUERY. Ticket criterion 5 is explicit that the board reads the seeded
 * briefs through the existing `loadBriefs()` and that `packages/db` is untouched, so this composes
 * rather than fetches.
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the in-repo fixtures,
 * by way of `loadBriefs()`. No database client is constructed, no connection is opened and
 * `DATABASE_URL` is never read, even when it is set — every branch returns before `serverEnv()` is
 * reached, and `client-queue-source.test.ts` proves it with an injected connection factory that
 * throws if it is ever called. That factory is handed STRAIGHT DOWN to `loadBriefs`, so the spy
 * watches the real read path rather than a stub of it.
 *
 * LIVE MODE (Clerk configured): `loadBriefs()` opens and closes its own Neon connection and goes
 * through the brand-scoped `listBriefs`, which puts `brand_id` on the statement.
 *
 * WHAT THIS MODULE ADDS is the one thing the page must not be able to forget: PRD §9's ELIGIBILITY
 * GATE is applied HERE, at the loader, not only at the renderer. "A creative appears in the client's
 * interface **only** when Internal Status = Approved" is a rule about the data — a brief the internal
 * track has not signed off must not leave this function at all, so no component, story or future
 * caller can put one on a page a client sees. The gate itself is `clientQueueRows` from
 * `@tas/domain/state` (which is `isClientTrackOpen`, once, in the domain); nothing here compares a
 * status to a literal, and `isOnClientQueue` in the page's `fields.ts` and `groupByClientStatus` both
 * re-apply the same predicate, which is a no-op rather than a second opinion.
 */
export type ClientQueueSourceKind = BriefSourceKind;

export interface ClientQueueResult {
  /** Only the briefs PRD §9 lets a client see, in loader order (`updated_at` desc). Nothing sorts. */
  readonly rows: BriefRow[];
  readonly source: ClientQueueSourceKind;
  /** Every brief loaded, before the gate. The board is a subset of this, never of something else. */
  readonly total: number;
  /**
   * `total - rows.length`: the briefs internal sign-off is still holding back. Carried so the page can
   * say in one muted line WHY the board is short (ticket criterion 5) instead of looking broken, and
   * so it can say it without counting withheld rows itself — it never receives them.
   */
  readonly withheld: number;
}

/**
 * Seams, for tests only. Production calls `loadClientQueue()` with no argument.
 *
 * `demoMode` and `connect` are `BriefSourceDeps` and are passed straight to `loadBriefs`; `briefs`
 * exists so the live branch can be exercised without Clerk and without a database.
 */
export interface ClientQueueDeps extends BriefSourceDeps {
  readonly briefs?: (deps: BriefSourceDeps) => Promise<BriefListResult>;
}

/**
 * The board's whole payload. Grouping into columns is `groupByClientStatus` in `@tas/domain/state`
 * and filtering by view is the page's own concern; this returns rows, their provenance, and the two
 * counts the "why is this short" line is written from.
 */
export async function loadClientQueue(deps: ClientQueueDeps = {}): Promise<ClientQueueResult> {
  const read: BriefSourceDeps = { demoMode: deps.demoMode, connect: deps.connect };
  const { rows, source } = await (deps.briefs ?? loadBriefs)(read);
  const eligible = [...clientQueueRows(rows)];
  return { rows: eligible, source, total: rows.length, withheld: rows.length - eligible.length };
}
