import { describe, expect, it } from 'vitest';

import {
  CLIENT_STATUS,
  CLIENT_TRACK_STEPS,
  CLIENT_TRANSITIONS,
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
  ON_HOLD,
  canTransitionClient,
  canTransitionInternal,
  chipTone,
  internalStatusFor,
  isClientTrackOpen,
  stepState,
  type ChipTone,
  type ClientStatusKey,
  type InternalStatusKey,
  type InternalStatusOrHoldKey,
} from './creative-status';

describe('the status vocabularies', () => {
  it('lists the seven internal video steps in order', () => {
    expect(INTERNAL_VIDEO_STATUS.map((entry) => entry.key)).toEqual([
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'videos_revisions',
      'revisions_submitted',
      'approved',
      'launched',
    ]);
  });

  it('swaps only the three track-specific entries on the static track', () => {
    expect(INTERNAL_STATIC_STATUS.map((entry) => entry.key)).toEqual([
      'sent_to_designer',
      'static_design_in_progress',
      'ad_submitted',
      'images_revisions',
      'revisions_submitted',
      'approved',
      'launched',
    ]);
    // Ad Submitted, Revisions Submitted, Approved and Launched are unchanged, description included.
    const shared = ['ad_submitted', 'revisions_submitted', 'approved', 'launched'];
    for (const key of shared) {
      expect(INTERNAL_STATIC_STATUS.find((entry) => entry.key === key)).toEqual(
        INTERNAL_VIDEO_STATUS.find((entry) => entry.key === key),
      );
    }
  });

  it('keeps on_hold out of both linear steppers', () => {
    expect(INTERNAL_VIDEO_STATUS.map((e) => e.key as string)).not.toContain(ON_HOLD.key);
    expect(INTERNAL_STATIC_STATUS.map((e) => e.key as string)).not.toContain(ON_HOLD.key);
    expect(ON_HOLD.label).toBe('On Hold');
  });

  it('gives every entry a non-empty description', () => {
    for (const entry of [...INTERNAL_VIDEO_STATUS, ...INTERNAL_STATIC_STATUS, ...CLIENT_STATUS]) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('lists the client track in PRD §9 order, Revisions Needed included', () => {
    expect(CLIENT_STATUS.map((entry) => entry.key)).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
      'launched',
    ]);
  });

  it('keeps the Revisions Needed branch out of the linear client stepper', () => {
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

  it('leaves every client step upcoming while the creative sits on the branch', () => {
    const states = CLIENT_TRACK_STEPS.map((entry) =>
      stepState(CLIENT_TRACK_STEPS, 'revisions_needed', entry.key),
    );
    expect(states).toEqual(['next', 'next', 'next']);
  });

  it('returns the list for the track', () => {
    expect(internalStatusFor('video')).toBe(INTERNAL_VIDEO_STATUS);
    expect(internalStatusFor('static')).toBe(INTERNAL_STATIC_STATUS);
  });
});

describe('isClientTrackOpen — the gate truth table over every key', () => {
  const expected: Record<InternalStatusKey, boolean> = {
    sent_to_video_editor: false,
    video_editing_in_progress: false,
    sent_to_designer: false,
    static_design_in_progress: false,
    ad_submitted: false,
    videos_revisions: false,
    images_revisions: false,
    revisions_submitted: false,
    approved: true,
    launched: true,
  };

  for (const [key, open] of Object.entries(expected)) {
    it(`${key} -> ${String(open)}`, () => {
      expect(isClientTrackOpen(key as InternalStatusKey)).toBe(open);
    });
  }

  it('covers every key that appears in either internal list', () => {
    const everyKey = new Set<string>([
      ...INTERNAL_VIDEO_STATUS.map((entry) => entry.key),
      ...INTERNAL_STATIC_STATUS.map((entry) => entry.key),
    ]);
    expect([...everyKey].sort()).toEqual(Object.keys(expected).sort());
  });
});

describe('stepState', () => {
  const list = INTERNAL_VIDEO_STATUS;

  it('marks earlier steps done, the current step now and later steps next', () => {
    expect(stepState(list, 'ad_submitted', 'sent_to_video_editor')).toBe('done');
    expect(stepState(list, 'ad_submitted', 'video_editing_in_progress')).toBe('done');
    expect(stepState(list, 'ad_submitted', 'ad_submitted')).toBe('now');
    expect(stepState(list, 'ad_submitted', 'videos_revisions')).toBe('next');
    expect(stepState(list, 'ad_submitted', 'launched')).toBe('next');
  });

  it('marks every step done at the terminal step except the terminal step itself', () => {
    const states = list.map((entry) => stepState(list, 'launched', entry.key));
    expect(states).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'now']);
  });

  it('leaves the stepper entirely upcoming for a current value outside the list', () => {
    expect(list.every((entry) => stepState(list, ON_HOLD.key, entry.key) === 'next')).toBe(true);
  });

  it('treats an unknown step as upcoming', () => {
    expect(stepState(list, 'launched', 'sent_to_designer')).toBe('next');
  });
});

