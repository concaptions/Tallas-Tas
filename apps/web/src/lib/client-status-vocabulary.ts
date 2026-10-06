import {
  CLIENT_STATUS,
  COPY_STATUS,
  CREATOR_STATUS,
  type ClientStatusKey,
  type CopyStatusKey,
  type CreatorStatusKey,
} from '@tas/domain/state';

/**
 * The synchronous helpers for the Oct 5 client-status workflow (Agent 5). They live in a
 * NON-SERVER-ACTIONS module because Next.js refuses to compile a `'use server'` file that exports
 * anything other than async functions: splitting these out of `client-status-actions.ts` is the
 * only way to keep the vocabulary gate client-shareable and the write path server-only.
 */

/** Which table the record lives in. Each one has its own vocabulary and its own writer. */
export type ClientStatusTableKey = 'concepts' | 'creative_briefs' | 'creators' | 'copywriting';

/** The vocabulary each table's status key is checked against. */
const VOCABULARY: Record<ClientStatusTableKey, readonly string[]> = {
  concepts: CLIENT_STATUS.map((entry) => entry.key),
  creative_briefs: CLIENT_STATUS.map((entry) => entry.key),
  creators: CREATOR_STATUS.map((entry) => entry.key),
  copywriting: COPY_STATUS.map((entry) => entry.key),
};

export function clientStatusVocabulary(tableKey: ClientStatusTableKey): readonly string[] {
  return VOCABULARY[tableKey];
}

/**
 * The statuses whose decision must carry a reason. `revisions_needed` and `disapproved` on every
 * table that carries them (Oct 6 Talal ruling added `disapproved` to CLIENT_STATUS; see
 * `docs/decisions.md` 2026-10-07, which supersedes the Oct 5 mapping that routed disapproved onto
 * revisions_needed for concepts and briefs). The dropdown shows the Textarea only on these keys,
 * and the server rejects a blank one. Everywhere else the note is optional and may be null.
 */
export const NOTE_REQUIRED_STATUSES: readonly string[] = ['revisions_needed', 'disapproved'];

/** `true` if the chosen key for this table is one of the note-required branches. */
export function clientStatusRequiresNote(tableKey: ClientStatusTableKey, status: string): boolean {
  if (!NOTE_REQUIRED_STATUSES.includes(status)) {
    return false;
  }
  return VOCABULARY[tableKey].includes(status);
}

/**
 * Narrows a submitted key to the right track's typed key, for the symmetry with the two-track
 * approval control. Returns null when the key is not in the vocabulary.
 */
export function narrowClientStatusKey(
  tableKey: ClientStatusTableKey,
  value: string,
): ClientStatusKey | CreatorStatusKey | CopyStatusKey | null {
  if (!VOCABULARY[tableKey].includes(value)) {
    return null;
  }
  switch (tableKey) {
    case 'concepts':
    case 'creative_briefs':
      return value as ClientStatusKey;
    case 'creators':
      return value as CreatorStatusKey;
    case 'copywriting':
      return value as CopyStatusKey;
  }
}
