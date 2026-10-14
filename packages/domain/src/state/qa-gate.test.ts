import { describe, expect, it } from 'vitest';

import { CLIENT_STATUS, INTERNAL_ENTRY_STATUS, INTERNAL_STATUS } from './creative-status';
import {
  BRIEF_QA_CHECKS,
  INTERNAL_GATE_REASON,
  NOTHING_TO_SUBMIT_REASON,
  QA_INVALIDATING_CLIENT,
  QA_INVALIDATING_INTERNAL,
  QA_RESET,
  canSubmitToClient,
  clientMoveNeedsQa,
  clientMoveResetsQa,
  clientSubmissionTarget,
  internalMoveNeedsQa,
  internalMoveResetsQa,
  missingQaChecks,
  qaChecklistFor,
  qaGateReason,
  qaProgressLabel,
  qaResetFor,
  requiredQaChecks,
  submitToClientRefusal,
  type BriefQaTicks,
} from './qa-gate';

const NONE: BriefQaTicks = { qaVideoEditor: false, qaDesigner: false, qaStrategist: false };
const ALL: BriefQaTicks = { qaVideoEditor: true, qaDesigner: true, qaStrategist: true };

describe('which ticks a type requires (Oct 12 scope 4 matrix)', () => {
  it('video: the video editor and the strategist; static: the designer and the strategist', () => {
    expect(requiredQaChecks('video')).toEqual(['qaVideoEditor', 'qaStrategist']);
    expect(requiredQaChecks('static')).toEqual(['qaDesigner', 'qaStrategist']);
  });

  it('no track: the strategist alone', () => {
    expect(requiredQaChecks(null)).toEqual(['qaStrategist']);
  });

  it('lists all three in checklist order, flagged, so a full-record view can strike the N/A one', () => {
    expect(qaChecklistFor('video', { ...NONE, qaStrategist: true })).toEqual([
      { key: 'qaVideoEditor', label: 'Video Editor QA', required: true, checked: false },
      { key: 'qaDesigner', label: 'Graphic Designer QA', required: false, checked: false },
      { key: 'qaStrategist', label: 'Creative Strategist QA', required: true, checked: true },
    ]);
    expect(BRIEF_QA_CHECKS).toHaveLength(3);
  });
});

describe('canSubmitToClient', () => {
  it('opens only when every required tick is set; the other track’s tick is never asked for', () => {
    expect(canSubmitToClient('video', { ...NONE, qaVideoEditor: true, qaStrategist: true })).toBe(
      true,
    );
    expect(canSubmitToClient('video', { ...ALL, qaDesigner: false })).toBe(true);
    expect(canSubmitToClient('video', { ...ALL, qaVideoEditor: false })).toBe(false);
    expect(canSubmitToClient('static', { ...ALL, qaDesigner: false })).toBe(false);
    expect(canSubmitToClient('static', { ...ALL, qaVideoEditor: false })).toBe(true);
    expect(canSubmitToClient(null, { ...NONE, qaStrategist: true })).toBe(true);
  });

  it('names the FIRST missing tick, and the progress line counts the required ones only', () => {
    expect(missingQaChecks('video', { ...NONE, qaStrategist: true })).toEqual(['qaVideoEditor']);
    expect(qaGateReason('video', { ...NONE, qaStrategist: true })).toBe(
      'Video Editor QA must be ticked before this brief can go to the client.',
    );
    expect(qaGateReason('static', NONE)).toBe(
      'Graphic Designer QA must be ticked before this brief can go to the client.',
    );
    expect(qaGateReason('video', ALL)).toBeNull();
    expect(qaProgressLabel('video', { ...NONE, qaStrategist: true })).toBe(
      '1 of 2 required checks complete.',
    );
    expect(qaProgressLabel(null, NONE)).toBe('0 of 1 required checks complete.');
  });

  /**
   * Oct-14 walkthrough: "Approve clickable on brief TV23 with 1 of 2 QA ticked" was traced to a
   * misreading of the checklist (the third row is the N/A tick of the other track, struck through).
   * This pins the real behaviour the gate enforces: Approve stays shut whenever any required tick
   * is missing, regardless of which track the brief is on, so a future refactor cannot regress it.
   */
  it('the walkthrough scenario: 1 of 2 required ticked keeps Approve disabled on either track', () => {
    // Static brief (e.g. a Carousel) with only the designer tick — strategist missing.
    expect(canSubmitToClient('static', { ...NONE, qaDesigner: true, qaStrategist: false })).toBe(
      false,
    );
    // Video brief with only the strategist tick — video-editor missing.
    expect(canSubmitToClient('video', { ...NONE, qaVideoEditor: false, qaStrategist: true })).toBe(
      false,
    );
    // Both required ticks set opens the gate; the other track's N/A tick stays unset.
    expect(canSubmitToClient('static', { ...NONE, qaDesigner: true, qaStrategist: true })).toBe(
      true,
    );
    expect(canSubmitToClient('video', { ...NONE, qaVideoEditor: true, qaStrategist: true })).toBe(
      true,
    );
  });
});

