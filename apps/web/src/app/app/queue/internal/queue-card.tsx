import Link from 'next/link';

import { QueueCardFace } from '@/components/queue/queue-card-face';

import { type QueueItem } from './fields';

/**
 * One brief on the Internal Queue board (ticket `internal-queue` criteria 4, 5 and 6).
 *
 * THE WHOLE CARD IS A LINK. It is an `<a>` and not a `div` with an `onClick`, so Enter activates it,
 * Space scrolls the way Space is supposed to, the browser shows `/app/briefs/<id>` in the status bar,
 * middle-click opens a tab and Back returns to the board with its filter intact — none of which a
 * keydown handler on a `role="button"` can give. The Concepts board predates this and uses the
 * handler; on a card whose only job is navigation, the anchor is the primitive.
 *
 * WHAT THE CARD SHOWS is `QueueCardFace` in `@/components/queue`, which the Client Queue card draws
 * too: four things in one fixed order — the generated NAME in `font-mono` (it is system output,
 * never a typed field, CLAUDE.md non-negotiable 6), the THUMBNAIL, the ASSIGNEE and the PRIORITY
 * chip. This file owns only what makes it an internal card: the anchor around it. Nothing is
 * decided in either place — the tile comes from `briefThumbnail`, the priority chip from
 * `priorityView`, and every colour, radius and font is a token class.
 */
interface QueueCardProps {
  readonly item: QueueItem;
}

export function QueueCard({ item }: QueueCardProps) {
  return (
    <Link
      href={item.href}
      data-slot="queue-card"
      data-brief-id={item.id}
      aria-label={item.name}
      className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-3 hover:border-line2 focus-visible:border-accent-line focus-visible:outline-none"
    >
      <QueueCardFace face={item} slot="queue-card" />
    </Link>
  );
}
