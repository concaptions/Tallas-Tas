import { StatusChip } from '@tas/ui';

import { UNASSIGNED_LABEL, type QueueFace } from './queue-face';

/**
 * THE FACE OF A QUEUE CARD, shared by both approval boards (ticket `internal-queue` criteria 4–6,
 * ticket `client-queue` criterion 7).
 *
 * The Internal Queue shipped first and drew this itself. The Client Queue shows the SAME four
 * things — the §7 generated NAME in `font-mono`, the THUMBNAIL tile, the ASSIGNEE and the PRIORITY
 * chip — so the drawing moved here rather than being copied: one board gaining a fifth field, or a
 * tile changing its treatment, must not be able to leave the other board looking different.
 *
 * WHAT STAYS WITH EACH BOARD is everything the two genuinely disagree about: the internal card is a
 * bare `next/link` anchor, while the client card has to be a container (an anchor may not contain
 * the two write buttons PRD §10 gives the client). So this renders the face and nothing around it —
 * no link, no border, no padding — and each route wraps it in the element that route actually needs.
 *
 * `slot` prefixes every `data-slot` so the two boards keep separate test handles (`queue-card-name`
 * and `client-queue-card-name`) out of one implementation. The shape it is handed and the word it
 * shows for an empty assignee live in `./queue-face`, a plain module a unit test can reach.
 *
 * NOTHING IS DECIDED HERE. The tile's word and its source come from `briefThumbnail` in
 * `@tas/domain/creatives`, resolved on the server; the priority label and tone from `priorityView`,
 * which the Creative Briefs route owns. A brief with no priority renders no chip at all rather than
 * an empty pill, and every colour, radius and font is a token class — no hex, no `rounded-full`.
 */

interface QueueCardFaceProps {
  readonly face: QueueFace;
  /** `queue-card` or `client-queue-card`: the prefix every `data-slot` below is built from. */
  readonly slot: string;
}

/**
 * The tile, drawn entirely from the token layer: no image is fetched and nothing is measured. The
 * design file is the creative itself, so it gets the accent treatment; a borrowed reference and the
 * name fallback stay quiet, because the tile must never out-shout the name above it.
 */
export function QueueThumbnailTile({ face, slot }: QueueCardFaceProps) {
  const { thumbnail } = face;
  const accent = thumbnail.source === 'design-file';

  return (
    <span
      data-slot={`${slot}-thumb`}
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

/** Name, tile, assignee, priority — in that fixed order, on both boards. */
export function QueueCardFace({ face, slot }: QueueCardFaceProps) {
  return (
    <>
      <p
        data-slot={`${slot}-name`}
        className="font-mono text-xs leading-snug break-words text-text"
      >
        {face.name}
      </p>

      <div className="flex min-w-0 items-center gap-2.5">
        <QueueThumbnailTile face={face} slot={slot} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span
            data-slot={`${slot}-assignee`}
            className={[
              'min-w-0 truncate text-xs',
              face.assignee === null ? 'text-text4 italic' : 'text-text2',
            ].join(' ')}
          >
            {face.assignee ?? UNASSIGNED_LABEL}
          </span>
          {face.priority === null ? null : (
            <span data-slot={`${slot}-priority`} className="flex min-w-0">
              <StatusChip tone={face.priority.tone} label={face.priority.label} />
            </span>
          )}
        </div>
      </div>
    </>
  );
}
