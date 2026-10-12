/**
 * The two-track approval state machine (PRD §8, design handoff 2026-09-16; internal track
 * consolidated 2026-10-12, Oct 12 client sync Ticket 5 / migration 0067).
 *
 * Labels and descriptions here are the source of truth for tooltips, notifications and analytics
 * labels. The UI never writes a status string of its own, never recomputes the client gate and never
 * decides a chip colour locally: it imports from this module.
 *
 * ONE INTERNAL LIST FOR BOTH TRACKS. Until 2026-10-12 the internal track was two lists — a video
 * ladder (`sent_to_video_editor`, `video_editing_in_progress`, `videos_revisions`, …) and a static
 * one (`sent_to_designer`, `static_design_in_progress`, `images_revisions`, …) — plus an `on_hold`
 * branch and a `launched` terminal. Talal's Oct 12 ruling collapsed them: the creative's TRACK
 * (`CreativeTrack`, video or static) still decides who builds it and which QA ticks it needs, but
 * the status words are the same for both. `launched` is no longer an internal state: the media
 * buyer's launch is the brief's `launched_at` and the CLIENT track's own `launched`. `on_hold` was
 * never used in production and is gone. Migration 0067 moved every stored row onto this list.
 */

export interface StatusEntry<Key extends string = string> {
  readonly key: Key;
  readonly label: string;
  readonly description: string;
}

/**
 * The internal track, in flow order. `revisions_submitted` keeps the plural spelling every stored
 * row carries (17 live briefs on 2026-10-12); the Oct 12 brief wrote it singular — a one-line
 * rename migration and this one entry are what the singular would take.
 */
export const INTERNAL_STATUS = [
  {
    key: 'draft',
    label: 'Draft',
    description:
      'The brief exists and nobody has been asked to build it yet. Every new brief starts here.',
  },
  {
    key: 'sent_to_editor_or_designer',
    label: 'Sent to Editor / Designer',
    description:
      'The strategist submitted the brief and handed it to the editor (video) or the designer (static).',
  },
  {
    key: 'under_editing_or_designing',
    label: 'Under Editing / Designing',
    description: 'The editor or designer opened the brief and claimed it.',
  },
  {
    key: 'ad_submitted',
    label: 'Ad Submitted',
    description: 'The editor or designer uploaded a cut and marked the brief submitted.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'Internal reviewer left revisions. Client never sees this state.',
  },
  {
    key: 'revisions_submitted',
    label: 'Revisions Submitted',
    description: 'The editor or designer re-uploaded against the revision notes.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Internal sign-off. This is the gate that opens the client track.',
  },
] as const;

export const CLIENT_STATUS = [
  {
    key: 'pending_for_approval',
    label: 'Pending for Approval',
    description: 'Visible to the client the moment internal status hits Approved.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Client signed off. Moves to the media buyer queue.',
  },
  {
    key: 'revisions_needed',
    label: 'Revisions Needed',
    description: 'Client asked for changes. Sits here until the team resubmits the creative.',
  },
  {
    key: 'revisions_submitted',
    label: 'Revisions Submitted',
    description:
      'The team resubmitted against the client’s notes; back with the client for a decision. The Creative Sheet’s own state, kept when the sheet became a view over the briefs (2026-10-09).',
  },
  {
    key: 'disapproved',
    label: 'Disapproved',
    description:
      'Client rejected the creative outright. Not a revision: this creative is not being run (Oct 6 Talal ruling).',
  },
  {
    key: 'launched',
    label: 'Launched',
    description: 'Set by the media buyer once the ad is live in the account.',
  },
] as const;

/**
 * Which kind of creative a brief is: decides who builds it (editor or designer) and which QA ticks
 * it needs (`@tas/domain/state/qa-gate`). It no longer decides a status list.
 */
export type CreativeTrack = 'video' | 'static';

export type InternalStatusKey = (typeof INTERNAL_STATUS)[number]['key'];
export type ClientStatusKey = (typeof CLIENT_STATUS)[number]['key'];

/** Where every new brief — and every duplicate — starts: the first step of the list. */
export const INTERNAL_ENTRY_STATUS: InternalStatusKey = 'draft';

/** Whether a stored string is one of `INTERNAL_STATUS`'s keys. */
export function isInternalStatusKey(value: string): value is InternalStatusKey {
  return INTERNAL_STATUS.some((entry) => entry.key === value);
}

/** Whether a stored string is one of `CLIENT_STATUS`'s keys. */
export function isClientStatusKey(value: string): value is ClientStatusKey {
  return CLIENT_STATUS.some((entry) => entry.key === value);
}

/** The label of an internal status; a stored value this build has no row for reads as itself. */
export function internalStatusLabel(key: string): string {
  return INTERNAL_STATUS.find((entry) => entry.key === key)?.label ?? key;
}

/**
 * The client track's LINEAR path: `CLIENT_STATUS` without the branches.
 *
 * PRD §9 writes the client track as "Pending for Approval → Approved / Revisions Needed → Launched",
 * and the Oct 6 Talal ruling added `disapproved` as a second terminal branch alongside
 * `revisions_needed`. Both are BRANCHES off the client's decision, and a linear stepper cannot
 * honestly place them: drawn as third or fourth rows they would mark Approved as `done` on a
 * creative the client had just rejected or sent back. So a stepper walks this list and renders the
 * branches with the status chip instead. `CLIENT_STATUS` itself is untouched — it is the vocabulary
 * of the stored column.
 */
