import type { CSSProperties } from 'react';
import {
  ageBracketLabel,
  creatorPlatformLabel,
  expiryTone,
  partnershipCountdownLabel,
  partnershipExpiry,
  UNSET_LABEL,
  type PartnershipExpiry,
  type PartnershipExpiryState,
} from '@tas/domain/creators';
import {
  creatorAssetsStatusLabel,
  creatorAssetsStatusTone,
  creatorInternalStatusLabel,
  creatorInternalStatusTone,
  creatorStatusLabel,
  creatorStatusTone,
  partnershipActivityLabel,
  partnershipActivityTone,
  type ChipTone,
} from '@tas/domain/state';

/**
 * How the UGC Management route presents what `creators` stores (PRD §5.8 and §5.8.1). One module,
 * so the card grid, the partnership table, the tab strip and the `/design-system` preview cannot
 * drift: the tab vocabulary, the three-track labelling, the em dash, the date format, the period
 * sentence and every empty-state line are each stated exactly once.
 *
 * NOTHING HERE INVENTS A VOCABULARY. Status labels and tones are `@tas/domain/state`
 * (CLAUDE.md non-negotiable 2 — no component compares a status to a literal), the age bracket and
 * platform labels are `@tas/domain/creators`, and every countdown, tone and near-expiry decision is
 * `partnershipExpiry` from the same package. This file decides layout words, not business rules.
 *
 * `@tas/db` is deliberately absent. The workspace, the card and the table are client components and
 * a runtime import of that package would drag the database driver into the browser bundle, so the
 * row shapes below are declared structurally: `page.tsx` hands a `CreatorListRow` straight in
 * because it satisfies them, and a `/design-system` story hands in a plain object.
 */

/** The URL parameter the open tab lives in, so a link opens the right half of the page. */
export const TAB_PARAM = 'tab';

/** The URL parameter the search lives in, the same `?q=` every other list page uses. */
export const SEARCH_PARAM = 'q';

/**
 * The two tabs, in the order PRD §5.8 then §5.8.1 reads: the roster first, the whitelisting
 * arrangements struck with a few of them second. `creators` is the default because it is the whole
 * table; Partnership Ads is the slice of it that carries an expiring permission.
 */
export const UGC_TABS = [
  { key: 'creators', label: 'Creators' },
  { key: 'partnerships', label: 'Partnership Ads' },
] as const;

export type UgcTabKey = (typeof UGC_TABS)[number]['key'];

export const DEFAULT_TAB: UgcTabKey = UGC_TABS[0].key;

/**
 * The `?tab=` parameter as a tab.
 *
 * Total on purpose: a value this build does not know — a hand-typed parameter, a link from a newer
 * build — falls back to Creators rather than rendering an empty page a visitor cannot explain.
 * Matched case-insensitively so `?tab=Partnerships` from a pasted link means what it says.
 */
export function tabFromParam(value: string | null | undefined): UgcTabKey {
  if (value === undefined || value === null) {
    return DEFAULT_TAB;
  }
  const wanted = value.trim().toLowerCase();
  return UGC_TABS.find((tab) => tab.key === wanted)?.key ?? DEFAULT_TAB;
}

/** The dash an empty cell shows, so a missing value is never just a gap. */
export const EM_DASH = UNSET_LABEL;

/**
 * One creator's three concurrent tracks (PRD §5.8), each labelled with the review it belongs to.
 *
 * The labelling is the point, not decoration. PRD §9 and CLAUDE.md non-negotiable 10 split the
 * workspace in two — Internal is team-only, Client is what the client sees — and three unlabelled
 * chips in a row would read as one status that changed its mind twice. `Internal`, `Client` and
 * `Assets` are short enough to sit on a 390px card and long enough that nobody has to guess which
 * chip a client would ever be shown.
 */
export const CREATOR_TRACKS = [
  { key: 'internal', label: 'Internal' },
  { key: 'client', label: 'Client' },
  { key: 'assets', label: 'Assets' },
] as const;

export type CreatorTrackKey = (typeof CREATOR_TRACKS)[number]['key'];

