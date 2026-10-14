'use client';

import { StatusChip } from '@tas/ui';
import { creatorStatusLabel, creatorStatusTone } from '@tas/domain/state';
import type { RegistryBrandHistoryRow } from '@tas/db';

import { isoDateLabel } from './fields';

export interface BrandHistoryTimelineProps {
  /** The registry rows for this creator across every brand they're in, newest first. */
  readonly entries: readonly RegistryBrandHistoryRow[];
  /** Open by default, so the first open of a creator's panel reveals the timeline without a click. */
  readonly defaultOpen?: boolean;
}

/**
 * The creator's assignment timeline across brands (Ticket 14): one card per per-brand `creators`
 * row, newest first, with the brand name, the current client-status chip in the one creator
 * vocabulary (`CREATOR_STATUS`), the assignment date and the "continue working with" verdict when
 * set. An expandable `<details>` wrapper, so a panel that's just been opened does not blow up to
 * ten brands tall when the viewer only wanted to edit a field.
 *
 * Nothing is re-fetched here — the page preloaded the registry history via `loadRegistryBrandHistory`
 * (Ticket 13 Phase B1), and the aside on the Creator Pool draws the SAME rows with the same chip
 * component. Status labels and tones come from `@tas/domain/state` so the two surfaces cannot drift.
 */
export function BrandHistoryTimeline({ entries, defaultOpen = true }: BrandHistoryTimelineProps) {
  return (
    <details className="group flex flex-col gap-3" data-slot="brand-history" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-line pb-1 text-sm font-medium text-text2">
        <span className="flex items-center gap-2">
          Brand history
          {entries.length > 0 ? (
            <span className="text-xs font-normal text-text3">({entries.length})</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="font-mono text-[11px] text-text3 group-open:hidden">
          Show
        </span>
        <span
          aria-hidden="true"
          className="hidden font-mono text-[11px] text-text3 group-open:inline"
        >
          Hide
        </span>
      </summary>
      {entries.length === 0 ? (
        <p className="text-sm text-text3" data-slot="brand-history-empty">
          No brand history yet. The creator is only on this brand.
        </p>
      ) : (
        <ol
          className="flex flex-col gap-2 border-l-2 border-line pl-3"
          data-slot="brand-history-list"
        >
          {entries.map((entry) => (
            <li
              key={`${entry.brandId}-${entry.createdAt.toISOString()}`}
              data-slot="brand-history-entry"
              data-brand-id={entry.brandId}
              className="relative flex flex-col gap-1 rounded-card border border-line bg-surface2 px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="absolute top-3 -left-[17px] size-2.5 rounded-card border border-line bg-surface"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="truncate text-sm font-medium text-text"
                  data-slot="brand-history-brand"
                >
                  {entry.brandName}
                </span>
                <StatusChip
                  tone={creatorStatusTone(entry.clientStatus)}
                  label={creatorStatusLabel(entry.clientStatus)}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text3">
                <span className="font-mono" data-slot="brand-history-date">
                  Assigned {isoDateLabel(entry.createdAt)}
                </span>
                {entry.continueWorkingWith === null ? null : (
                  <span
                    data-slot="brand-history-continue"
                    data-value={entry.continueWorkingWith ? 'yes' : 'no'}
                    className={entry.continueWorkingWith ? 'text-ok' : 'text-bad'}
                  >
                    {entry.continueWorkingWith ? 'Continue working with' : 'Not continuing'}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
