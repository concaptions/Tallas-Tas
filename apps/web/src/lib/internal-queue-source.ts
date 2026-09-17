import { currentActor } from './actor';
import {
  loadBriefs,
  type BriefListResult,
  type BriefRow,
  type BriefSourceDeps,
  type BriefSourceKind,
} from './briefs-source';
import { currentBrand, type BrandSummary } from './data-source';
import { DEMO_QUEUE_ASSIGNEE, isDemoMode } from './demo-mode';

/**
 * Where the Internal Queue board gets everything it needs, in one call (PRD §9, §13).
 *
 * This is the same demo-mode shape as `personas-source.ts` and `briefs-source.ts` — the guarantee is
 * the same one and it must not drift between routes — with one difference worth stating: the queue
 * OWNS NO QUERY. Ticket `internal-queue.md` criterion 10 is explicit that the board reads the six
 * seeded briefs through the existing `loadBriefs()` and that `packages/db` is untouched, so this
 * module composes rather than fetches. What it adds is the two things the board needs that a row
 * list cannot answer by itself and that a component must not work out for itself:
 *
 *  - the VIEWER the `?view=mine` filter compares against (criterion 9), and
 *  - the BRAND OPTIONS for `?view=brand:<brandId>`, derived from the loaded rows (criterion 8).
 *
 * DEMO MODE (no `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, read through `@tas/env`): the fixtures, by way
 * of `loadBriefs()`. No database client is constructed, no connection is opened and `DATABASE_URL`
 * is never read, even when it is set — every branch here returns before `serverEnv()` is reached,
 * and `internal-queue-source.test.ts` proves it with an injected connection factory that throws if
 * it is ever called. The viewer resolves to `DEMO_QUEUE_ASSIGNEE`, a name that is really on the
 * seeded briefs, so "Mine" shows real cards instead of an empty board.
 *
 * LIVE MODE (Clerk configured): `loadBriefs()` opens and closes its own Neon connection, the viewer
 * is the actor's full name from `currentActor()`, and the brand label comes from `currentBrand()`.
 *
 * There are NO writes on this route and therefore no Server Action in this feature — see the note
 * at the foot of `docs/tickets/in-progress/internal-queue.md`. The queue is a view over briefs; a
 * status moves on the brief's own detail page, where that transition already lives.
 */

/** One entry of the `?view=brand:<brandId>` control, with the number of briefs behind it. */
export interface QueueBrandOption {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

export interface InternalQueueResult {
  readonly rows: BriefRow[];
  readonly source: BriefSourceKind;
  /** The name "Mine" is compared against — never an id, because `briefs.assignee` is a name. */
  readonly viewer: string;
  /** Derived from the rows, never a hardcoded list. Empty when the board is empty. */
  readonly brands: QueueBrandOption[];
}

/**
 * Seams, for tests only. Production calls `loadInternalQueue()` with no argument.
 *
 * `demoMode` and `connect` are `BriefSourceDeps` and are handed STRAIGHT DOWN to `loadBriefs`, so
 * the connect spy that proves "no client was constructed" reaches the real read path rather than a
 * stub of it. `briefs`, `actor` and `brand` exist so the live branch can be exercised without Clerk
 * and without a database.
 */
export interface InternalQueueDeps extends BriefSourceDeps {
  readonly briefs?: (deps: BriefSourceDeps) => Promise<BriefListResult>;
  readonly actor?: () => Promise<{ readonly fullName: string }>;
  readonly brand?: () => Promise<BrandSummary | null>;
}

/**
 * The brands the loaded rows actually belong to, first-seen order, each with its own count.
 *
 * Pure, so the derivation is testable without a loader. `brand` is the working brand from
 * `currentBrand()`; its name labels the option whose id matches. Any other id — which a brand-scoped
 * query cannot produce today, but a multi-brand switcher will — is labelled with the id itself
 * rather than being dropped, because a card belonging to no offered option would be unreachable.
 */
export function queueBrandOptions(
  rows: readonly BriefRow[],
  brand: BrandSummary | null,
): QueueBrandOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.brandId, (counts.get(row.brandId) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({
    id,
    name: brand !== null && brand.id === id ? brand.name : id,
    count,
  }));
}

function inDemoMode(deps: InternalQueueDeps): boolean {
  return (deps.demoMode ?? isDemoMode)();
}

/**
 * Who "Mine" means. Demo mode answers from a constant and asks Clerk nothing — `currentUser()`
 * would throw without a `ClerkProvider` and middleware — so this branch has to come first.
 */
async function viewerName(deps: InternalQueueDeps): Promise<string> {
  if (inDemoMode(deps)) {
    return DEMO_QUEUE_ASSIGNEE;
  }
  const actor = await (deps.actor ?? currentActor)();
  return actor.fullName;
}

/**
 * The board's whole payload: the briefs in `updated_at` order (nothing here sorts or filters —
 * grouping is `groupByInternalStatus` in `@tas/domain/state`, filtering is the page's own
 * `parseQueueView`), the viewer, and the brand options.
 */
export async function loadInternalQueue(
  deps: InternalQueueDeps = {},
): Promise<InternalQueueResult> {
  const read: BriefSourceDeps = { demoMode: deps.demoMode, connect: deps.connect };
  const { rows, source } = await (deps.briefs ?? loadBriefs)(read);
  const [viewer, brand] = await Promise.all([viewerName(deps), (deps.brand ?? currentBrand)()]);
  return { rows, source, viewer, brands: queueBrandOptions(rows, brand) };
}
