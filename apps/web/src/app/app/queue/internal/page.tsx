import { loadInternalQueue } from '@/lib/internal-queue-source';
import { briefPath } from '@/lib/routes';

import { InternalQueueBoard } from './internal-queue-board';
import { parseQueueView, queueItem, QUEUE_VIEW_PARAM, type QueueItem } from './fields';

/**
 * Internal Queue (PRD §9, §13): every creative on the internal approval track, by the stage it is
 * actually sitting at. The client never sees this board — internal status is team-only (CLAUDE.md
 * non-negotiable 4 and 10).
 *
 * A server component, shaped exactly like `app/app/briefs/page.tsx`. The payload comes from
 * `loadInternalQueue()`, which is the in-repo fixtures in demo mode and the brand-scoped read
 * otherwise; this page does not know which and does not branch on it. It renders into the shell's
 * `<main>` and therefore owns no frame, padding or background of its own.
 *
 * EVERY LABEL, TONE AND TILE IS RESOLVED HERE, ONCE. `@/lib/internal-queue-source` imports
 * `@tas/db`, so it can only be read on the server; `queueItem` turns each row into a plain item
 * whose priority chip is `priorityView`'s and whose thumbnail is `briefThumbnail`'s, and the board
 * below renders what it is handed. That is what keeps the database driver out of the browser bundle.
 *
 * The board OWNS NO QUERY and performs NO WRITE. It reads the same `loadBriefs()` the Creative
 * Briefs list reads (criterion 10), and a status moves on the brief's own detail page, where that
 * transition already lives — which is why this route has no `actions.ts` at all (criterion 11).
 *
 * The filter lives in `?view=`, parsed here by `parseQueueView` so a reload restores the same board
 * and the address is shareable. Rows arrive newest edit first from `loadBriefs()`, so nothing sorts.
 */
interface InternalQueuePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InternalQueuePage({ searchParams }: InternalQueuePageProps) {
  const [{ rows, viewer, brands }, params] = await Promise.all([loadInternalQueue(), searchParams]);

  const items: QueueItem[] = rows.map((row) => queueItem(row, briefPath(row.id)));

  return (
    <InternalQueueBoard
      items={items}
      viewer={viewer}
      brands={brands}
      initialView={parseQueueView(params[QUEUE_VIEW_PARAM])}
    />
  );
}