export interface CreatorTrack {
  readonly key: CreatorTrackKey;
  /** `Internal`, `Client` or `Assets` — which review this chip belongs to. */
  readonly label: string;
  readonly statusLabel: string;
  readonly tone: ChipTone;
}

/** The three stored status keys of one creator row, named as the columns name them. */
export interface CreatorStatusInput {
  readonly internalCreatorStatus: string;
  readonly clientStatus: string;
  readonly internalAssetsStatus: string;
}

/**
 * The three tracks of one row, resolved through `@tas/domain/state` and in the fixed order above.
 * A component renders this array; it never picks a label or a tone itself.
 */
export function creatorTracks(row: CreatorStatusInput): readonly CreatorTrack[] {
  return [
    {
      key: 'internal',
      label: CREATOR_TRACKS[0].label,
      statusLabel: creatorInternalStatusLabel(row.internalCreatorStatus),
      tone: creatorInternalStatusTone(row.internalCreatorStatus),
    },
    {
      key: 'client',
      label: CREATOR_TRACKS[1].label,
      statusLabel: creatorStatusLabel(row.clientStatus),
      tone: creatorStatusTone(row.clientStatus),
    },
    {
      key: 'assets',
      label: CREATOR_TRACKS[2].label,
      statusLabel: creatorAssetsStatusLabel(row.internalAssetsStatus),
      tone: creatorAssetsStatusTone(row.internalAssetsStatus),
    },
  ];
}

/**
 * Up to two initials for the avatar fallback (ticket criterion 5): first letter of the first word,
 * first letter of the last. Upper-cased, and an empty or symbol-only name falls back to `?` rather
 * than an empty tile, so the avatar is never a blank square a reader mistakes for a broken image.
 */
export function creatorInitials(name: string): string {
  // Split on any run of non-letters, so a space, a hyphen, an em dash and an apostrophe all open a
  // new word and no punctuation can ever end up as one of the two letters.
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
  if (words.length === 0) {
    return '?';
  }
  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? first;
  const letters =
    words.length === 1 ? first.slice(0, 1) : `${first.slice(0, 1)}${last.slice(0, 1)}`;
  return letters.toUpperCase();
}

/** What one creator card renders. Narrower than `CreatorListRow`, so a preview passes a plain object. */
export interface CreatorCardRow {
  readonly id: string;
  readonly name: string;
  readonly gender: string | null;
  readonly ageBracket: string | null;
  readonly platform: string | null;
  readonly profilePicUrl: string | null;
  readonly internalCreatorStatus: string;
  readonly clientStatus: string;
  readonly internalAssetsStatus: string;
  readonly rawAssetsUrl: string | null;
  readonly conceptIds: readonly string[];
  readonly productIds: readonly string[];
}

/**
 * The identity line under a creator's name: gender and age bracket, separated by a middot.
 *
 * Both columns are nullable — a creator is added the moment somebody has a name — so the line
 * degrades to whichever half exists and to a single em dash when neither does. Gender is free text
 * on the record by design (a closed list of it would be wrong about somebody), so it is rendered
 * verbatim; the bracket goes through `ageBracketLabel`, which is where `25-34` becomes `25–34`.
 */
export function identityLine(row: Pick<CreatorCardRow, 'gender' | 'ageBracket'>): string {
  const gender = row.gender === null || row.gender.trim() === '' ? null : row.gender.trim();
  const bracket =
    row.ageBracket === null || row.ageBracket === '' ? null : ageBracketLabel(row.ageBracket);
  const parts = [gender, bracket].filter((part): part is string => part !== null);
  return parts.length === 0 ? EM_DASH : parts.join(' · ');
}

/** The platform chip's label: a proper noun from `@tas/domain/creators`, never a typed string. */
export function platformChipLabel(platform: string | null): string {
  return creatorPlatformLabel(platform);
}

/**
 * The Partnership Ads columns, in the one order §5.8.1 reads them: who, from which handle, whether
 * permission is declared live, when it started, how long it runs, and how long is left.
 */
export const PARTNERSHIP_COLUMNS = [
  'Creator',
  'Instagram Username',
  'Activity',
  'Activated',
  'Period',
  'Countdown',
] as const;

