/**
 * The character guidance on a copy row (PRD §5.11: "~125 characters", "~40 characters",
 * "~27 characters"), and the counter the detail panel renders live under each field.
 *
 * The tilde is the whole design. These are Meta's rendering thresholds — past them the ad is
 * truncated in the feed, not rejected — so going over is a thing the copywriter should SEE and then
 * decide about, never a thing that blocks a save. That is why `validateCopyDraft` reports a length
 * as a typed warning with the exact overage and keeps `ok` true, and why nothing here throws or
 * truncates: this module measures, the panel renders, and the writer chooses.
 *
 * One implementation, three callers: the panel's counter, the panel's save-time messages, and the
 * Server Action that re-checks before it writes. No component counts characters itself and no
 * component re-types `125`.
 */

/** The three fields that carry a limit, with the PRD's numbers. Keys are the row's column names. */
export const COPY_LIMITS = {
  primaryCopy: 125,
  headline: 40,
  linkDescription: 27,
} as const;

export type CopyLimitField = keyof typeof COPY_LIMITS;

/** The limited fields in the order the panel stacks them (ticket criterion 6). */
export const COPY_LIMIT_FIELDS = [
  'primaryCopy',
  'headline',
  'linkDescription',
] as const satisfies readonly CopyLimitField[];

/**
 * The field labels, so the panel, the helper text and a validation message all name a field the same
 * way. `linkDescription` is the PRD's own two-part name for it.
 */
export const COPY_FIELD_LABELS = {
  primaryCopy: 'Primary Copy',
  headline: 'Headline',
  linkDescription: 'News Feed / Link Description',
} as const satisfies Record<CopyLimitField, string>;

/**
 * How long a draft is, as a person counts it.
 *
 * Two decisions, both visible in the tests:
 *
 *  - Leading and trailing whitespace does not count. It is not copy, it is not stored (the write
 *    path trims), and a counter that ticks up while somebody holds the space bar is lying about how
 *    much room is left.
 *  - Graphemes, not UTF-16 units, so one glyph counts as one character. `'🔥'.length` is 2 and
 *    `'👩‍👩‍👧'.length` is 8, which would tell a copywriter they had spent eight characters on one
 *    emoji. `Intl.Segmenter` is the only thing that counts the way the person typing does, and it
 *    is built into the platform — no dependency, and one segmenter for the module rather than one
 *    per keystroke.
 */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function copyLength(text: string | null | undefined): number {
  return Array.from(GRAPHEMES.segment((text ?? '').trim())).length;
}

/**
 * How far past `limit` a draft is: `0` when it is at or under, the overage otherwise.
 *
 * A limit that is not a finite number means no limit, so a field this build has no guidance for is
 * never reported as over by `NaN` characters.
 */
export function overBy(text: string | null | undefined, limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }
  return Math.max(0, copyLength(text) - limit);
}

/** `true` only past the limit. Exactly at the limit is fine — `~27` means 27 fits. */
export function isOverLimit(text: string | null | undefined, limit: number): boolean {
  return overBy(text, limit) > 0;
}

/** The limit for one field, so a caller holding a field key never re-types the number. */
export function copyLimitFor(field: CopyLimitField): number {
  return COPY_LIMITS[field];
}

/** Everything the live counter under a field needs, in one read. */
export interface CopyCounter {
  readonly field: CopyLimitField;
  readonly label: string;
  readonly length: number;
  readonly limit: number;
  /** How far over, `0` when within. */
  readonly over: number;
  /** Characters left; negative once over, which is what a counter shows. */
  readonly remaining: number;
}

/** The counter for one field of a draft. Pure, total, and cheap enough to call per keystroke. */
export function copyCounter(field: CopyLimitField, text: string | null | undefined): CopyCounter {
  const limit = COPY_LIMITS[field];
  const length = copyLength(text);
  return {
    field,
    label: COPY_FIELD_LABELS[field],
    length,
    limit,
    over: Math.max(0, length - limit),
    remaining: limit - length,
  };
}
