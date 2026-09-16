/**
 * "3 days ago" for a timestamp column. Pure, and `now` is an argument, so the string is computed
 * once on the server and handed to the client as text: a client that formatted it itself would
 * render a different value from the server's and break hydration.
 */
const DIVISIONS: readonly { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export function relativeTime(value: Date, now: Date = new Date()): string {
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let duration = (value.getTime() - now.getTime()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return format.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return format.format(Math.round(duration), 'year');
}

/** The full timestamp, for the `title` of a relative one. */
export function absoluteTime(value: Date): string {
  return value.toISOString().replace('T', ' ').slice(0, 16);
}
