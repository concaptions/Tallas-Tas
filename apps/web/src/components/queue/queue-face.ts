import type { BriefThumbnail } from '@tas/domain/creatives';

import type { BriefPriorityView } from '@/app/app/briefs/fields';

/**
 * What a queue card shows, and the one word it says when a field is empty — shared by both approval
 * boards (ticket `internal-queue` criterion 4, ticket `client-queue` criterion 7).
 *
 * A plain `.ts` module rather than part of `queue-card-face.tsx` on purpose: `apps/web` compiles JSX
 * with `"jsx": "preserve"` (Next.js owns the transform), so a `.tsx` file cannot be pulled into the
 * vitest graph. Keeping the TYPE and the LABEL here lets a unit test reach them — and lets a fields
 * module re-export them — without dragging a component into a test run that cannot parse it.
 */

/** The sentence a card's empty assignee shows, so an unassigned brief reads as unassigned. */
export const UNASSIGNED_LABEL = 'Unassigned';

/**
 * The minimum a board's item has to carry to be drawn. Structural, so `QueueItem` and
 * `ClientQueueItem` satisfy it without either being mapped or re-narrowed on the way in.
 */
export interface QueueFace {
  /** The §7 generated name. Rendered in `font-mono` because it is system output (CLAUDE.md). */
  readonly name: string;
  readonly assignee: string | null;
  /** `null` for a brief nobody has prioritised: the card shows no chip, never a blank pill. */
  readonly priority: BriefPriorityView | null;
  readonly thumbnail: BriefThumbnail;
}
