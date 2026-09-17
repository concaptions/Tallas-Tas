/**
 * The UGC creator status vocabularies (PRD §5.8) and the partnership activity vocabulary (§5.8.1),
 * alongside the creative state machine in `./creative-status` and the copy track in `./copy-status`.
 *
 * A creator carries THREE tracks at once, which is what makes this file different from every other
 * status module in the repo:
 *
 *   - `CREATOR_INTERNAL_STATUS` — is this person worth booking? Team only, the client never sees it.
 *   - `CREATOR_STATUS` — the client-facing track: the one the client interface renders and the one
 *     the creator cards on `/app/ugc` chip. PRD §5.8 lists it in the order reproduced below.
 *   - `CREATOR_ASSETS_STATUS` — the same three-state review applied to the footage that comes back.
 *
 * They are three lists rather than one because they run concurrently and answer different
 * questions: a creator can be internally Approved, client-side Filming In Progress and have assets
 * still Pending for CS Approval, all on the same row, all true at once. That is also why there is no
 * `isClientTrackOpen`-style gate here — a creative's client track opens only once internal review
 * signs off (`./creative-status`), but a creator's three tracks are independent by design.
 *
 * `creators.internal_creator_status` / `client_status` / `internal_assets_status` /
 * `partnership_activity` in `@tas/db` are plain `text` columns carrying one of these KEYS, and the
 * four `*_DEFAULT` constants in `packages/db/src/schema/creators.ts` are hand-copies of the first
 * entry of each list (`@tas/db` does not depend on `@tas/domain`, the edge runs the other way
 * everywhere in this repo, and `apps/web` is where the two are asserted equal). The domain owns the
 * SET of states and their labels; the columns only store which one a row is in. No component and no
 * query writes a status string of its own (CLAUDE.md non-negotiable 2) and none picks a chip colour
 * locally.
 */

import type { ChipTone, StatusEntry } from './creative-status';

/**
 * PRD §5.8's internal creator track: is this person worth booking at all?
 *
 * Shaped exactly like `CLIENT_STATUS` — one entry state, then the review outcomes — and deliberately
 * NOT merged with `CREATOR_ASSETS_STATUS` even though the last three entries read the same. They are
 * two reviews of two different things at two different times (the person, then the footage), and a
 * row sits in both at once, so one shared list would have forced a single column and lost that.
 */
export const CREATOR_INTERNAL_STATUS = [
  {
    key: 'request',
    label: 'Request',
    description: 'Where every creator starts: sourced or inbound, nobody has reviewed them yet.',
  },
  {
    key: 'pending_for_cs_approval',
    label: 'Pending for CS Approval',
    description: 'Submitted to the creative strategist to decide whether TAS books this creator.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'The strategist wants more — a better intro video, a rate, a usage answer.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Internal sign-off. TAS is willing to book this creator and pay the quoted cost.',
  },
] as const satisfies readonly StatusEntry[];

/**
 * PRD §5.8's CLIENT-FACING track, in the PRD's own order, which is the order the chips render in.
 *
 * The order is a shape, not an alphabet: the first four are the approval decision (waiting, then the
 * three ways out of it) and the last three are the booking running its course once the client has
 * said yes — ship the product, film it, deliver the video. `Disapproved` sits inside the first group
 * because it is an outcome of the decision, not a stage of the work.
 *
 * This is the ONLY creator track the client interface may render (CLAUDE.md non-negotiable 10): the
 * other two lists in this file are internal, as are budgets, creator costs and partnership prices.
 */
export const CREATOR_STATUS = [
  {
    key: 'pending_for_approval',
    label: 'Pending For Approval',
    description: 'The creator is in front of the client, waiting on their decision.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Client approved the creator. The booking can proceed.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'Client wants a change before they will approve — a different angle, a re-shoot.',
  },
  {
    key: 'disapproved',
    label: 'Disapproved',
    description: 'Client rejected the creator outright. Not a revision: this person is not booked.',
  },
  {
    key: 'due_shipment',
    label: 'Due Shipment',
    description: 'Approved and waiting on TAS to ship product before the creator can film.',
  },
  {
    key: 'filming_in_progress',
    label: 'Filming In Progress',
    description: 'Product landed and the creator is shooting against the brief.',
  },
  {
    key: 'video_delivered',
    label: 'Video Delivered',
    description: 'Footage is in. The assets track takes over from here.',
  },
] as const satisfies readonly StatusEntry[];

/**
 * PRD §5.8's third track: the review of the raw assets the creator delivered.
 *
 * Three states, not four: there is no `Request` here because the footage either exists or the row is
 * not in this track yet. The keys are shared verbatim with `CREATOR_INTERNAL_STATUS` on purpose —
 * `pending_for_cs_approval`, `revisions_needed` and `approved` mean the same thing in both reviews —
 * so a component that renders "the CS review" renders both lists with one chip helper.
 */
