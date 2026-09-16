/**
 * The "used by N brands" line every theme card carries (PRD §5.5: the library is shared, so the
 * one number that matters about a theme is how many brands have actually reached for it).
 *
 * It exists as a function because the sentence is wrong at both ends of the range: zero must not
 * read "Used by 0 brands" and one must not read "Used by 1 brands". A component that interpolates
 * the count itself gets both cases wrong, so no component interpolates the count itself.
 */

/** Themes with no concepts at all — a valid row, because concept links are nullable. */
export const NO_USAGE_LABEL = 'Used by no brands yet';

/**
 * The card's usage line for a distinct-brand count.
 *
 * `usageLabel(0)` is `'Used by no brands yet'`, `usageLabel(1)` is `'Used by 1 brand'` and
 * `usageLabel(4)` is `'Used by 4 brands'`.
 *
 * A negative count cannot come out of the aggregate, but it is folded into the zero case rather
 * than rendered, because "Used by -1 brands" on a card is worse than a slightly generous label.
 */
export function usageLabel(count: number): string {
  if (!Number.isFinite(count)) {
    return NO_USAGE_LABEL;
  }
  // Floored before the zero test, so a fractional count can only ever round *down* into the
  // wordier label and never produce "Used by 0 brands".
  const whole = Math.floor(count);
  if (whole <= 0) {
    return NO_USAGE_LABEL;
  }
  return whole === 1 ? 'Used by 1 brand' : `Used by ${String(whole)} brands`;
}
