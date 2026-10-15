'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * The shape every caller reads: ISO `YYYY-MM-DD` or `null`. The primitive stays agnostic — it
 * never knows the brief shape, the time zone, or the storage column. The caller normalises its
 * stored timestamp to a local-date ISO before passing it in and widens the ISO back to a
 * timestamp on commit.
 */
export interface DatePickerProps {
  readonly value: string | null;
  readonly onChange: (next: string | null) => void;
  /** Optional lower bound, ISO `YYYY-MM-DD`. */
  readonly min?: string;
  /** Optional upper bound, ISO `YYYY-MM-DD`. */
  readonly max?: string;
  /** Shown when `value` is `null`. The browser displays its own placeholder on top of this one. */
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly dataSlot?: string;
  /** Optional id for a `<label htmlFor>`. */
  readonly id?: string;
}

/**
 * `DatePicker` (Phase B5 Fix A, 2026-10-15): the primitive the sidebar, the dialog and the grid
 * cell read for a `date` field.
 *
 * NATIVE BY DESIGN. Neither `react-day-picker` nor `@radix-ui/react-popover` is in the repo today
 * (D-033, docs/decisions.md 2026-10-15): a native `<input type="date">` wrapped in the token
 * surface meets the user's named need, works on every modern browser's keyboard and screen reader
 * for free, and keeps the 500 USD/yr budget intact. A richer picker (year-nav header, keyboard
 * month jumps) is a one-ticket upgrade to `react-day-picker` the day the team asks.
 *
 * The wrapper carries `rounded-input bg-surface border border-line` so the control matches the
 * other inline editors; the `<input>` itself clears the browser's default border so it does not
 * stack two borders on the user. `min`/`max` reach the native validation, so a bad date never
 * submits a bad commit.
 *
 * TIMEZONE RULE. The caller passes an ISO `YYYY-MM-DD` and gets one back; both are LOCAL dates,
 * not UTC. A date value is a calendar day — "due Friday" — and the brief's own storage column
 * carries a `timestamptz` whose caller normalises to a local-date string before this primitive
 * sees it (D-033 §3 in docs/decisions.md).
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  ariaLabel,
  className,
  dataSlot = 'date-picker',
  id,
}: DatePickerProps): React.ReactElement {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const raw = event.target.value;
      onChange(raw === '' ? null : raw);
    },
    [onChange],
  );

  return (
    <div
      data-slot={dataSlot}
      aria-disabled={disabled || undefined}
      className={cn(
        'inline-flex items-center rounded-input border border-line bg-surface px-2 py-1',
        'focus-within:ring-[3px] focus-within:ring-accent-soft',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <input
        id={id}
        type="date"
        data-slot="date-picker-input"
        value={value ?? ''}
        min={min}
        max={max}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          'w-full border-0 bg-transparent font-mono text-xs text-text2 outline-none',
          disabled && 'cursor-not-allowed',
        )}
      />
    </div>
  );
}
