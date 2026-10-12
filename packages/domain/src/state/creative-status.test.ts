import { describe, expect, it } from 'vitest';

import {
  CLIENT_STATUS,
  CLIENT_TRACK_STEPS,
  CLIENT_TRANSITIONS,
  INTERNAL_ENTRY_STATUS,
  INTERNAL_STATUS,
  INTERNAL_TRANSITIONS,
  canTransitionClient,
  canTransitionInternal,
  chipTone,
  internalStatusLabel,
  isClientTrackOpen,
  isInternalStatusKey,
  stepState,
  type ChipTone,
  type ClientStatusKey,
  type InternalStatusKey,
} from './creative-status';

/** The internal keys the Oct 7 two-track machine carried and migration 0067 moved off the column. */
const RETIRED_INTERNAL_KEYS = [
  'sent_to_video_editor',
  'sent_to_designer',
  'video_editing_in_progress',
  'static_design_in_progress',
  'videos_revisions',
  'images_revisions',
  'launched',
  'on_hold',
];

describe('the status vocabularies', () => {
  it('lists the one internal track for both creative tracks in flow order (Oct 12 consolidation, 0067)', () => {
    expect(INTERNAL_STATUS.map((entry) => entry.key)).toEqual([
      'draft',
      'sent_to_editor_or_designer',
      'under_editing_or_designing',
      'ad_submitted',
      'revisions_needed',
      'revisions_submitted',
      'approved',
    ]);
  });

  it('carries none of the retired keys: no per-track step, no on_hold, no internal launched', () => {
    const keys: readonly string[] = INTERNAL_STATUS.map((entry) => entry.key);
    for (const retired of RETIRED_INTERNAL_KEYS) {
      expect(keys, retired).not.toContain(retired);
      expect(isInternalStatusKey(retired), retired).toBe(false);
    }
  });

  it('starts every brief at draft, the first step of the list', () => {
    expect(INTERNAL_ENTRY_STATUS).toBe('draft');
    expect(INTERNAL_STATUS[0].key).toBe(INTERNAL_ENTRY_STATUS);
  });

  it('keeps the stored spelling revisions_submitted (17 live rows on 2026-10-12), labelled Revisions Submitted', () => {
    expect(isInternalStatusKey('revisions_submitted')).toBe(true);
    expect(isInternalStatusKey('revision_submitted')).toBe(false);
    expect(internalStatusLabel('revisions_submitted')).toBe('Revisions Submitted');
  });

  it('labels every key, and reads an unknown stored value as itself', () => {
    expect(internalStatusLabel('sent_to_editor_or_designer')).toBe('Sent to Editor / Designer');
    expect(internalStatusLabel('under_editing_or_designing')).toBe('Under Editing / Designing');
    expect(internalStatusLabel('draft')).toBe('Draft');
    expect(internalStatusLabel('from_a_newer_build')).toBe('from_a_newer_build');
  });

  it('gives every entry a non-empty description', () => {
    for (const entry of [...INTERNAL_STATUS, ...CLIENT_STATUS]) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('lists the client track in PRD §9 order, both terminal branches included (Oct 6 Talal ruling)', () => {
    // `disapproved` sits after `revisions_needed` and before `launched`: the two work-remains
    // branches sit together and the two terminal states sit at the tail. See docs/decisions.md
    // 2026-10-07 for the ruling that promoted it from a creator/copy-only state. The client track
    // is untouched by the Oct 12 internal consolidation — `launched` stays HERE.
    expect(CLIENT_STATUS.map((entry) => entry.key)).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
      'revisions_submitted',
      'disapproved',
      'launched',
    ]);
  });

  it('gives disapproved a non-empty label, description, and the shipped StatusEntry shape', () => {
    const entry = CLIENT_STATUS.find((row) => row.key === 'disapproved');
    expect(entry).toBeDefined();
    expect(entry?.label).toBe('Disapproved');
    expect(entry?.description.length).toBeGreaterThan(0);
    // Shipped shape, exactly as the other entries carry.
    expect(Object.keys(entry ?? {}).sort()).toEqual(['description', 'key', 'label']);
  });

  it('keeps the three branches out of the linear client stepper', () => {
    expect(CLIENT_TRACK_STEPS.map((entry) => entry.key)).toEqual([
      'pending_for_approval',
      'approved',
      'launched',
    ]);
    // The entries are CLIENT_STATUS', never retyped.
    for (const entry of CLIENT_TRACK_STEPS) {
      expect(CLIENT_STATUS).toContainEqual(entry);
    }
  });

  it('leaves every client step upcoming while the creative sits on Revisions Needed', () => {
    const states = CLIENT_TRACK_STEPS.map((entry) =>
      stepState(CLIENT_TRACK_STEPS, 'revisions_needed', entry.key),
    );
    expect(states).toEqual(['next', 'next', 'next']);
  });

  it('leaves every client step upcoming while the creative sits on Disapproved', () => {
    const states = CLIENT_TRACK_STEPS.map((entry) =>
      stepState(CLIENT_TRACK_STEPS, 'disapproved', entry.key),
    );
    expect(states).toEqual(['next', 'next', 'next']);
  });
});

