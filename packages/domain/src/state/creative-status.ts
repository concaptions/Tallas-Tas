/**
 * The two-track approval state machine (PRD §8, design handoff 2026-09-16).
 *
 * Labels and descriptions here are the source of truth for tooltips, notifications and analytics
 * labels. The UI never writes a status string of its own, never recomputes the client gate and never
 * decides a chip colour locally: it imports from this module.
 */

export interface StatusEntry<Key extends string = string> {
  readonly key: Key;
  readonly label: string;
  readonly description: string;
}

export const INTERNAL_VIDEO_STATUS = [
  {
    key: 'sent_to_video_editor',
    label: 'Sent to Video Editor',
    description: 'Set when the strategist submits the brief and assigns an editor.',
  },
  {
    key: 'video_editing_in_progress',
    label: 'Video Editing in Progress',
    description: 'Editor opened the brief and claimed it.',
  },
  {
    key: 'ad_submitted',
    label: 'Ad Submitted',
    description: 'Editor uploaded a cut and marked the brief submitted.',
  },
  {
    key: 'videos_revisions',
    label: 'Videos Revisions',
    description: 'Internal reviewer left revisions. Client never sees this state.',
  },
  {
    key: 'revisions_submitted',
    label: 'Revisions Submitted',
    description: 'Editor re-uploaded against the revision notes.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Internal sign-off. This is the gate that opens the client track.',
  },
  {
    key: 'launched',
    label: 'Launched',
    description: 'Media buyer confirmed the ad is live.',
  },
] as const;

/**
 * Same shape as the video track. `Ad Submitted`, `Revisions Submitted`, `Approved` and `Launched`
 * are unchanged from the video list, description included; only the three track-specific entries
 * differ (handoff: "INTERNAL_STATIC_STATUS is the same shape with ... in place of the three video
 * entries").
 */
export const INTERNAL_STATIC_STATUS = [
  {
    key: 'sent_to_designer',
    label: 'Sent to Designer',
    description: 'Set when the strategist submits the brief and assigns a designer.',
  },
  {
    key: 'static_design_in_progress',
    label: 'Static Design in Progress',
    description: 'Designer opened the brief and claimed it.',
  },
  {
    key: 'ad_submitted',
    label: 'Ad Submitted',
    description: 'Editor uploaded a cut and marked the brief submitted.',
  },
  {
    key: 'images_revisions',
    label: 'Images Revisions',
    description: 'Internal reviewer left revisions. Client never sees this state.',
  },
  {
    key: 'revisions_submitted',
    label: 'Revisions Submitted',
    description: 'Editor re-uploaded against the revision notes.',
  },
  {
    key: 'approved',
    label: 'Approved',
    description: 'Internal sign-off. This is the gate that opens the client track.',
  },
  {
    key: 'launched',
    label: 'Launched',
    description: 'Media buyer confirmed the ad is live.',
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
    key: 'launched',
    label: 'Launched',
    description: 'Set by the media buyer once the ad is live in the account.',
  },
  {
    key: 'paused',
    label: 'Paused',
    description: 'Media buyer paused the live ad. Reversible — it can be resumed to Launched.',
  },
] as const;

/**
 * A branchable, non-linear state between `*_in_progress` and `ad_submitted`. It is rendered as a side
 * badge on the current step row, never as a step in the linear stepper, so it is deliberately not a
 * member of either internal list.
 */
export const ON_HOLD = {
  key: 'on_hold',
  label: 'On Hold',
  description:
    'Branchable non-linear state between in-progress and Ad Submitted. Rendered as a side badge on the current step row, never as a step in the linear stepper.',
} as const;

export type CreativeTrack = 'video' | 'static';

export type InternalVideoStatusKey = (typeof INTERNAL_VIDEO_STATUS)[number]['key'];
export type InternalStaticStatusKey = (typeof INTERNAL_STATIC_STATUS)[number]['key'];
export type InternalStatusKey = InternalVideoStatusKey | InternalStaticStatusKey;
export type ClientStatusKey = (typeof CLIENT_STATUS)[number]['key'];
export type OnHoldStatusKey = typeof ON_HOLD.key;
/** Every value the stored internal status column can hold, including the non-linear branch. */
export type InternalStatusOrHoldKey = InternalStatusKey | OnHoldStatusKey;

/**
 * The client track's LINEAR path: `CLIENT_STATUS` without the branch.
 *
 * PRD §9 writes the client track as "Pending for Approval → Approved / Revisions Needed → Launched".
 * `revisions_needed` is a BRANCH off the client's decision, the way `on_hold` branches off the
 * internal track, and a linear stepper cannot honestly place it: drawn as the third row it would mark
 * Approved as `done` on a creative the client had just sent back. So a stepper walks this list and
 * names `revisions_needed` with the status chip instead, which is the treatment `ON_HOLD` gets.
 * `paused` is the same shape at the other end — a branch off `launched`, not a step past it — so it
 * is excluded here too and rendered as a chip rather than a fourth row that would follow Launched.
 * `CLIENT_STATUS` itself is untouched — it is the vocabulary of the stored column.
 */