/** The stored partnership columns one table row is built from, named as the columns name them. */
export interface PartnershipSourceRow {
  readonly id: string;
  readonly name: string;
  readonly instagramUsername: string | null;
  readonly partnershipActivity: string;
  readonly partnershipActivatedAt: Date | null;
  readonly partnershipPeriodDays: number | null;
  readonly extensionDays: number;
}

/** One table row, fully resolved on the server so the client never holds a second clock. */
export interface PartnershipRow {
  readonly id: string;
  readonly name: string;
  /** The handle as stored, `@` included, rendered in `font-mono`; the em dash when there is none. */
  readonly instagramUsername: string;
  readonly activityLabel: string;
  readonly activityTone: ChipTone;
  /** `2026-07-22`, or the em dash for a partnership that was never activated. */
  readonly activatedLabel: string;
  /** `60 days` / `60 + 30 days`, so an extension is visible rather than folded into one number. */
  readonly periodLabel: string;
  /** `20 days` / `1 day` / `Today` / `Expired` / the em dash — `partnershipCountdownLabel`'s words. */
  readonly countdownLabel: string;
  readonly countdownTone: ChipTone;
  readonly expiryState: PartnershipExpiryState | null;
  /** `data-near-expiry="true"`: still live, inside the highlight window. Never true once lapsed. */
  readonly nearExpiry: boolean;
}

/**
 * A date as `YYYY-MM-DD` in UTC, written in `font-mono`.
 *
 * ISO rather than a locale format on purpose: `toLocaleDateString` resolves against the machine's
 * locale and time zone, so the server and the browser would render two different strings for one
 * row and React would report a hydration mismatch. The slice is off the ISO string, which is UTC by
 * definition and identical in every process.
 */
export function isoDateLabel(value: Date | null): string {
  if (value === null || Number.isNaN(value.getTime())) {
    return EM_DASH;
  }
  return value.toISOString().slice(0, 10);
}

/**
 * The window a partnership runs for: the negotiated period, then the extension as its own term.
 *
 * `60 + 30 days` rather than `90 days` because the two numbers were agreed at different times and
 * the renewal conversation is about the extension, not the total. A row with no period reads as the
 * em dash — there is no window yet, which is a normal state, not a gap.
 */
export function periodLabel(periodDays: number | null, extensionDays: number): string {
  if (periodDays === null || !Number.isFinite(periodDays)) {
    return EM_DASH;
  }
  const period = Math.trunc(periodDays);
  const extension = Number.isFinite(extensionDays) ? Math.trunc(extensionDays) : 0;
  const total = extension > 0 ? `${String(period)} + ${String(extension)}` : String(period);
  return `${total} ${period + extension === 1 ? 'day' : 'days'}`;
}

/**
 * The Countdown cell: `partnershipCountdownLabel`'s words, with `left` added to a plain day count.
 *
 * The domain owns every word that is not the suffix — the em dash for a row with no window, the
 * `Expired` a lapsed row reads instead of a negative number, the `Today` the last day reads instead
 * of "0 days", and the singular "1 day" — because those are the three points of the range a
 * component that interpolated the number would get wrong. All this adds is the reading direction,
 * and only where it is true: `Expired left` and `Today left` are not sentences, so neither is built.
 */
export function countdownCellLabel(expiry: PartnershipExpiry | null): string {
  const base = partnershipCountdownLabel(expiry);
  if (expiry === null || expiry.state === 'expired' || expiry.daysRemaining <= 0) {
    return base;
  }
  return `${base} left`;
}

/**
 * One stored row as the table renders it, read against the single `now` the page resolved.
 *
 * Every derived value comes from `partnershipExpiry` in `@tas/domain/creators`: the countdown
 * words, the tone and the near-expiry flag are three views of one object, so the highlight and the
 * number can never disagree. A row with no activation date gets `null` state and the `mute` tone
 * rather than being coloured as though something were wrong with it.
 */
