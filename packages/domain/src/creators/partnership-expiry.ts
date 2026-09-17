/**
 * When a whitelisting partnership lapses (PRD §5.8.1).
 *
 * The PRD is blunt about what this replaces: "Activation date + time period (+ extension) = the date
 * permission lapses… a manual 25-day Slack reminder… build it in properly." Today somebody at TAS
 * keeps that date in their head and pings the channel. If they forget, a Meta ad keeps running from
 * a creator's personal handle after the creator stopped agreeing to it. This module is that reminder
 * turned into arithmetic.
 *
 * THE EXPIRY IS NEVER STORED. `partnership_activated_at`, `partnership_period_days` and
 * `extension_days` are the three columns; the lapse date is computed from them every time it is
 * read. A stored expiry column would go stale the moment an extension is granted, and would let a
 * row's dates disagree with its own countdown.
 *
 * PURE AND TIME-INJECTED. `now` is always a parameter and is never read from the clock inside, for
 * three reasons: the tests are deterministic without freezing time, a server-rendered page resolves
 * `now` once and passes it down (so the server and the client cannot render different countdowns and
 * cause a hydration mismatch), and demo mode can hand in a fixed reference date so the fixture
 * countdowns read the same on any day the demo is opened.
 *
 * The UI and the Server Actions both call these functions. Neither reimplements the rule, and
 * neither the query layer nor a component does this arithmetic itself (CLAUDE.md: business logic
 * lives in `packages/domain`).
 */

import type { ChipTone } from '../state/creative-status';

/**
 * Exact 24-hour days. Partnership windows are quoted in Meta's terms ("60 days from activation"),
 * both endpoints are `timestamptz` read as absolute instants, and nobody negotiates a whitelisting
 * window around a daylight-saving boundary — so a day is 86,400,000 ms here and calendar arithmetic
 * would add complexity that buys nothing.
 */
const DAY_MS = 86_400_000;

/**
 * At or under this many whole days remaining, a partnership row is NEAR EXPIRY: it is highlighted in
 * the `warn` tone and carries `data-near-expiry="true"`.
 *
 * Five, not twenty-five. PRD §5.8.1 describes TAS's *manual* habit as a 25-day Slack reminder, and
 * that number survives below as `PARTNERSHIP_REMINDER_DAYS` because it is still the cadence the team
 * works to when they go and renegotiate a renewal. But 25 days is a reminder to START a conversation
 * about a 30/60/90-day window — with a 30-day partnership it would fire on day five and mark nearly
 * every live row as urgent, which is how a highlight stops meaning anything. The row highlight is
 * the last-call signal, so it fires at five days, and the two numbers stay separate because they
 * answer different questions: "should somebody open the renewal?" and "is this about to run out?".
 */
export const PARTNERSHIP_EXPIRING_DAYS = 5;

/**
 * The cadence §5.8.1 records: TAS chases a renewal roughly 25 days before a window lapses. Kept as
 * one exported constant so the (later) scheduled job and any renewal report read the same number,
 * rather than a second copy of 25 appearing somewhere. Not the row-highlight threshold — that is
 * `PARTNERSHIP_EXPIRING_DAYS`.
 */
export const PARTNERSHIP_REMINDER_DAYS = 25;

/**
 * The three columns the lapse date is built from, named as the row names them
 * (`creators.partnership_activated_at` / `partnership_period_days` / `extension_days`).
 *
 * `activatedAt` and `periodDays` are nullable because a creator marked for partnership ads may not
 * have been whitelisted yet — a real and common state. `extensionDays` is `NOT NULL DEFAULT 0` in
 * the database, so the arithmetic is total and no caller has to coalesce; it is accepted as
 * optional/nullable here only so a partially-built draft object still type-checks.
 */
export interface PartnershipExpiryInput {
  readonly activatedAt: Date | null;
  readonly periodDays: number | null;
  readonly extensionDays?: number | null;
}

/** `active` → plenty of runway, `expiring` → last call, `expired` → permission has already lapsed. */
export type PartnershipExpiryState = 'active' | 'expiring' | 'expired';

export interface PartnershipExpiry {
  /** The instant permission lapses: activation + period + extension. */
  readonly expiresAt: Date;
  /** Whole days left, floored. Zero on the last day, negative once lapsed. */
  readonly daysRemaining: number;
  readonly state: PartnershipExpiryState;
}

/** The "Days Left" cell for a row that was never activated: there is no window to count down. */
export const NO_EXPIRY_LABEL = '—';

/** The "Days Left" cell once the window has lapsed. */
export const EXPIRED_LABEL = 'Expired';

function wholeDays(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  // Truncated so a bad float can never produce a fractional lapse instant. Real values are 30/60/90.
  return Math.trunc(value);
}

/**
 * The date permission lapses, or `null` when there is no window: no activation date, no period, or
 * either one unusable (an `Invalid Date`, a `NaN` period).
 *
 * `null` is the honest answer rather than a far-future date, because "this partnership has not
 * started" and "this partnership runs for a long time" must not render the same.
 *
 * A missing extension counts as zero days, matching the column's `NOT NULL DEFAULT 0`.
 */