describe('isClientTrackOpen — the gate truth table over every key', () => {
  const expected: Record<InternalStatusKey, boolean> = {
    draft: false,
    sent_to_editor_or_designer: false,
    under_editing_or_designing: false,
    ad_submitted: false,
    revisions_needed: false,
    revisions_submitted: false,
    approved: true,
  };

  for (const [key, open] of Object.entries(expected)) {
    it(`${key} -> ${String(open)}`, () => {
      expect(isClientTrackOpen(key)).toBe(open);
    });
  }

  it('covers every key of the internal list', () => {
    expect(INTERNAL_STATUS.map((entry) => entry.key).sort()).toEqual(Object.keys(expected).sort());
  });

  it('keeps the gate shut for a retired key and for a value this build has no row for', () => {
    for (const retired of RETIRED_INTERNAL_KEYS)
      expect(isClientTrackOpen(retired), retired).toBe(false);
    expect(isClientTrackOpen('from_a_newer_build')).toBe(false);
    expect(isClientTrackOpen('')).toBe(false);
  });
});

describe('stepState', () => {
  const list = INTERNAL_STATUS;

  it('marks earlier steps done, the current step now and later steps next', () => {
    expect(stepState(list, 'ad_submitted', 'draft')).toBe('done');
    expect(stepState(list, 'ad_submitted', 'sent_to_editor_or_designer')).toBe('done');
    expect(stepState(list, 'ad_submitted', 'under_editing_or_designing')).toBe('done');
    expect(stepState(list, 'ad_submitted', 'ad_submitted')).toBe('now');
    expect(stepState(list, 'ad_submitted', 'revisions_needed')).toBe('next');
    expect(stepState(list, 'ad_submitted', 'approved')).toBe('next');
  });

  it('marks every step done at the terminal step except the terminal step itself', () => {
    const states = list.map((entry) => stepState(list, 'approved', entry.key));
    expect(states).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'now']);
  });

  it('leaves the stepper entirely upcoming for a current value outside the list', () => {
    expect(list.every((entry) => stepState(list, 'on_hold', entry.key) === 'next')).toBe(true);
    expect(
      list.every((entry) => stepState(list, 'pending_for_approval', entry.key) === 'next'),
    ).toBe(true);
  });

  it('treats an unknown step as upcoming', () => {
    expect(stepState(list, 'approved', 'sent_to_designer')).toBe('next');
  });
});

describe('chipTone — the tone map over every label', () => {
  const cases: [string, ChipTone][] = [
    ['Approved', 'ok'],
    ['Launched', 'accent'],
    ['Revisions Needed', 'warn'],
    ['Revisions Submitted', 'mute'],
    ['Disapproved', 'bad'],
    ['Pending for Approval', 'info'],
    ['Draft', 'mute'],
    ['Sent to Editor / Designer', 'mute'],
    ['Under Editing / Designing', 'mute'],
    ['Ad Submitted', 'mute'],
    ['locked', 'mute'],
  ];

  for (const [label, tone] of cases) {
    it(`${label} -> ${tone}`, () => {
      expect(chipTone(label)).toBe(tone);
    });
  }

  it('covers every label the status vocabularies can produce', () => {
    const labels = new Set<string>([
      ...INTERNAL_STATUS.map((entry) => entry.label),
      ...CLIENT_STATUS.map((entry) => entry.label),
    ]);
    const covered = new Set(cases.map(([label]) => label));
    for (const label of labels) {
      expect(covered.has(label), label).toBe(true);
    }
  });
});

describe('canTransitionInternal', () => {
  it('walks the legal path end to end, the same for a video and a static brief', () => {
    const path: InternalStatusKey[] = [
      'draft',
      'sent_to_editor_or_designer',
      'under_editing_or_designing',
      'ad_submitted',
      'revisions_needed',
      'revisions_submitted',
      'approved',
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index] as InternalStatusKey;
      const to = path[index + 1] as InternalStatusKey;
      expect(canTransitionInternal(from, to), `${from} → ${to}`).toBe(true);
    }
  });

  it('allows the happy path that skips revisions, and a second round of revisions', () => {
    expect(canTransitionInternal('ad_submitted', 'approved')).toBe(true);
    expect(canTransitionInternal('revisions_submitted', 'revisions_needed')).toBe(true);
    expect(canTransitionInternal('revisions_submitted', 'approved')).toBe(true);
  });

  it('refuses skips, reversals and the terminal state', () => {
    expect(canTransitionInternal('draft', 'under_editing_or_designing')).toBe(false);
    expect(canTransitionInternal('sent_to_editor_or_designer', 'approved')).toBe(false);
    expect(canTransitionInternal('ad_submitted', 'sent_to_editor_or_designer')).toBe(false);
    expect(canTransitionInternal('approved', 'ad_submitted')).toBe(false);
    expect(canTransitionInternal('approved', 'draft')).toBe(false);
    expect(canTransitionInternal('ad_submitted', 'ad_submitted')).toBe(false);
  });

  it('refuses every retired key, as a source and as a target, and answers false rather than throwing', () => {
    for (const retired of RETIRED_INTERNAL_KEYS) {
      expect(canTransitionInternal(retired, 'ad_submitted'), retired).toBe(false);
      expect(canTransitionInternal('ad_submitted', retired), retired).toBe(false);
    }
    expect(canTransitionInternal('from_a_newer_build', 'approved')).toBe(false);
    expect(canTransitionInternal('approved', 'launched')).toBe(false);
  });

  it('gives every internal status a row, with approved terminal', () => {
    for (const entry of INTERNAL_STATUS) {
      expect(INTERNAL_TRANSITIONS[entry.key]).toBeDefined();
    }
    expect(INTERNAL_TRANSITIONS.approved).toEqual([]);
    expect(INTERNAL_TRANSITIONS.draft).toEqual(['sent_to_editor_or_designer']);
  });
});

