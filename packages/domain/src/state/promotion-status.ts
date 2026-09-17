/**
 * The three states a promotion request lives in (PRD §5, §14.1; ticket `propagation` criterion 7).
 *
 * PRD §5: "Sometimes, we test an idea a child base … request comes in to the ADMIN dashboard to
 * approve everything." That is the whole machine: a brand raises a request, an agency admin settles
 * it, and nothing auto-promotes. Three states, one hop, no branches — which is why this is a flat
 * list shaped like `COPY_STATUS` rather than a pair of tracks like the creative statuses.
 *
 * `promotion_requests.status` in `@tas/db` is plain `text` carrying one of these KEYS, and
 * `PROMOTION_STATUS_DEFAULT` there is this list's first entry hand-copied: the domain owns the set
 * of states, their labels and their chip tones, the column only stores which one a row is in.
 * `@tas/db` does not depend on `@tas/domain` (the edge runs the other way everywhere in this repo),
 * so `apps/web` is where the two vocabularies are asserted equal — the arrangement `state/copy-status`
 * and `schema/copy.ts` already document. No component writes a status string of its own and none
 * picks a chip colour locally (CLAUDE.md non-negotiable 2).
 *
 * THE TONE LIVES ON THE ENTRY, unlike `copyStatusTone`'s lookup table. There are only three states
 * and each one's colour is an obvious consequence of its meaning, so splitting label and colour into
 * two structures would just be two places to forget. `promotionStatusTone` reads the entry.
 */

import type { ChipTone, StatusEntry } from './creative-status';

/** A promotion state: the `StatusEntry` shape every other status list uses, plus its chip tone. */
export interface PromotionStatusEntry<Key extends string = string> extends StatusEntry<Key> {
  readonly tone: ChipTone;
}

/**
 * Pending, approved, rejected — in the order the machine runs, not alphabetically.
 *
 * The first entry is load-bearing: it is the state a fresh request starts in, it is the only state
 * `/app/propagation` lists (criterion 4 — the page is a QUEUE, not a history), and it is what
 * `PROMOTION_STATUS_DEFAULT` in `packages/db/src/schema/promotion-requests.ts` copies.
 *
 * Tones:
 *   - `pending` → `info`. Waiting on a person is not a problem, it is the normal state of a fresh
 *     request. Matches `pending_for_client_review` on the copy track for the same reason.
 *   - `approved` → `ok`. Agrees with `chipTone('Approved')` exactly, because it means here what it
 *     means on a creative: somebody signed off.
 *   - `rejected` → `bad`. A refusal, not a revision: there is no "raise it again" state, so nothing
 *     softer than `bad` would be honest. It is the sibling of `disapproved` on the copy track.
 */
export const PROMOTION_STATUS = [
  {
    key: 'pending',
    label: 'Pending',
    description:
      'Raised by a brand and waiting on an agency admin. The only state /app/propagation lists.',
    tone: 'info',
  },
  {
    key: 'approved',
    label: 'Approved',
    description:
      'An admin promoted the change into the template, so every brand inherits it from here.',
    tone: 'ok',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    description:
      'An admin declined the promotion. The change stays local to the brand that made it.',
    tone: 'bad',
  },
] as const satisfies readonly PromotionStatusEntry[];

export type PromotionStatusKey = (typeof PROMOTION_STATUS)[number]['key'];

/** The state a new request starts in. `@tas/db`'s `PROMOTION_STATUS_DEFAULT` is this key, copied. */
export const PROMOTION_STATUS_INITIAL: PromotionStatusKey = PROMOTION_STATUS[0].key;

/** Just the keys, for a validator or a query that needs the raw vocabulary. */
export const PROMOTION_STATUS_KEYS: readonly PromotionStatusKey[] = PROMOTION_STATUS.map(
  (entry) => entry.key,
);

export function isPromotionStatus(value: string): value is PromotionStatusKey {
  return PROMOTION_STATUS_KEYS.includes(value as PromotionStatusKey);
}

/** The entry for a stored value, or `undefined` for a value this build does not know. */
export function promotionStatusEntry(value: string): PromotionStatusEntry | undefined {
  return PROMOTION_STATUS.find((entry) => entry.key === value);
}

/**
 * The human label for a stored status. Total on purpose, exactly as `copyStatusLabel` is: a row
 * written by a newer build renders its own value back rather than an empty chip.
 */
export function promotionStatusLabel(value: string): string {
  return promotionStatusEntry(value)?.label ?? value;
}

/**
 * The `StatusChip` tone for a status, in the same `ChipTone` vocabulary every other table uses.
 * Total: an unknown value gets `mute`, the fallback `chipTone` gives anything it does not know.
 */
export function promotionStatusTone(value: string): ChipTone {
  return promotionStatusEntry(value)?.tone ?? 'mute';
}