export function partnershipRow(row: PartnershipSourceRow, now: Date): PartnershipRow {
  const expiry = partnershipExpiry(
    {
      activatedAt: row.partnershipActivatedAt,
      periodDays: row.partnershipPeriodDays,
      extensionDays: row.extensionDays,
    },
    now,
  );
  const state = expiry?.state ?? null;
  return {
    id: row.id,
    name: row.name,
    instagramUsername:
      row.instagramUsername === null || row.instagramUsername.trim() === ''
        ? EM_DASH
        : row.instagramUsername,
    activityLabel: partnershipActivityLabel(row.partnershipActivity),
    activityTone: partnershipActivityTone(row.partnershipActivity),
    activatedLabel: isoDateLabel(row.partnershipActivatedAt),
    periodLabel: periodLabel(row.partnershipPeriodDays, row.extensionDays),
    countdownLabel: countdownCellLabel(expiry),
    countdownTone: expiryTone(state),
    expiryState: state,
    nearExpiry: state === 'expiring',
  };
}

/** The text colour of the Countdown cell, one class per tone, all through the token layer. */
export const TONE_TEXT_CLASS: Readonly<Record<ChipTone, string>> = {
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
  info: 'text-info',
  accent: 'text-accent',
  mute: 'text-text3',
};

/**
 * The left edge of a partnership row: a two-pixel rule in the row's own expiry tone, so the one row
 * that needs a renewal signed is findable by colour before anybody reads a number. A healthy or
 * un-activated row keeps the table's own border and gets no rule at all — a highlight that fires on
 * every row is not a highlight.
 */
export function expiryRowClassName(state: PartnershipExpiryState | null): string {
  if (state === 'expiring') {
    return 'border-l-2 border-l-warn';
  }
  if (state === 'expired') {
    return 'border-l-2 border-l-bad';
  }
  return 'border-l-2 border-l-transparent';
}

/**
 * The row tint, built with `color-mix` over the same `--warn` / `--bad` variables `StatusChip`
 * mixes its own background from (ticket criterion 10: a warn-tinted background from the variables
 * the chip uses, no hex). Seven percent, well under the chip's thirteen, because a whole table row
 * carrying the chip's tint would shout louder than the chip inside it.
 */
export function expiryRowStyle(state: PartnershipExpiryState | null): CSSProperties | undefined {
  if (state === 'expiring') {
    return { backgroundColor: 'color-mix(in srgb, var(--warn) 7%, transparent)' };
  }
  if (state === 'expired') {
    return { backgroundColor: 'color-mix(in srgb, var(--bad) 6%, transparent)' };
  }
  return undefined;
}

/** A creator is in the list when `?q=` is empty or their name contains it. */
export function matchesQuery(name: string, query: string): boolean {
  return query === '' || name.toLowerCase().includes(query);
}

/** The line under the heading, so "5 creators" never contradicts two visible cards. */
export function creatorCountLabel(total: number): string {
  const count = Math.max(Math.trunc(total), 0);
  return `${String(count)} ${count === 1 ? 'creator' : 'creators'}`;
}

export function partnershipCountLabel(total: number): string {
  const count = Math.max(Math.trunc(total), 0);
  return `${String(count)} ${count === 1 ? 'partnership' : 'partnerships'}`;
}

/** The count line while `?q=` is narrowing a tab. */
export function filteredCountLabel(visible: number, total: string): string {
  return `${String(Math.max(Math.trunc(visible), 0))} of ${total}`;
}

/** The empty states, in words, each offering the way out (ticket: never a blank panel). */
export const NO_CREATORS_NOTE =
  'No creators yet. Add the first person to the roster and their booking, statuses and shipping live here.';
export const NO_PARTNERSHIPS_NOTE =
  'No partnership ads yet. Mark a creator for partnership ads to whitelist their handle and start the permission clock.';
export const NO_MATCH_NOTE = 'No creator matches that search. Clear it to see the whole roster.';

/** Why the write control is inert in live mode: adding a creator is a later ticket. */
export const NEW_CREATOR_SOON_HINT =
  'Adding a creator ships with the UGC intake form; this page reads the roster.';

/**
 * The note above the Partnership Ads table. CLAUDE.md non-negotiable 10: clients see no internal
 * data, and the partnership price per 30 days is exactly that — so it is absent from every column
 * below, and the sentence says why rather than leaving its absence to be read as an oversight.
 */
export const INTERNAL_ONLY_NOTE =
  'Internal view. Partnership price per 30 days is never shown to a client and is not in this table.';
