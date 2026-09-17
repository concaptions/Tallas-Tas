/**
 * The copy approval states (PRD §5.11), alongside the creative state machine in `./creative-status`.
 *
 * Copy has ONE track, not two. A creative carries an internal status the client never sees and a
 * client status gated behind it (`isClientTrackOpen`); a copy row is written by the team and then
 * handed straight to the client, so every state here is client-facing and there is no gate to open.
 * That is why this is a flat list shaped exactly like `CLIENT_STATUS` — `key`, `label`,
 * `description` — and not a second pair of tracks.
 *
 * `copywriting.status` in `@tas/db` is plain `text` carrying one of these KEYS, and
 * `COPY_STATUS_DEFAULT` there is this list's first entry verbatim: the domain owns the set of states
 * and their labels, the column only stores which one a row is in. No component and no query writes a
 * status string of its own (CLAUDE.md non-negotiable 2) and none decides a chip colour locally.
 */

import type { ChipTone, StatusEntry } from './creative-status';

/**
 * PRD §5.11: "Pending For Client Review → Edited By Client / Approved / Revisions Needed /
 * Disapproved". The arrow is the whole shape of it — one entry state, then four ways out — so the
 * order here is the PRD's: the entry state first, then the four outcomes as it lists them.
 *
 * The first entry is load-bearing twice over: it is the value a fresh row starts at, and
 * `COPY_STATUS_DEFAULT` in `packages/db/src/schema/copy.ts` is a hand-copy of its key (`@tas/db`
 * does not depend on `@tas/domain`, the edge runs the other way everywhere in this repo, and
 * `apps/web` is where the two are asserted equal).
 */
export const COPY_STATUS = [
  {
    key: 'pending_for_client_review',
    label: 'Pending For Client Review',
    description:
      'Where every copy row starts: written by the team, waiting on the client to read it.',
  },
  {
    key: 'edited_by_client',
    label: 'Edited By Client',
    description:
      'The client rewrote the copy themselves. What they changed is in Client’s Comment.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Client signed off. The copy can run against the creative it is linked to.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'Client wants another pass. The copywriter rewrites and it returns to review.',
  },
  {
    key: 'disapproved',
    label: 'Disapproved',
    description: 'Client rejected the copy outright. Not a revision: this angle is not being run.',
  },
] as const satisfies readonly StatusEntry[];

export type CopyStatusKey = (typeof COPY_STATUS)[number]['key'];

/** The state a new copy row starts in. `@tas/db`'s `COPY_STATUS_DEFAULT` is this key, copied. */
export const COPY_STATUS_INITIAL: CopyStatusKey = COPY_STATUS[0].key;

/** Just the keys, for a validator or a `<select>` that needs the raw vocabulary. */
export const COPY_STATUS_KEYS: readonly CopyStatusKey[] = COPY_STATUS.map((entry) => entry.key);

export function isCopyStatus(value: string): value is CopyStatusKey {
  return COPY_STATUS_KEYS.includes(value as CopyStatusKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function copyStatusEntry(value: string): StatusEntry<CopyStatusKey> | undefined {
  return COPY_STATUS.find((entry) => entry.key === value);
}

/**
 * The human label for a stored status. Total on purpose, exactly as `conceptCategoryLabel` is: a row
 * written by a newer build renders its own value back rather than an empty cell, so the table never
 * shows a blank where a chip label belongs.
 */
export function copyStatusLabel(value: string): string {
  return copyStatusEntry(value)?.label ?? value;
}

/**
 * The `StatusChip` tone for a copy status, in the same `ChipTone` vocabulary the creative statuses
 * use — so the two tables read as one system and no component picks a colour by hand.
 *
 * It is keyed on the KEY rather than routed through `chipTone(label)` because three of these five
 * labels are new words that map deliberately, not incidentally:
 *
 *   - `approved` → `ok` and `revisions_needed` → `warn` agree with `chipTone` exactly (a test pins
 *     that), because they mean here what they mean on a creative.
 *   - `disapproved` → `bad`. It is the only terminal refusal anywhere in the platform; `chipTone`
 *     has no rule for it because no creative status is a rejection.
 *   - `pending_for_client_review` → `info`, matching `Pending for Approval` on the client track:
 *     waiting on someone else is not a problem, it is the normal state of a fresh row.
 *   - `edited_by_client` → `accent`. The client touched the words themselves, which is the one state
 *     that needs a copywriter to go and read a comment; `mute` would bury exactly the row that has
 *     something to say.
 *
 * Total: an unknown value gets `mute`, the same fallback `chipTone` gives anything it does not know.
 */
export function copyStatusTone(value: string): ChipTone {
  const tones: Readonly<Record<CopyStatusKey, ChipTone>> = {
    pending_for_client_review: 'info',
    edited_by_client: 'accent',
    approved: 'ok',
    revisions_needed: 'warn',
    disapproved: 'bad',
  };
  return isCopyStatus(value) ? tones[value] : 'mute';
}