describe('chipTone — the tone map over every label', () => {
  const cases: [string, ChipTone][] = [
    ['Approved', 'ok'],
    ['Launched', 'accent'],
    ['Videos Revisions', 'warn'],
    ['Images Revisions', 'warn'],
    ['Revisions Submitted', 'mute'],
    ['Revisions Needed', 'warn'],
    ['Pending for Approval', 'info'],
    ['Sent to Video Editor', 'mute'],
    ['Video Editing in Progress', 'mute'],
    ['Sent to Designer', 'mute'],
    ['Static Design in Progress', 'mute'],
    ['Ad Submitted', 'mute'],
    ['On Hold', 'mute'],
    ['locked', 'mute'],
  ];

  for (const [label, tone] of cases) {
    it(`${label} -> ${tone}`, () => {
      expect(chipTone(label)).toBe(tone);
    });
  }

  it('covers every label the status vocabularies can produce', () => {
    const labels = new Set<string>([
      ...INTERNAL_VIDEO_STATUS.map((entry) => entry.label),
      ...INTERNAL_STATIC_STATUS.map((entry) => entry.label),
      ...CLIENT_STATUS.map((entry) => entry.label),
      ON_HOLD.label,
    ]);
    const covered = new Set(cases.map(([label]) => label));
    for (const label of labels) {
      expect(covered.has(label)).toBe(true);
    }
  });
});

describe('canTransitionInternal', () => {
  it('walks the legal video path end to end', () => {
    const path: InternalStatusOrHoldKey[] = [
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'videos_revisions',
      'revisions_submitted',
      'approved',
      'launched',
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index] as InternalStatusOrHoldKey;
      const to = path[index + 1] as InternalStatusOrHoldKey;
      expect(canTransitionInternal('video', from, to)).toBe(true);
    }
  });

  it('walks the legal static path end to end', () => {
    const path: InternalStatusOrHoldKey[] = [
      'sent_to_designer',
      'static_design_in_progress',
      'ad_submitted',
      'images_revisions',
      'revisions_submitted',
      'approved',
      'launched',
    ];
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index] as InternalStatusOrHoldKey;
      const to = path[index + 1] as InternalStatusOrHoldKey;
      expect(canTransitionInternal('static', from, to)).toBe(true);
    }
  });

  it('allows the happy path that skips revisions', () => {
    expect(canTransitionInternal('video', 'ad_submitted', 'approved')).toBe(true);
    expect(canTransitionInternal('static', 'ad_submitted', 'approved')).toBe(true);
  });

  it('branches to on_hold from in progress and rejoins', () => {
    expect(canTransitionInternal('video', 'video_editing_in_progress', 'on_hold')).toBe(true);
    expect(canTransitionInternal('video', 'on_hold', 'video_editing_in_progress')).toBe(true);
    expect(canTransitionInternal('video', 'on_hold', 'ad_submitted')).toBe(true);
    expect(canTransitionInternal('static', 'static_design_in_progress', 'on_hold')).toBe(true);
    expect(canTransitionInternal('static', 'on_hold', 'ad_submitted')).toBe(true);
  });

  it('refuses skips, reversals and the terminal state', () => {
    expect(canTransitionInternal('video', 'sent_to_video_editor', 'approved')).toBe(false);
    expect(canTransitionInternal('video', 'sent_to_video_editor', 'launched')).toBe(false);
    expect(canTransitionInternal('video', 'ad_submitted', 'sent_to_video_editor')).toBe(false);
    expect(canTransitionInternal('video', 'approved', 'ad_submitted')).toBe(false);
    expect(canTransitionInternal('video', 'launched', 'approved')).toBe(false);
    expect(canTransitionInternal('video', 'ad_submitted', 'ad_submitted')).toBe(false);
    expect(canTransitionInternal('video', 'sent_to_video_editor', 'on_hold')).toBe(false);
  });

  it('refuses a step that belongs to the other track', () => {
    expect(canTransitionInternal('video', 'sent_to_designer', 'static_design_in_progress')).toBe(
      false,
    );
    expect(canTransitionInternal('video', 'ad_submitted', 'images_revisions')).toBe(false);
    expect(
      canTransitionInternal('static', 'sent_to_video_editor', 'video_editing_in_progress'),
    ).toBe(false);
    expect(canTransitionInternal('static', 'ad_submitted', 'videos_revisions')).toBe(false);
  });
});

