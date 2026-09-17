import { currentActor } from '@/lib/actor';
import { loadClientQueue } from '@/lib/client-queue-source';
import { DEMO_QUEUE_ASSIGNEE, isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';

import { ClientQueueBoard } from './client-queue-board';
import {
  clientQueueItem,
  CLIENT_QUEUE_FILTER_PARAM,
  parseClientQueueFilter,
  type ClientQueueItem,
} from './fields';

/**
 * Client Queue (PRD §9, §10): every creative the client still owes a decision on, by where it sits
 * on THEIR track. The internal track is team-only and appears nowhere on this page (CLAUDE.md
 * non-negotiable 4 and 10, ticket criterion 4).
 *
 * A server component, shaped exactly like `app/app/queue/internal/page.tsx`. The payload comes from
 * `loadClientQueue()`, which is the in-repo fixtures in demo mode and the brand-scoped read
 * otherwise; this page does not know which and does not branch on it. It renders into the shell's
 * `<main>` and therefore owns no frame, padding or background of its own.
 *
 * EVERY LABEL, TONE AND TILE IS RESOLVED HERE, ONCE. `@/lib/client-queue-source` imports `@tas/db`,
 * so it can only be read on the server; `clientQueueItem` turns each row into a plain item whose
 * status chip, priority chip and thumbnail are already decided, and the board below renders what it
 * is handed. That is what keeps the database driver out of the browser bundle.
 *
 * THE ELIGIBILITY GATE IS NOT THIS PAGE'S JOB and deliberately so: `loadClientQueue()` applies PRD
 * §9's rule at the loader, so a brief the internal track has not signed off never reaches this
 * function at all. What the loader hands over as well is `withheld` — how many it held back — which
 * is the only way this page can say in one muted line why the board is short (criterion 5) without
 * ever touching a row it is not allowed to show.
 *
 * The filter lives in `?filter=`, parsed here by `parseClientQueueFilter` so a reload restores the
 * same board and the address is shareable. Rows arrive newest edit first from `loadBriefs()`, so
 * nothing sorts.
 */
interface ClientQueuePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Who "Mine" means, resolved the way the Internal Queue resolves it. Demo mode answers from a
 * constant and asks Clerk nothing — `currentUser()` would throw without a `ClerkProvider` and
 * middleware — and the constant is a name really on the seeded briefs, so the filter shows real
 * cards instead of reading as a bug.
 */
async function viewerName(demo: boolean): Promise<string> {
  if (demo) {
    return DEMO_QUEUE_ASSIGNEE;
  }
  const actor = await currentActor();
  return actor.fullName;
}

export default async function ClientQueuePage({ searchParams }: ClientQueuePageProps) {
  const demo = isDemoMode();
  const [{ rows, total, withheld }, params, viewer] = await Promise.all([
    loadClientQueue(),
    searchParams,
    viewerName(demo),
  ]);

  const items: ClientQueueItem[] = rows.map((row) => clientQueueItem(row, briefPath(row.id)));

  return (
    <ClientQueueBoard
      items={items}
      viewer={viewer}
      demo={demo}
      total={total}
      withheld={withheld}
      initialFilter={parseClientQueueFilter(params[CLIENT_QUEUE_FILTER_PARAM])}
    />
  );
}
