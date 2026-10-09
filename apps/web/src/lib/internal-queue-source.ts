import { currentActor } from './actor';
import {
  loadBriefCountsByBrand,
  loadBriefs,
  type BriefListResult,
  type BriefRow,
  type BriefSourceDeps,
  type BriefSourceKind,
} from './briefs-source';
import { loadBrandScope, type BrandSummary } from './data-source';
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
 * is the actor's full name from `currentActor()`, and the brand options come from `loadBrandScope()`.
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
  /** The brands of the agency in scope — the switcher's own list (`loadBrandScope`). */
  readonly brands?: () => Promise<readonly BrandSummary[]>;
  /** Live briefs per brand id, across the scope (`loadBriefCountsByBrand`). */
  readonly counts?: (brandIds: readonly string[]) => Promise<ReadonlyMap<string, number>>;
}

/**
 * The brand options the board offers: every brand of the agency in scope — the same list the top
 * bar's switcher draws from `loadBrandScope` — in scope order, the parent template left out, each
 * with ITS OWN live brief count from `counts`, an aggregate across the scope. The loaded rows are
 * scoped to the WORKING brand, so counting them showed "· 0" beside every other brand (SMOKE-09:
 * Gratsi with 390 live creatives) and, before that, only ever found one brand (SMOKE-06). A row
 * whose brand is not in scope — which a brand-scoped query cannot produce today — is still listed,
 * by id and by its rows, so no card is ever unreachable. Pure, so the derivation is testable
 * without a loader.
 */
export function queueBrandOptions(
  brands: readonly BrandSummary[],
  counts: ReadonlyMap<string, number>,
  rows: readonly BriefRow[],
): QueueBrandOption[] {
  const scoped = brands
    .filter((brand) => !brand.isTemplate)
    .map(({ id, name }) => ({ id, name, count: counts.get(id) ?? 0 }));
  const known = new Set(scoped.map((brand) => brand.id));
  const unscoped = new Map<string, number>();
  for (const row of rows) {
    if (!known.has(row.brandId)) unscoped.set(row.brandId, (unscoped.get(row.brandId) ?? 0) + 1);
  }
  return [...scoped, ...[...unscoped].map(([id, count]) => ({ id, name: id, count }))];
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
  const [viewer, brands] = await Promise.all([
    viewerName(deps),
    (deps.brands ?? (async () => (await loadBrandScope(read)).options))(),
  ]);
  const ids = brands.filter((brand) => !brand.isTemplate).map((brand) => brand.id);
  const counts = await (deps.counts ?? ((brandIds) => loadBriefCountsByBrand(brandIds, read)))(ids);
  return { rows, source, viewer, brands: queueBrandOptions(brands, counts, rows) };
}