export const CLIENT_TRACK_STEPS: readonly StatusEntry<ClientStatusKey>[] = CLIENT_STATUS.filter(
  (entry) =>
    entry.key !== 'revisions_needed' &&
    entry.key !== 'revisions_submitted' &&
    entry.key !== 'disapproved',
);

export type StepState = 'done' | 'now' | 'next';
export type ChipTone = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute';

/**
 * The gate. Every UI that renders the client track imports this. No component computes it itself.
 * Total over any stored string: a value this build has no row for keeps the gate shut.
 */
export function isClientTrackOpen(internal: string): boolean {
  return internal === 'approved';
}

/**
 * Where `key` sits relative to `current` in a linear stepper. A `current` that is not in the list
 * (a client status handed the internal list, a value this build has no row for) leaves every step
 * upcoming.
 */
export function stepState(list: readonly StatusEntry[], current: string, key: string): StepState {
  const currentIndex = list.findIndex((entry) => entry.key === current);
  const keyIndex = list.findIndex((entry) => entry.key === key);
  if (keyIndex === -1) {
    return 'next';
  }
  if (keyIndex === currentIndex) {
    return 'now';
  }
  return currentIndex > keyIndex ? 'done' : 'next';
}

/**
 * Tone for a status chip, keyed on the human label (the handoff's map). `Revisions Submitted` holds
 * both words, so the `Submitted` exclusion keeps it out of `warn` and it lands on `mute`, where
 * `Draft` and the two working steps sit too.
 *
 * `Disapproved` is the Oct 6 Talal addition: the client-track terminal refusal, matching
 * `COPY_STATUS`'s and `CREATOR_STATUS`'s existing `disapproved` → `bad` reading. `Launched` is the
 * client track's terminal state (the internal track has no launch since 2026-10-12).
 */
export function chipTone(label: string): ChipTone {
  if (label === 'Approved') {
    return 'ok';
  }
  if (label === 'Launched') {
    return 'accent';
  }
  if (label === 'Disapproved') {
    return 'bad';
  }
  if (label.includes('Revisions') && !label.includes('Submitted')) {
    return 'warn';
  }
  if (label === 'Pending for Approval') {
    return 'info';
  }
  return 'mute';
}

type TransitionTable<Key extends string> = Readonly<Record<Key, readonly Key[]>>;

/**
 * Internal transitions, one table for both tracks. Linear through the working steps, a revision
 * loop between Ad Submitted / Revisions Submitted and Revisions Needed, and `approved` terminal:
 * the launch is the media buyer's `launched_at` and the client track's `launched`, never an
 * internal move.
 */
export const INTERNAL_TRANSITIONS: TransitionTable<InternalStatusKey> = {
  draft: ['sent_to_editor_or_designer'],
  sent_to_editor_or_designer: ['under_editing_or_designing'],
  under_editing_or_designing: ['ad_submitted'],
  ad_submitted: ['revisions_needed', 'approved'],
  revisions_needed: ['revisions_submitted'],
  revisions_submitted: ['revisions_needed', 'approved'],
  approved: [],
};

/**
 * The client track exactly as PRD §9 writes it, extended by the Oct 6 Talal ruling (see
 * `docs/decisions.md` 2026-10-07) and the 2026-10-09 cutover. The decision branches three ways:
 * `approved`, `revisions_needed` and `disapproved`. From `revisions_needed` the team either
 * resubmits as `revisions_submitted` — the Creative Sheet's own word for "back with the client",
 * which then takes the same three-way decision — or the creative goes back to
 * `pending_for_approval`; `disapproved` is a terminal rejection, matching `CREATOR_STATUS` /
 * `COPY_STATUS`'s existing terminal of the same name; `launched` is the media buyer's terminal state.
 */
export const CLIENT_TRANSITIONS: TransitionTable<ClientStatusKey> = {
  pending_for_approval: ['approved', 'revisions_needed', 'disapproved'],
  approved: ['launched'],
  revisions_needed: ['pending_for_approval', 'revisions_submitted'],
  revisions_submitted: ['approved', 'revisions_needed', 'disapproved'],
  disapproved: [],
  launched: [],
};

/**
 * `false` for an unknown key, for any skip and for the terminal state. Total over stored strings:
 * the table is read with a widened index, so a value written by a newer build answers `false`
 * rather than throwing — refusing withholds a control, it never invents a move.
 */
export function canTransitionInternal(from: string, to: string): boolean {
  const table: Readonly<Record<string, readonly string[]>> = INTERNAL_TRANSITIONS;
  const allowed = table[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Client transitions are refused whenever the gate is closed: with internal earlier than Approved the
 * client track does not exist yet, so no client move is legal. Total over its inputs the same way.
 */
export function canTransitionClient(internal: string, from: string, to: string): boolean {
  if (!isClientTrackOpen(internal)) {
    return false;
  }
  const table: Readonly<Record<string, readonly string[]>> = CLIENT_TRANSITIONS;
  const allowed = table[from];
  return allowed !== undefined && allowed.includes(to);
}
