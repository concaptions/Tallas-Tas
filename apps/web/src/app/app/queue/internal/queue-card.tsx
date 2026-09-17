import Link from 'next/link';
import { StatusChip } from '@tas/ui';

import { UNASSIGNED_LABEL, type QueueItem } from './fields';

/**
 * One brief on the Internal Queue board (ticket `internal-queue` criteria 4, 5 and 6).
 *
 * THE WHOLE CARD IS A LINK. It is an `<a>` and not a `div` with an `onClick`, so Enter activates it,
 * Space scrolls the way Space is supposed to, the browser shows `/app/briefs/<id>` in the status bar,
 * middle-click opens a tab and Back returns to the board with its filter intact — none of which a
 * keydown handler on a `role="button"` can give. The Concepts board predates this and uses the
 * handler; on a card whose only job is navigation, the anchor is the primitive.
 *
 * Four things in one fixed order: the generated NAME in `font-mono` (it is system output, never a
 * typed field, CLAUDE.md non-negotiable 6), the THUMBNAIL, the ASSIGNEE and the PRIORITY chip.
 *
 * Nothing is decided here. The tile's word and its source come from `briefThumbnail` in
 * `@tas/domain/creatives`; the priority label and tone from `priorityView`, which the Creative Briefs
 * route owns. A brief with no priority renders no chip at all rather than an empty pill, and every
 * colour, radius and font is a token class — no hex, no `rounded-full`.
 */
interface QueueCardProps {
  readonly item: QueueItem;
}

/**
 * The tile, drawn entirely from the token layer: no image is fetched and nothing is measured. The
 * design file is the creative itself, so it gets the accent treatment; a borrowed reference and the
 * name fallback stay quiet, because the tile must never out-shout the name above it.
 */
function ThumbnailTile({ item }: QueueCardProps) {
  const { thumbnail } = item;
  const accent = thumbnail.source === 'design-file';

  return (
    <span
      data-slot="queue-card-thumb"
      data-thumb-source={thumbnail.source}
      title={thumbnail.url ?? thumbnail.alt}
      aria-label={thumbnail.alt}
      role="img"
      className={[
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-input border px-1 text-center',
        accent
          ? 'border-accent-line bg-accent-soft text-accent'
          : 'border-line bg-surface3 text-text3',
      ].join(' ')}
    >
      <span className="w-full truncate font-mono text-[9px] leading-none tracking-tight uppercase">
        {thumbnail.label}
      </span>
    </span>
  );
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
      <p
        data-slot="queue-card-name"
        className="font-mono text-xs leading-snug break-words text-text"
      >
        {item.name}
      </p>

      <div className="flex min-w-0 items-center gap-2.5">
        <ThumbnailTile item={item} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            data-slot="queue-card-assignee"
            className={[
              'min-w-0 truncate text-xs',
              item.assignee === null ? 'text-text4 italic' : 'text-text2',
            ].join(' ')}
          >
            {item.assignee ?? UNASSIGNED_LABEL}
          </span>
          {item.priority === null ? null : (
            <span data-slot="queue-card-priority" className="flex min-w-0">
              <StatusChip tone={item.priority.tone} label={item.priority.label} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