export const CLIENT_TRACK_STEPS: readonly StatusEntry<ClientStatusKey>[] = CLIENT_STATUS.filter(
  (entry) => entry.key !== 'revisions_needed' && entry.key !== 'paused',
);

export type StepState = 'done' | 'now' | 'next';
export type ChipTone = 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute';

/**
 * The gate. Every UI that renders the client track imports this. No component computes it itself.
 */
export function isClientTrackOpen(internal: InternalStatusKey): boolean {
  return internal === 'approved' || internal === 'launched';
}

/** The linear internal stepper for a track, in order. */
export function internalStatusFor(track: CreativeTrack): readonly StatusEntry<InternalStatusKey>[] {
  return track === 'video' ? INTERNAL_VIDEO_STATUS : INTERNAL_STATIC_STATUS;
}

/**
 * Where `key` sits relative to `current` in a linear stepper. A `current` that is not in the list
 * (`on_hold`, or a client status handed the internal list) leaves every step upcoming.
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
 * both words, so the `Submitted` exclusion keeps it out of `warn` and it lands on `mute`.
 */
export function chipTone(label: string): ChipTone {
  if (label === 'Approved') {
    return 'ok';
  }
  if (label === 'Launched') {
    return 'accent';
  }
  if (label === 'Paused') {
    return 'warn';
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
 * Internal transitions. `on_hold` branches off the in-progress step and rejoins at either the step it
 * left or `ad_submitted`; `launched` is terminal.
 */
export const INTERNAL_VIDEO_TRANSITIONS: TransitionTable<InternalVideoStatusKey | OnHoldStatusKey> =
  {
    sent_to_video_editor: ['video_editing_in_progress'],
    video_editing_in_progress: ['ad_submitted', 'on_hold'],
    on_hold: ['video_editing_in_progress', 'ad_submitted'],
    ad_submitted: ['videos_revisions', 'approved'],
    videos_revisions: ['revisions_submitted'],
    revisions_submitted: ['videos_revisions', 'approved'],
    approved: ['launched'],
    launched: [],
  };

export const INTERNAL_STATIC_TRANSITIONS: TransitionTable<
  InternalStaticStatusKey | OnHoldStatusKey
> = {
  sent_to_designer: ['static_design_in_progress'],
  static_design_in_progress: ['ad_submitted', 'on_hold'],
  on_hold: ['static_design_in_progress', 'ad_submitted'],
  ad_submitted: ['images_revisions', 'approved'],
  images_revisions: ['revisions_submitted'],
  revisions_submitted: ['images_revisions', 'approved'],
  approved: ['launched'],
  launched: [],
};

/**
 * The client track exactly as PRD §9 writes it: "Pending for Approval → Approved / Revisions Needed
 * → Launched". `pending_for_approval` branches on the client's decision; `revisions_needed` rejoins
 * at `pending_for_approval` when the team resubmits, which is the only way back onto the decision.
 * `launched` was the terminal state; `paused` extends the media buyer's control past it — a live ad
 * can be paused and resumed — so `launched` and `paused` are each other's only move and the pair is
 * a closed loop, never a way back onto the approval decision.
 */
export const CLIENT_TRANSITIONS: TransitionTable<ClientStatusKey> = {
  pending_for_approval: ['approved', 'revisions_needed'],
  approved: ['launched'],
  revisions_needed: ['pending_for_approval'],
  launched: ['paused'],
  paused: ['launched'],
};

export function internalTransitionsFor(
  track: CreativeTrack,
): Readonly<Record<string, readonly string[]>> {
  return track === 'video' ? INTERNAL_VIDEO_TRANSITIONS : INTERNAL_STATIC_TRANSITIONS;
}

/** `false` for a step that belongs to the other track, for an unknown key and for any skip. */
export function canTransitionInternal(
  track: CreativeTrack,
  from: InternalStatusOrHoldKey,
  to: InternalStatusOrHoldKey,
): boolean {
  const allowed = internalTransitionsFor(track)[from];
  return allowed !== undefined && allowed.includes(to);
}

/**
 * Client transitions are refused whenever the gate is closed: with internal earlier than Approved the
 * client track does not exist yet, so no client move is legal.
 *
 * Total over its inputs, including a stored status this build has no row for: the table is read with
 * `?.`, so a value written by a newer build answers `false` rather than throwing. Refusing is the safe
 * direction — it withholds a control, it never invents a move.
 */
export function canTransitionClient(
  internal: InternalStatusKey,
  from: ClientStatusKey,
  to: ClientStatusKey,
): boolean {
  if (!isClientTrackOpen(internal)) {
    return false;
  }
  // Widened to a stored string exactly as `canTransitionInternal` reads its table: the compiler sees
  // a total record, a database row does not have to be one.
  const table: Readonly<Record<string, readonly string[]>> = CLIENT_TRANSITIONS;
  const allowed = table[from];
  return allowed !== undefined && allowed.includes(to);
}