describe('canTransitionClient', () => {
  const closed: InternalStatusKey[] = [
    'sent_to_video_editor',
    'video_editing_in_progress',
    'sent_to_designer',
    'static_design_in_progress',
    'ad_submitted',
    'videos_revisions',
    'images_revisions',
    'revisions_submitted',
  ];

  it('allows the legal client path once the gate is open', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'approved')).toBe(true);
    expect(canTransitionClient('approved', 'approved', 'launched')).toBe(true);
    expect(canTransitionClient('launched', 'pending_for_approval', 'approved')).toBe(true);
    expect(canTransitionClient('launched', 'approved', 'launched')).toBe(true);
  });

  it('branches Pending for Approval to Revisions Needed, PRD §9\u2019s other outcome', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'revisions_needed')).toBe(true);
    expect(canTransitionClient('launched', 'pending_for_approval', 'revisions_needed')).toBe(true);
  });

  it('rejoins Revisions Needed to Pending for Approval when the team resubmits', () => {
    expect(canTransitionClient('approved', 'revisions_needed', 'pending_for_approval')).toBe(true);
  });

  it('refuses the moves Revisions Needed is not a shortcut for', () => {
    expect(canTransitionClient('approved', 'revisions_needed', 'approved')).toBe(false);
    expect(canTransitionClient('approved', 'revisions_needed', 'launched')).toBe(false);
    expect(canTransitionClient('approved', 'approved', 'revisions_needed')).toBe(false);
    expect(canTransitionClient('approved', 'launched', 'revisions_needed')).toBe(false);
  });

  it('refuses every client transition while the gate is closed', () => {
    const pairs: [ClientStatusKey, ClientStatusKey][] = [
      ['pending_for_approval', 'approved'],
      ['pending_for_approval', 'revisions_needed'],
      ['revisions_needed', 'pending_for_approval'],
      ['approved', 'launched'],
    ];
    for (const internal of closed) {
      for (const [from, to] of pairs) {
        expect(canTransitionClient(internal, from, to)).toBe(false);
      }
    }
  });

  it('refuses skips and reversals even with the gate open', () => {
    expect(canTransitionClient('approved', 'pending_for_approval', 'launched')).toBe(false);
    expect(canTransitionClient('approved', 'approved', 'pending_for_approval')).toBe(false);
    expect(canTransitionClient('launched', 'launched', 'approved')).toBe(false);
    expect(canTransitionClient('approved', 'launched', 'launched')).toBe(false);
  });

  it('is PRD §9\u2019s table: one branch out of Pending, one way back, one terminal state', () => {
    expect(CLIENT_TRANSITIONS.pending_for_approval).toEqual(['approved', 'revisions_needed']);
    expect(CLIENT_TRANSITIONS.approved).toEqual(['launched']);
    expect(CLIENT_TRANSITIONS.revisions_needed).toEqual(['pending_for_approval']);
    expect(CLIENT_TRANSITIONS.launched).toEqual([]);
  });

  it('gives every client status an entry, so a stored value can never hit a missing row', () => {
    for (const entry of CLIENT_STATUS) {
      expect(CLIENT_TRANSITIONS[entry.key]).toBeDefined();
    }
  });

  it('answers false rather than throwing for a stored status this build has no row for', () => {
    const unknown = 'from_a_newer_build' as ClientStatusKey;
    expect(canTransitionClient('approved', unknown, 'approved')).toBe(false);
  });
});