export const CREATOR_ASSETS_STATUS = [
  {
    key: 'pending_for_cs_approval',
    label: 'Pending for CS Approval',
    description: 'Delivered footage sitting in the queue for a creative strategist to watch.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'The cut needs another pass from the creator before it goes to the client.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Footage accepted. It can be briefed into a creative.',
  },
] as const satisfies readonly StatusEntry[];

/**
 * PRD §5.8.1's partnership (whitelisting) activity, rendered as a `StatusChip` in the Activity
 * column of the Partnership Ads table. The Activity cell writes no label of its own.
 *
 * This is a STATED status, not a derived one. It is deliberately independent of
 * `partnershipExpiry` in `@tas/domain/creators`: the dates say when permission lapses, this column
 * says what a human declared, and the whole point of the expiry countdown is to catch the rows where
 * the two disagree — a partnership still marked `active` whose window ran out days ago is exactly
 * the failure the manual 25-day Slack reminder was there to prevent.
 */
export const PARTNERSHIP_ACTIVITY = [
  {
    key: 'active',
    label: 'Active',
    description: 'The creator’s handle is whitelisted and ads are permitted to run from it.',
  },
  {
    key: 'not_active',
    label: 'Not Active',
    description: 'Where every creator starts. No whitelisting window has been opened.',
  },
  {
    key: 'ended',
    label: 'Ended',
    description: 'The window closed and was not renewed. Reactivating means asking the creator.',
  },
] as const satisfies readonly StatusEntry[];

export type CreatorInternalStatusKey = (typeof CREATOR_INTERNAL_STATUS)[number]['key'];
export type CreatorStatusKey = (typeof CREATOR_STATUS)[number]['key'];
export type CreatorAssetsStatusKey = (typeof CREATOR_ASSETS_STATUS)[number]['key'];
export type PartnershipActivityKey = (typeof PARTNERSHIP_ACTIVITY)[number]['key'];

/** The state a new creator row starts in on each track. `@tas/db`'s defaults are these, copied. */
export const CREATOR_INTERNAL_STATUS_INITIAL: CreatorInternalStatusKey =
  CREATOR_INTERNAL_STATUS[0].key;
export const CREATOR_STATUS_INITIAL: CreatorStatusKey = CREATOR_STATUS[0].key;
export const CREATOR_ASSETS_STATUS_INITIAL: CreatorAssetsStatusKey = CREATOR_ASSETS_STATUS[0].key;
/**
 * The odd one out: `not_active`, NOT the first entry. The list is ordered the way §5.8.1 reads it
 * and the way the Activity filter renders (Active / Not Active / Ended), which puts the resting
 * state second. `PARTNERSHIP_ACTIVITY_DEFAULT` in `@tas/db` is this key.
 */
export const PARTNERSHIP_ACTIVITY_INITIAL: PartnershipActivityKey = 'not_active';

/**
 * The one activity that ASSERTS a live whitelisting window, named so that no caller has to type the
 * key (CLAUDE.md non-negotiable 2). A write path that stores this value is claiming permission is
 * currently granted, which is only meaningful with an activation date and a period behind it — see
 * `partnershipExpiresOn` in `@tas/domain/creators`, the function that turns that claim into a date.
 */
export const PARTNERSHIP_ACTIVITY_ACTIVE: PartnershipActivityKey = 'active';

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const CREATOR_INTERNAL_STATUS_KEYS: readonly CreatorInternalStatusKey[] =
  CREATOR_INTERNAL_STATUS.map((entry) => entry.key);
export const CREATOR_STATUS_KEYS: readonly CreatorStatusKey[] = CREATOR_STATUS.map(
  (entry) => entry.key,
);
export const CREATOR_ASSETS_STATUS_KEYS: readonly CreatorAssetsStatusKey[] =
  CREATOR_ASSETS_STATUS.map((entry) => entry.key);
export const PARTNERSHIP_ACTIVITY_KEYS: readonly PartnershipActivityKey[] =
  PARTNERSHIP_ACTIVITY.map((entry) => entry.key);

export function isCreatorInternalStatus(value: string): value is CreatorInternalStatusKey {
  return CREATOR_INTERNAL_STATUS_KEYS.includes(value as CreatorInternalStatusKey);
}

export function isCreatorStatus(value: string): value is CreatorStatusKey {
  return CREATOR_STATUS_KEYS.includes(value as CreatorStatusKey);
}

export function isCreatorAssetsStatus(value: string): value is CreatorAssetsStatusKey {
  return CREATOR_ASSETS_STATUS_KEYS.includes(value as CreatorAssetsStatusKey);
}