export function partnershipExpiresOn(input: PartnershipExpiryInput): Date | null {
  const { activatedAt } = input;
  if (activatedAt === null || Number.isNaN(activatedAt.getTime())) {
    return null;
  }
  const period = wholeDays(input.periodDays);
  if (period === null) {
    return null;
  }
  const extension = wholeDays(input.extensionDays) ?? 0;
  return new Date(activatedAt.getTime() + (period + extension) * DAY_MS);
}

/**
 * Whole days between `now` and the lapse date, or `null` when there is no window.
 *
 * FLOORED, which is what makes "negative once lapsed" true to the minute: four hours after the lapse
 * instant the difference is −0.17 days and this returns −1, so the row reads Expired immediately
 * rather than clinging to a rounded-up zero for the rest of the day. On the other side, four hours
 * BEFORE the lapse it returns 0 — you have no whole days left, which is exactly right.
 */
export function daysUntilPartnershipExpiry(
  input: PartnershipExpiryInput,
  now: Date,
): number | null {
  const expiresAt = partnershipExpiresOn(input);
  if (expiresAt === null || Number.isNaN(now.getTime())) {
    return null;
  }
  return Math.floor((expiresAt.getTime() - now.getTime()) / DAY_MS);
}

/**
 * The whole answer for one row at one instant, or `null` for a row with no partnership window.
 *
 * This is the function the page calls. `partnershipExpiresOn` and `daysUntilPartnershipExpiry` exist
 * for callers that genuinely want one field (a CSV column, a job that only needs the date); a
 * component should take the object so the date, the countdown and the tone can never disagree.
 */
export function partnershipExpiry(
  input: PartnershipExpiryInput,
  now: Date,
): PartnershipExpiry | null {
  const expiresAt = partnershipExpiresOn(input);
  const daysRemaining = daysUntilPartnershipExpiry(input, now);
  if (expiresAt === null || daysRemaining === null) {
    return null;
  }
  return { expiresAt, daysRemaining, state: expiryStateFor(daysRemaining) };
}

/**
 * Days remaining → state. Zero is `expiring`, not `expired`: on the last day permission is still
 * live, and that is the single most important row on the page to get in front of somebody.
 */
export function expiryStateFor(daysRemaining: number): PartnershipExpiryState {
  if (daysRemaining < 0) {
    return 'expired';
  }
  return daysRemaining <= PARTNERSHIP_EXPIRING_DAYS ? 'expiring' : 'active';
}

/**
 * True for a row inside the highlight window: still live, `PARTNERSHIP_EXPIRING_DAYS` or fewer whole
 * days left. This is the predicate behind `data-near-expiry="true"` and the `warn` row tint.
 *
 * False for a row with no window and false once lapsed — an expired partnership is not "near"
 * expiry, it is past it, and it gets the `bad` tone and the word Expired instead.
 */
export function isPartnershipNearExpiry(input: PartnershipExpiryInput, now: Date): boolean {
  return partnershipExpiry(input, now)?.state === 'expiring';
}

/**
 * True when the row has reached the TAS renewal cadence of §5.8.1: still live, but inside
 * `PARTNERSHIP_REMINDER_DAYS`. Wider than `isPartnershipNearExpiry` by construction — every
 * near-expiry row is also due a reminder, not the other way round — and kept apart from it so the
 * (later) scheduled reminder job and the row highlight can never be confused for one another.
 */
export function isPartnershipDueReminder(input: PartnershipExpiryInput, now: Date): boolean {
  const daysRemaining = daysUntilPartnershipExpiry(input, now);
  return daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= PARTNERSHIP_REMINDER_DAYS;
}

/**
 * The `StatusChip` / row tone for an expiry state, in the same `ChipTone` vocabulary every status in
 * the platform uses: `active` → `ok`, `expiring` → `warn`, `expired` → `bad`.
 *
 * Total, so a row with no partnership window (`null`) gets `mute` — the palette's "no opinion" tone,
 * the same fallback `chipTone` gives anything it does not recognise — rather than being coloured as
 * though something were wrong with it.
 */
export function expiryTone(state: PartnershipExpiryState | null): ChipTone {
  if (state === 'active') {
    return 'ok';
  }
  if (state === 'expiring') {
    return 'warn';
  }
  if (state === 'expired') {
    return 'bad';
  }
  return 'mute';
}

/**
 * The "Days Left" cell, rendered in `font-mono`. A function because the sentence is wrong at three
 * separate points of the range and a component that interpolates the number gets all three wrong:
 * a lapsed row must read `Expired` rather than a negative number, the last day must not read
 * "0 days", and one day must not read "1 days". `null` (never activated) reads as an em dash.
 */
export function partnershipCountdownLabel(expiry: PartnershipExpiry | null): string {
  if (expiry === null) {
    return NO_EXPIRY_LABEL;
  }
  if (expiry.state === 'expired') {
    return EXPIRED_LABEL;
  }
  if (expiry.daysRemaining === 0) {
    return 'Today';
  }
  return expiry.daysRemaining === 1 ? '1 day' : `${String(expiry.daysRemaining)} days`;
}
