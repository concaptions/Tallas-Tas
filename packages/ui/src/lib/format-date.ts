/**
 * The two date renderings the boards use (B2.A10 / B1.A22, and the comment stamps on board 1),
 * shared by Focus Mode, the Sheet sidebar and the grid so the three never drift.
 *
 * UTC throughout: a stored date (`2026-10-18`) is a calendar day, not an instant, and rendering it
 * in the viewer's zone shifts it to the 17th west of Greenwich. Formatters are immutable, so the
 * three are built once; a `Date` or an ISO string is accepted, and anything unparseable renders
 * as the empty string so a missing value draws nothing rather than "Invalid Date".
 */
const SHEET_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const STAMP_DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const STAMP_TIME = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `18 Oct 2026`, `02 Oct 2026` — a stored date, rendered sans (it is not generated output). */
export function formatSheetDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date === null ? '' : SHEET_DATE.format(date);
}

/** `10 Oct, 3:42 PM` — the stamp beside an authored comment. */
export function formatCommentStamp(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (date === null) {
    return '';
  }
  // Newer ICU separates the meridiem with a narrow no-break space; the board (and a test) expects a plain one.
  const time = STAMP_TIME.format(date).replace(/[\u00a0\u202f]/g, ' ');
  return `${STAMP_DAY.format(date)}, ${time}`;
}
