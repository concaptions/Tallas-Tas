import type { ReactNode } from 'react';
import type { ChipTone } from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

/**
 * THE COLUMN STRIP, shared by both approval boards (ticket `internal-queue` criteria 2, 3 and 12;
 * ticket `client-queue` criteria 2, 3 and 10).
 *
 * Two boards, one shape: a horizontal strip of fixed-width columns, each headed by a status label
 * from `@tas/domain/state` and a count chip, with the cards inside. The Internal Queue shipped it
 * first; the Client Queue is the same strip over a different vocabulary, so the strip moved here
 * rather than being copied.
 *
 * EMPTY COLUMNS KEEP THEIR PLACE. A stage with nothing in it renders with a count of 0 and a quiet
 * line rather than collapsing, because a board that hides its empty stages hides exactly the work
 * that is not moving.
 *
 * THE STRIP SCROLLS, THE PAGE DOES NOT. `overflow-x-auto` lives on the strip's own container and
 * every ancestor carries `min-w-0`, so at 390px the columns slide inside the board while the shell's
 * `<main>` stays exactly as wide as the viewport. The shell's `overflow-x-hidden` is the backstop,
 * not the mechanism.
 *
 * NEITHER COMPONENT KNOWS A STATUS. It is handed a key, a label, a description, a tone and a count,
 * all resolved from the domain by the board above it; nothing here lists, orders or compares one.
 */

interface QueueStripProps {
  /** `queue-board` or `client-queue-board`: the board's own test handle. */
  readonly slot: string;
  /** Names the scroll region for a screen reader, which reaches it by keyboard. */
  readonly label: string;
  readonly children: ReactNode;
}

export function QueueStrip({ slot, label, children }: QueueStripProps) {
  return (
    <div
      data-slot={slot}
      className="-mx-1 min-w-0 overflow-x-auto px-1 pb-2"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <div className="flex w-max items-start gap-3">{children}</div>
    </div>
  );
}

interface QueueColumnPanelProps {
  /** `queue-column` or `client-queue-column`: the prefix every `data-slot` below is built from. */
  readonly slot: string;
  /** The stored status this column holds, written to `data-status`. Never compared here. */
  readonly statusKey: string;
  readonly label: string;
  /** The domain's own sentence for the status, shown on hover. */
  readonly description: string;
  readonly tone: ChipTone;
  readonly count: number;
  /** `3 briefs` — the board's own wording, so the aria label and the header cannot disagree. */
  readonly countLabel: string;
  /** What an empty column says instead of collapsing. */
  readonly emptyNote: string;
  readonly children: ReactNode;
}

export function QueueColumnPanel({
  slot,
  statusKey,
  label,
  description,
  tone,
  count,
  countLabel,
  emptyNote,
  children,
}: QueueColumnPanelProps) {
  return (
    <section
      data-slot={slot}
      data-status={statusKey}
      data-count={count}
      aria-label={`${label}, ${countLabel}`}
      className="flex w-60 shrink-0 flex-col gap-2 rounded-card border border-line bg-surface2 p-3"
    >
      <header className="flex items-start justify-between gap-2">
        <h3
          data-slot={`${slot}-label`}
          title={description}
          className="min-w-0 text-[11px] font-medium tracking-wide text-text2 uppercase"
        >
          {label}
        </h3>
        <span data-slot={`${slot}-count`}>
          <StatusChip tone={tone} label={String(count)} />
        </span>
      </header>

      {count === 0 ? (
        <p data-slot={`${slot}-empty`} className="py-2 text-xs text-text4">
          {emptyNote}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