describe('canTransitionClient', () => {
  const closed: InternalStatusKey[] = [
    'draft',
    'sent_to_editor_or_designer',
    'under_editing_or_designing',
    'ad_submitted',
    'revisions_needed',
    'revisions_submitted',
  ];

  it('allows the legal client path once the gate is open', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'approved')).toBe(true);
    expect(canTransitionClient('approved', 'approved', 'launched')).toBe(true);
  });

  it('branches Pending for Approval to Revisions Needed, PRD §9’s other outcome', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'revisions_needed')).toBe(true);
  });

  it('branches Pending for Approval to Disapproved, the Oct 6 Talal terminal rejection', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'disapproved')).toBe(true);
  });

  it('rejoins Revisions Needed to Pending for Approval when the team resubmits', () => {
    expect(canTransitionClient('approved', 'revisions_needed', 'pending_for_approval')).toBe(true);
  });

  it('refuses the moves Revisions Needed is not a shortcut for', () => {
    expect(canTransitionClient('approved', 'revisions_needed', 'approved')).toBe(false);
    expect(canTransitionClient('approved', 'revisions_needed', 'launched')).toBe(false);
    expect(canTransitionClient('approved', 'revisions_needed', 'disapproved')).toBe(false);
    expect(canTransitionClient('approved', 'approved', 'revisions_needed')).toBe(false);
    expect(canTransitionClient('approved', 'launched', 'revisions_needed')).toBe(false);
  });

  it('is terminal from Disapproved: no outgoing move, not even back to Pending', () => {
    expect(canTransitionClient('approved', 'disapproved', 'pending_for_approval')).toBe(false);
    expect(canTransitionClient('approved', 'disapproved', 'approved')).toBe(false);
    expect(canTransitionClient('approved', 'disapproved', 'revisions_needed')).toBe(false);
    expect(canTransitionClient('approved', 'disapproved', 'launched')).toBe(false);
  });

  it('refuses every client transition while the gate is closed — the retired internal launched included', () => {
    const pairs: [ClientStatusKey, ClientStatusKey][] = [
      ['pending_for_approval', 'approved'],
      ['pending_for_approval', 'revisions_needed'],
      ['pending_for_approval', 'disapproved'],
      ['revisions_needed', 'pending_for_approval'],
      ['approved', 'launched'],
    ];
    for (const internal of [...closed, 'launched', 'on_hold']) {
      for (const [from, to] of pairs) {
        expect(canTransitionClient(internal, from, to), `${internal}: ${from} → ${to}`).toBe(false);
      }
    }
  });

  it('refuses skips and reversals even with the gate open', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'launched')).toBe(false);
    expect(canTransitionClient('approved', 'approved', 'pending_for_approval')).toBe(false);
    expect(canTransitionClient('approved', 'launched', 'approved')).toBe(false);
    expect(canTransitionClient('approved', 'launched', 'launched')).toBe(false);
  });

  it('is PRD §9’s table: one branch out of Pending, one way back, one terminal state', () => {
    expect(CLIENT_TRANSITIONS.pending_for_approval).toEqual([
      'approved',
      'revisions_needed',
      'disapproved',
    ]);
    expect(CLIENT_TRANSITIONS.approved).toEqual(['launched']);
    expect(CLIENT_TRANSITIONS.revisions_needed).toEqual([
      'pending_for_approval',
      'revisions_submitted',
    ]);
    // Resubmitted work takes the same three-way client decision as a fresh submission.
    expect(CLIENT_TRANSITIONS.revisions_submitted).toEqual([
      'approved',
      'revisions_needed',
      'disapproved',
    ]);
    expect(CLIENT_TRANSITIONS.disapproved).toEqual([]);
    expect(CLIENT_TRANSITIONS.launched).toEqual([]);
  });

  it('gives every client status an entry, so a stored value can never hit a missing row', () => {
    for (const entry of CLIENT_STATUS) {
      expect(CLIENT_TRANSITIONS[entry.key]).toBeDefined();
    }
  });

  it('answers false rather than throwing for a stored status this build has no row for', () => {
    expect(canTransitionClient('approved', 'from_a_newer_build', 'approved')).toBe(false);
  });
});
