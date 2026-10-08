/**
 * Creator performance rating (Oct 8 Talal ask): the agency's 1–5 verdict on a creator FOR ONE
 * BRAND, with an optional note. The cross-brand roll-up on `creator_registry.avg_rating` is the
 * integer-rounded mean of every live per-brand rating; `computeRegistryAverage` is the reference
 * implementation the database trigger (migration 0056) must agree with, and the tests pin both.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const RATING_NOTE_MAX = 1000;

export type Rating = 1 | 2 | 3 | 4 | 5;

export function isRating(value: unknown): value is Rating {
  return (
    Number.isInteger(value) && (value as number) >= RATING_MIN && (value as number) <= RATING_MAX
  );
}

/** Accepts the number itself or the string a form field submits; anything else is null. */
export function parseRating(value: unknown): Rating | null {
  const numeric = typeof value === 'string' ? Number(value.trim()) : value;
  return isRating(numeric) ? numeric : null;
}

export interface CreatorRatedEvent {
  readonly type: 'creator.rated';
  readonly creatorId: string;
  readonly rating: Rating;
  readonly note: string | null;
  readonly actorUserId: string;
  readonly ratedAt: Date;
}

export function rateCreatorForBrand(
  creatorId: string,
  rating: number,
  note: string | null | undefined,
  actorUserId: string,
  now: Date = new Date(),
): CreatorRatedEvent {
  if (!isRating(rating)) {
    throw new RangeError(
      `rating must be a whole number from ${String(RATING_MIN)} to ${String(RATING_MAX)}`,
    );
  }
  if (actorUserId.trim() === '') {
    throw new RangeError('a rating needs the user who gave it');
  }
  const trimmed = note?.trim() ?? '';
  if (trimmed.length > RATING_NOTE_MAX) {
    throw new RangeError(`note must be at most ${String(RATING_NOTE_MAX)} characters`);
  }
  return {
    type: 'creator.rated',
    creatorId,
    rating,
    note: trimmed === '' ? null : trimmed,
    actorUserId,
    ratedAt: now,
  };
}

/** Integer mean, rounded half up; null when there is nothing to average. */
export function computeRegistryAverage(ratings: readonly number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((total, value) => total + value, 0);
  return Math.floor(sum / ratings.length + 0.5);
}