describe('submitToClientRefusal composes the two gates, internal first', () => {
  it('refuses while the internal track has not reached Approved, whatever QA says', () => {
    for (const internal of INTERNAL_STATUS.map((entry) => entry.key).filter(
      (k) => k !== 'approved',
    )) {
      expect(
        submitToClientRefusal({ track: 'video', internal, client: 'revisions_needed', ticks: ALL }),
        internal,
      ).toBe(INTERNAL_GATE_REASON);
    }
    // The retired internal `launched` no longer opens anything: it is not a status this build knows.
    expect(
      submitToClientRefusal({
        track: 'video',
        internal: 'launched',
        client: 'revisions_needed',
        ticks: ALL,
      }),
    ).toBe(INTERNAL_GATE_REASON);
  });

  it('then refuses on the missing tick', () => {
    expect(
      submitToClientRefusal({
        track: 'video',
        internal: 'approved',
        client: 'revisions_needed',
        ticks: { ...ALL, qaVideoEditor: false },
      }),
    ).toBe('Video Editor QA must be ticked before this brief can go to the client.');
  });

  it('then says so when the creative is already with the client, and allows a resubmission', () => {
    expect(
      submitToClientRefusal({
        track: 'video',
        internal: 'approved',
        client: 'pending_for_approval',
        ticks: ALL,
      }),
    ).toBe(NOTHING_TO_SUBMIT_REASON);
    expect(
      submitToClientRefusal({
        track: 'static',
        internal: 'approved',
        client: 'revisions_needed',
        ticks: ALL,
      }),
    ).toBeNull();
    expect(clientSubmissionTarget('revisions_needed')).toBe('revisions_submitted');
    for (const entry of CLIENT_STATUS) {
      if (entry.key !== 'revisions_needed') expect(clientSubmissionTarget(entry.key)).toBeNull();
    }
  });

  it('knows which moves put a creative in front of the client', () => {
    expect(internalMoveNeedsQa('ad_submitted', 'approved')).toBe(true);
    expect(internalMoveNeedsQa('revisions_submitted', 'approved')).toBe(true);
    expect(internalMoveNeedsQa('approved', 'approved')).toBe(false);
    expect(internalMoveNeedsQa('ad_submitted', 'revisions_needed')).toBe(false);
    expect(internalMoveNeedsQa('draft', 'sent_to_editor_or_designer')).toBe(false);
    expect(clientMoveNeedsQa('revisions_needed', 'revisions_submitted')).toBe(true);
    expect(clientMoveNeedsQa('revisions_needed', 'pending_for_approval')).toBe(true);
    expect(clientMoveNeedsQa('pending_for_approval', 'approved')).toBe(false);
    expect(clientMoveNeedsQa('revisions_submitted', 'approved')).toBe(false);
  });
});

describe('QA auto-reset on revisions (Oct 12 scope 5)', () => {
  it('derives exactly the one internal revision key and the one client key from the vocabularies', () => {
    expect(QA_INVALIDATING_INTERNAL).toEqual(['revisions_needed']);
    expect(QA_INVALIDATING_CLIENT).toEqual(['revisions_needed']);
    expect(internalMoveResetsQa('revisions_needed')).toBe(true);
    expect(internalMoveResetsQa('revisions_submitted')).toBe(false);
    expect(internalMoveResetsQa('videos_revisions')).toBe(false);
    expect(internalMoveResetsQa('images_revisions')).toBe(false);
    expect(clientMoveResetsQa('revisions_submitted')).toBe(false);
    // Every key is a real step of the list.
    const internalKeys = INTERNAL_STATUS.map((e) => e.key);
    for (const key of QA_INVALIDATING_INTERNAL) expect(internalKeys).toContain(key);
  });

  it('clears all three ticks on a move INTO a revision state on either track', () => {
    expect(qaResetFor({ internalFrom: 'ad_submitted', internalTo: 'revisions_needed' })).toEqual(
      QA_RESET,
    );
    expect(
      qaResetFor({ internalFrom: 'revisions_submitted', internalTo: 'revisions_needed' }),
    ).toEqual(QA_RESET);
    expect(
      qaResetFor({ clientFrom: 'pending_for_approval', clientTo: 'revisions_needed' }),
    ).toEqual(QA_RESET);
    expect(QA_RESET).toEqual({ qaVideoEditor: false, qaDesigner: false, qaStrategist: false });
  });

  it('leaves the ticks alone when standing still on a revision state or moving anywhere else', () => {
    expect(
      qaResetFor({ internalFrom: 'revisions_needed', internalTo: 'revisions_needed' }),
    ).toEqual({});
    expect(qaResetFor({ internalFrom: 'ad_submitted', internalTo: 'approved' })).toEqual({});
    expect(qaResetFor({ clientFrom: 'revisions_needed', clientTo: 'revisions_submitted' })).toEqual(
      {},
    );
    expect(qaResetFor({})).toEqual({});
    expect(qaResetFor({ internalTo: null, clientTo: null })).toEqual({});
  });
});

describe('the entry state (a new brief and a duplicate start here)', () => {
  it('is draft, the first step of the one list, for a video and a static brief alike', () => {
    expect(INTERNAL_ENTRY_STATUS).toBe('draft');
    expect(INTERNAL_STATUS[0].key).toBe(INTERNAL_ENTRY_STATUS);
  });
});
