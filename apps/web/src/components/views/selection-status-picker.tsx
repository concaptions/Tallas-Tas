'use client';

import { Button } from '@tas/ui';

/** One target of a bulk status change: a status key and its label. */
export interface SelectionStatusOption {
  readonly key: string;
  readonly label: string;
}

/** One track the picker offers, with the statuses it can move a selection to. */
export interface SelectionStatusTrack {
  readonly key: string;
  readonly label: string;
  readonly options: readonly SelectionStatusOption[];
}

export interface SelectionStatusPickerProps {
  readonly tracks: readonly SelectionStatusTrack[];
  /** The chosen track's key; a key outside `tracks` reads as the first track. */
  readonly track: string;
  /** The chosen status key, or `''` while nothing is picked. */
  readonly value: string;
  /** Demo mode or a write in flight: Apply is held. */
  readonly disabled?: boolean;
  readonly onTrackChange: (track: string) => void;
  readonly onValueChange: (value: string) => void;
  readonly onApply: () => void;
}

const SELECT_CLASS = 'h-8 rounded-input border border-line bg-surface px-2 text-xs text-text';

/**
 * The inline "Change status" control the selection bar opens (B3.A31): a track, a status, Apply.
 * Presentational — the page keeps the chosen pair and runs the write; the component only reports
 * each choice, so `/design-system` can mount it on its own. Native selects on purpose: the bar is
 * a toolbar, and the OS picker is the fastest way through two short lists.
 */
export function SelectionStatusPicker({
  tracks,
  track,
  value,
  disabled = false,
  onTrackChange,
  onValueChange,
  onApply,
}: SelectionStatusPickerProps) {
  const current = tracks.find((candidate) => candidate.key === track) ?? tracks[0];
  return (
    <span className="flex items-center gap-1.5" data-slot="selection-status-picker">
      <select
        value={current?.key ?? track}
        onChange={(event) => {
          onTrackChange(event.target.value);
        }}
        aria-label="Track"
        className={SELECT_CLASS}
      >
        {tracks.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        aria-label="New status"
        data-slot="selection-status-value"
        className={SELECT_CLASS}
      >
        <option value="">Pick a status…</option>
        {(current?.options ?? []).map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        disabled={disabled || value === ''}
        onClick={onApply}
        data-slot="selection-status-apply"
      >
        Apply
      </Button>
    </span>
  );
}