export function isPartnershipActivity(value: string): value is PartnershipActivityKey {
  return PARTNERSHIP_ACTIVITY_KEYS.includes(value as PartnershipActivityKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function creatorInternalStatusEntry(
  value: string,
): StatusEntry<CreatorInternalStatusKey> | undefined {
  return CREATOR_INTERNAL_STATUS.find((entry) => entry.key === value);
}

export function creatorStatusEntry(value: string): StatusEntry<CreatorStatusKey> | undefined {
  return CREATOR_STATUS.find((entry) => entry.key === value);
}

export function creatorAssetsStatusEntry(
  value: string,
): StatusEntry<CreatorAssetsStatusKey> | undefined {
  return CREATOR_ASSETS_STATUS.find((entry) => entry.key === value);
}

export function partnershipActivityEntry(
  value: string,
): StatusEntry<PartnershipActivityKey> | undefined {
  return PARTNERSHIP_ACTIVITY.find((entry) => entry.key === value);
}

/**
 * The human labels. Total on purpose, exactly as `copyStatusLabel` and `themeCategoryLabel` are: a
 * row written by a newer build renders its own value back rather than an empty chip, so a card never
 * shows a blank where a label belongs.
 */
export function creatorInternalStatusLabel(value: string): string {
  return creatorInternalStatusEntry(value)?.label ?? value;
}

export function creatorStatusLabel(value: string): string {
  return creatorStatusEntry(value)?.label ?? value;
}

export function creatorAssetsStatusLabel(value: string): string {
  return creatorAssetsStatusEntry(value)?.label ?? value;
}

export function partnershipActivityLabel(value: string): string {
  return partnershipActivityEntry(value)?.label ?? value;
}

/**
 * Tones for the CS review shared by the internal creator track and the assets track. Keyed on the
 * key rather than routed through `chipTone(label)` because `Request` and `Pending for CS Approval`
 * are words `chipTone` has no rule for, and because both lists are reviewed the same way:
 *
 *   - `request` → `mute`. Nothing has happened to this row yet; a fresh sourcing list should read as
 *     quiet, not as seven things demanding attention.
 *   - `pending_for_cs_approval` → `info`, matching `Pending for Approval` on the creative client
 *     track and `pending_for_client_review` on copy: waiting on someone else is the normal state of
 *     a live row, not a problem.
 *   - `revisions_needed` → `warn` and `approved` → `ok`, both agreeing with `chipTone` exactly,
 *     because they mean here what they mean on a creative.
 */
function csReviewTone(value: string): ChipTone {
  if (value === 'approved') {
    return 'ok';
  }
  if (value === 'revisions_needed') {
    return 'warn';
  }
  if (value === 'pending_for_cs_approval') {
    return 'info';
  }
  if (value === 'request') {
    return 'mute';
  }
  return 'mute';
}

export function creatorInternalStatusTone(value: string): ChipTone {
  return isCreatorInternalStatus(value) ? csReviewTone(value) : 'mute';
}

export function creatorAssetsStatusTone(value: string): ChipTone {
  return isCreatorAssetsStatus(value) ? csReviewTone(value) : 'mute';
}

/**
 * The `StatusChip` tone for the client-facing creator track, in the same `ChipTone` vocabulary every
 * other table uses — so the UGC grid reads as one system with the creatives table and no component
 * picks a colour by hand.
 *
 * Four of the seven agree with `chipTone` / `copyStatusTone` and mean what they mean everywhere:
 * `pending_for_approval` → `info`, `approved` → `ok`, `revisions_needed` → `warn`, `disapproved` →
 * `bad` (the terminal refusal, exactly as on a copy row). The three that are new to this track:
 *
 *   - `due_shipment` → `warn`. It is the only state in the platform blocked on TAS doing a physical
 *     thing, the deadline clock is already running, and a box that never shipped is the single most
 *     common way a booking silently rots. `mute` would hide precisely the row somebody must action.
 *   - `filming_in_progress` → `accent`. Work actively in motion, which is what `accent` means on
 *     `Launched`: not a question, not a problem, just the thing happening.
 *   - `video_delivered` → `ok`. The deliverable landed. It shares `ok` with `approved` deliberately:
 *     both are good outcomes of different questions, and the label carries the difference.
 *
 * Total: an unknown value gets `mute`, the same fallback `chipTone` gives anything it does not know.
 */
export function creatorStatusTone(value: string): ChipTone {
  const tones: Readonly<Record<CreatorStatusKey, ChipTone>> = {
    pending_for_approval: 'info',
    approved: 'ok',
    revisions_needed: 'warn',
    disapproved: 'bad',
    due_shipment: 'warn',
    filming_in_progress: 'accent',
    video_delivered: 'ok',
  };
  return isCreatorStatus(value) ? tones[value] : 'mute';
}

/**
 * The tone of the STATED partnership activity (what a human declared), not of the derived expiry
 * countdown — that is `expiryTone` in `@tas/domain/creators`, and the two are shown side by side in
 * the Partnership Ads table precisely so a disagreement between them is visible.
 *
 *   - `active` → `ok`. Permission is in force.
 *   - `not_active` → `mute`. The resting state of most rows; it is not news.
 *   - `ended` → `bad`. Not a judgement of the creator: a whitelisting window that has closed means
 *     any ad still running from that handle is running without permission, which is the one thing
 *     §5.8.1 exists to stop.
 */
export function partnershipActivityTone(value: string): ChipTone {
  const tones: Readonly<Record<PartnershipActivityKey, ChipTone>> = {
    active: 'ok',
    not_active: 'mute',
    ended: 'bad',
  };
  return isPartnershipActivity(value) ? tones[value] : 'mute';
}
