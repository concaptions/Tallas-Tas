'use client';

import { useState, type KeyboardEvent } from 'react';
import { Star } from 'lucide-react';

import { cn } from '../lib/cn';

export const RATING_STARS_DEFAULT_MAX = 5;
export const NOT_RATED_LABEL = 'Not rated';

export interface RatingStarsProps {
  /** The current rating; `null` renders every star empty. */
  value: number | null;
  /** How many stars the scale has; the creator rating is five. */
  max?: number;
  onChange?: (value: number) => void;
  /** A plain row of icons: no buttons, no focus, no change. */
  readOnly?: boolean;
  size?: 'sm' | 'md';
  /** The accessible name of the control (or of the read-only row). */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** "3 of 5 stars", or the unrated line; the text a screen reader hears for the whole control. */
export function ratingLabel(value: number | null, max: number = RATING_STARS_DEFAULT_MAX): string {
  return value === null ? NOT_RATED_LABEL : `${String(value)} of ${String(max)} stars`;
}

/** Whether the star at `position` (1-based) is painted for `value`; a null value paints none. */
export function isStarFilled(position: number, value: number | null): boolean {
  return value !== null && position <= value;
}

/** The next position an arrow key lands on, wrapping at both ends, so Right from the last is the first. */
export function stepStar(current: number | null, delta: 1 | -1, max: number): number {
  if (current === null) return delta === 1 ? 1 : max;
  const next = current + delta;
  if (next < 1) return max;
  if (next > max) return 1;
  return next;
}

const sizeClass = { sm: 'size-3.5', md: 'size-5' } as const;

/**
 * The one star rating in the product (Oct 8 Talal ask: the agency's 1–5 verdict on a creator).
 * Editable, it is a `radiogroup` of `button`s — Left/Right/Up/Down step, Home/End jump, Enter and
 * Space select — so a keyboard user rates exactly as a mouse user does. Read-only, it is a plain
 * row of icons with the rating as its accessible name. Filled stars are the amber `--warn` token,
 * which is what the palette has for a star; empty stars are `--text4`.
 */
export function RatingStars({
  value,
  max = RATING_STARS_DEFAULT_MAX,
  onChange,
  readOnly = false,
  size = 'md',
  label = 'Rating',
  disabled = false,
  className,
}: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const positions = Array.from({ length: max }, (_, index) => index + 1);
  const icon = sizeClass[size];

  const starClass = (position: number, shown: number | null) =>
    cn(
      icon,
      'transition-colors',
      isStarFilled(position, shown) ? 'fill-warn text-warn' : 'fill-transparent text-text4',
    );

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={`${label}: ${ratingLabel(value, max)}`}
        data-slot="rating-stars"
        data-rating={value ?? ''}
        className={cn('inline-flex items-center gap-0.5', className)}
      >
        {positions.map((position) => (
          <Star key={position} aria-hidden="true" className={starClass(position, value)} />
        ))}
        {value === null ? <span className="sr-only">{NOT_RATED_LABEL}</span> : null}
      </span>
    );
  }

  const select = (position: number) => {
    if (!disabled) onChange?.(position);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    const move = (next: number) => {
      event.preventDefault();
      select(next);
      const sibling = event.currentTarget.parentElement?.children[next - 1];
      if (sibling instanceof HTMLElement) sibling.focus();
    };
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        move(stepStar(value, 1, max));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        move(stepStar(value, -1, max));
        break;
      case 'Home':
        move(1);
        break;
      case 'End':
        move(max);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(position);
        break;
      default:
        break;
    }
  };

  const shown = hovered ?? value;
  // One tab stop: the checked star, or the first when nothing is rated yet.
  const focusable = value ?? 1;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-slot="rating-stars"
      data-rating={value ?? ''}
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => {
        setHovered(null);
      }}
    >
      {positions.map((position) => (
        <button
          key={position}
          type="button"
          role="radio"
          aria-checked={value === position}
          aria-label={ratingLabel(position, max)}
          tabIndex={position === focusable ? 0 : -1}
          disabled={disabled}
          onClick={() => {
            select(position);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, position);
          }}
          onMouseEnter={() => {
            if (!disabled) setHovered(position);
          }}
          className="rounded-input p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star aria-hidden="true" className={starClass(position, shown)} />
        </button>
      ))}
    </div>
  );
}
