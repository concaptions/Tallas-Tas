/**
 * The "Last active" cell on the Team page (ticket criterion 5): "3 days ago", or "Never".
 *
 * `now` IS ALWAYS A PARAMETER and is never read from the clock inside, for the same three reasons
 * `partnershipExpiry` takes one: the tests are deterministic without freezing time, a server-
 * rendered page resolves `now` once and hands the finished string down (a client that re-formatted
 * it would render a different value from the server's and break hydration), and demo mode can pass a
 * fixed reference date so the fixture roster reads the same on any day the demo is opened.
 *
 * Why this and not `relativeTime` from `apps/web/src/lib/relative-time.ts`, which the Personas page
 * uses: that helper is `Intl.RelativeTimeFormat` over a timestamp that always exists, and it has no
 * answer for `users.last_active_at` being NULL — the row for somebody invited who has never signed
 * in. It would also happily render a future instant as "in 2 hours" and a fresh sign-in as "now".
 * A person's last activity is a bounded, one-directional quantity, so it gets a bounded, one-
 * directional label. The page still uses `absoluteTime` for the `title`; only the visible phrase
 * comes from here.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * A month as 30 days and a year as 365. Both are approximations, and both are fine here in a way
 * they would not be in the partnership countdown: nothing is owed on a "4 months ago" boundary, and
 * a label that is a day out at the edge of a month is not a label anybody can be wrong about.
 */
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/** Criterion 5: a member who never signed in reads Never, not an empty cell and not a date. */
export const NEVER_ACTIVE_LABEL = 'Never';

/**
 * Under a minute. Also the answer for a timestamp slightly in the FUTURE, which a real database
 * produces whenever the app server's clock runs a second or two behind the one that wrote the row.
 * "in 4 seconds" on a team roster is a bug report waiting to happen; "Just now" is simply true.
 */
export const JUST_NOW_LABEL = 'Just now';

function plural(count: number, unit: string): string {
  return count === 1 ? `1 ${unit} ago` : `${String(count)} ${unit}s ago`;
}

/**
 * The visible "Last active" phrase for one row at one instant.
 *
 * `null` — the NULL `users.last_active_at` of somebody who has never signed in — is `Never`, and so
 * is an unusable date on either side (an `Invalid Date` row, a `NaN` `now`): the cell is never
 * empty and never renders the string "Invalid Date".
 *
 * The ladder is minutes → hours → days → weeks → months → years, each step floored, so the label
 * only ever rounds DOWN. Somebody who was here 13 hours ago reads "13 hours ago", not "yesterday" —
 * the roster answers "how stale is this account?", and rounding up makes an idle account look
 * fresher than it is. The steps are the ones a reader actually reasons in: 7 to 29 days reads in
 * weeks rather than as "23 days ago", and past a year the number stops mattering at all.
 */
export function lastActiveLabel(date: Date | null | undefined, now: Date): string {
  if (!date || Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) {
    return NEVER_ACTIVE_LABEL;
  }

  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE_MS) {
    return JUST_NOW_LABEL;
  }
  if (elapsed < HOUR_MS) {
    return plural(Math.floor(elapsed / MINUTE_MS), 'minute');
  }
  if (elapsed < DAY_MS) {
    return plural(Math.floor(elapsed / HOUR_MS), 'hour');
  }
  if (elapsed < WEEK_MS) {
    return plural(Math.floor(elapsed / DAY_MS), 'day');
  }
  if (elapsed < MONTH_MS) {
    return plural(Math.floor(elapsed / WEEK_MS), 'week');
  }
  if (elapsed < YEAR_MS) {
    return plural(Math.floor(elapsed / MONTH_MS), 'month');
  }
  return plural(Math.floor(elapsed / YEAR_MS), 'year');
}

/**
 * True when the row has never been active — the predicate behind rendering that cell in `text-text3`
 * rather than the body colour. A separate function so a component tests the fact, not the string.
 */
export function hasNeverBeenActive(date: Date | null | undefined): boolean {
  return !date || Number.isNaN(date.getTime());
}
