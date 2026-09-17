/**
 * The copy title (PRD §5.11 "Copy #", CLAUDE.md non-negotiable 4): auto-generated, never typed by a
 * user.
 *
 *     Copy #1
 *
 * This is the ONLY place that string is built, exactly as `conceptName` and `creativeName` are the
 * only places their formulas live. The table's first column renders it from here, the detail panel's
 * heading renders it from here, and `@tas/db` stores the NUMBER alone — `copywriting.copy_number`,
 * an `integer` — because the title is a rendering of the number and not a second copy of it that
 * could drift.
 *
 * A copy title is deliberately not the creative's name: a copy row may have no creative at all
 * (`creative_brief_id` is nullable, CLAUDE.md non-negotiable 5), so a title derived from the link
 * would leave the unattached row nameless. The number is the row's own identity; the Linked Creative
 * column says what it runs against.
 *
 * Pure: it reads a number and returns a string. No lookup, no database, and — importantly — no
 * throw. The panel renders it while a row is still being created, so a missing number has to come
 * back renderable rather than as an exception.
 */

/** The one prefix, exported so nothing re-types `Copy #` when it renders or parses a title. */
export const COPY_TITLE_PREFIX = 'Copy #';

/**
 * What stands in for a number that has not been assigned yet, so an in-flight row previews as
 * `Copy #?` rather than losing its heading or showing `Copy #undefined`. Same idea as
 * `CREATIVE_NAME_PLACEHOLDER`, one position wide.
 */
export const COPY_TITLE_PLACEHOLDER = '?';

/** The first number `nextCopyNumber` hands out, and `copywriting.copy_number`'s column default. */
export const FIRST_COPY_NUMBER = 1;

/**
 * A copy number is a whole number from 1 up. `0`, `-3`, `1.5`, `NaN` and `Infinity` are not numbers
 * this formula can title, and every one of them is reachable: a hand-written fixture, a column read
 * out of a build that stored something else, or a half-finished form.
 */
export function isCopyNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= FIRST_COPY_NUMBER;
}

/**
 * `Copy #1`.
 *
 * Total: anything that is not a whole number from 1 up renders as `Copy #?`. The title is never
 * blank, because a blank first column in a table of rows that have no other name is a row nobody can
 * refer to.
 */
export function copyTitle(copyNumber: number | null | undefined): string {
  return `${COPY_TITLE_PREFIX}${isCopyNumber(copyNumber) ? String(copyNumber) : COPY_TITLE_PLACEHOLDER}`;
}

/**
 * The number a new copy row gets: one past the highest number already taken, or `1` for the first
 * row ever. Numbers that are not copy numbers are ignored rather than dragging the sequence
 * somewhere strange, and gaps are never back-filled — a deleted `Copy #2` stays a hole, because
 * re-issuing the number would point two rows' worth of history at one title.
 *
 * Pure, and the caller supplies the numbers: the domain does not know how to read a table. The
 * Server Action passes what `listCopy` returned, scoped to the brand it is writing in.
 */
export function nextCopyNumber(existing: readonly (number | null | undefined)[]): number {
  const taken = existing.filter(isCopyNumber);
  return taken.length === 0 ? FIRST_COPY_NUMBER : Math.max(...taken) + 1;
}
