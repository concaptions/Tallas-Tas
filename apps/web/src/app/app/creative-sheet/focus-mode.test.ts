import type { CreativeSheetItemListRow } from '@tas/db';
import { describe, expect, it } from 'vitest';

import {
  focusActions,
  focusCounter,
  focusIndex,
  focusQaChecklist,
  focusQaGateNote,
  focusQaGateOpen,
  focusQaGateTone,
  focusQaMissingLabel,
  focusQaProgress,
  focusQaTrack,
  neighbourIndex,
  previewFileName,
  previewStamp,
  QA_GATE_HEADING,
  QA_GATE_NOTE,
  QA_GATE_OPEN_NOTE,
  qaGateTone,
  sidebarQaChecklist,
} from './focus-mode';

function row(overrides: Partial<CreativeSheetItemListRow> = {}): CreativeSheetItemListRow {
  return {
    briefType: 'Video',
    internalStatus: 'ad_submitted',
    status: 'pending_for_approval',
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    dimensions: [],
    ...overrides,
  } as CreativeSheetItemListRow;
}

describe('where Focus Mode stands', () => {
  it('focuses the selected creative, else the first, and -1 on an empty sheet', () => {
    expect(focusIndex(['a', 'b', 'c'], 'b')).toBe(1);
    expect(focusIndex(['a', 'b', 'c'], null)).toBe(0);
    expect(focusIndex(['a', 'b', 'c'], 'gone')).toBe(0);
    expect(focusIndex([], 'a')).toBe(-1);
  });

  it('steps prev / next without wrapping', () => {
    expect(neighbourIndex(0, -1, 3)).toBe(0);
    expect(neighbourIndex(1, 1, 3)).toBe(2);
    expect(neighbourIndex(2, 1, 3)).toBe(2);
    expect(neighbourIndex(0, 1, 0)).toBe(-1);
  });

  it('pads the counter to the total’s width', () => {
    expect(focusCounter(6, 23)).toBe('07 / 23');
    expect(focusCounter(0, 7)).toBe('1 / 7');
    expect(focusCounter(99, 100)).toBe('100 / 100');
    expect(focusCounter(-1, 0)).toBe('0 / 0');
  });
});

describe('the three buttons follow the guard the actions re-run', () => {
  it('Ad Submitted with QA incomplete: Request Changes on, Approve and Submit off with the reasons and their gates', () => {
    const actions = focusActions(row({ qaStrategist: true }));

    expect(actions.revisionStep).toBe('revisions_needed');
    expect(actions.requestChanges).toEqual({ enabled: true, hint: null, kind: null });
    expect(actions.approve).toEqual({
      enabled: false,
      hint: 'Video Editor QA must be ticked before this brief can go to the client.',
      kind: 'qa',
    });
    expect(actions.submitToClient).toEqual({
      enabled: false,
      hint: 'Internal approval first: the client track opens at Approved.',
      kind: 'internal',
    });
  });

  it('QA complete: Approve on; a static asks for the designer’s tick instead', () => {
    expect(focusActions(row({ qaVideoEditor: true, qaStrategist: true })).approve.enabled).toBe(
      true,
    );
    const staticRow = row({ briefType: 'Static', qaDesigner: true, qaStrategist: true });
    expect(focusActions(staticRow).approve.enabled).toBe(true);
    expect(focusActions(staticRow).revisionStep).toBe('revisions_needed');
    expect(
      focusActions(row({ briefType: 'Static', qaVideoEditor: true, qaStrategist: true })).approve
        .hint,
    ).toBe('Graphic Designer QA must be ticked before this brief can go to the client.');
  });

  it('Approved + Revisions Needed + QA complete: Submit to Client on; already pending: off, says so', () => {
    const sentBack = row({
      internalStatus: 'approved',
      status: 'revisions_needed',
      qaVideoEditor: true,
      qaStrategist: true,
    });
    expect(focusActions(sentBack).submitToClient).toEqual({
      enabled: true,
      hint: null,
      kind: null,
    });
    expect(focusActions(sentBack).requestChanges.enabled).toBe(false);
    const pending = row({ internalStatus: 'approved', qaVideoEditor: true, qaStrategist: true });
    expect(focusActions(pending).submitToClient).toEqual({
      enabled: false,
      hint: 'This creative is already with the client.',
      kind: 'nothing',
    });
  });

  it('classifies a refusal by the sentence the guard returned, not by the state of the ticks (B1.A6)', () => {
    // At Draft with no ticks the machine refuses Approve ("not the next step"); QA is incomplete
    // too, but a QA heading over that sentence would name the wrong gate.
    const draft = focusActions(row({ internalStatus: 'draft' }));
    expect(draft.approve.kind).toBe('machine');
    expect(draft.approve.hint).toBe('That is not the next step on the internal track.');
    expect(draft.requestChanges.kind).toBe('machine');
    expect(draft.submitToClient.kind).toBe('internal');
  });
});

describe('the QA checklist by type', () => {
  it('Focus Mode draws only the required ticks; the sidebar draws all three, N/A flagged', () => {
    expect(focusQaChecklist(row({ qaStrategist: true })).map((c) => [c.key, c.checked])).toEqual([
      ['qaVideoEditor', false],
      ['qaStrategist', true],
    ]);
    expect(focusQaChecklist(row({ briefType: 'Carousel' })).map((c) => c.key)).toEqual([
      'qaDesigner',
      'qaStrategist',
    ]);
    expect(sidebarQaChecklist(row()).map((c) => [c.key, c.required])).toEqual([
      ['qaVideoEditor', true],
      ['qaDesigner', false],
      ['qaStrategist', true],
    ]);
    expect(focusQaProgress(row({ qaStrategist: true }))).toBe('1 of 2 required checks complete.');
  });

  it('names the TRACK in the sub-label: an unknown type takes the video track on purpose (B4.A3)', () => {
    expect(focusQaTrack(row())).toBe('video');
    expect(focusQaTrack(row({ briefType: 'Motion Image' }))).toBe('video');
    expect(focusQaTrack(row({ briefType: 'Static' }))).toBe('static');
    expect(focusQaTrack(row({ briefType: null }))).toBe('video');
  });

  it('bolds the first missing required tick in the popover under the QA heading (B1.A6)', () => {
    expect(QA_GATE_HEADING).toBe('QA checklist incomplete');
    expect(focusQaMissingLabel(row({ qaStrategist: true }))).toBe('Video Editor QA');
    expect(focusQaMissingLabel(row({ briefType: 'Static', qaDesigner: true }))).toBe(
      'Creative Strategist QA',
    );
    expect(focusQaMissingLabel(row({ qaVideoEditor: true, qaStrategist: true }))).toBeNull();
  });
});

describe('the gate box', () => {
  it('is warn-toned and shut until every required tick is set, then ok-toned and open (B4.V1)', () => {
    expect(qaGateTone(false)).toBe('warn');
    expect(qaGateTone(true)).toBe('ok');
    expect(focusQaGateOpen(row({ qaStrategist: true }))).toBe(false);
    expect(focusQaGateTone(row({ qaStrategist: true }))).toBe('warn');
    expect(focusQaGateOpen(row({ qaVideoEditor: true, qaStrategist: true }))).toBe(true);
    expect(focusQaGateTone(row({ qaVideoEditor: true, qaStrategist: true }))).toBe('ok');
    // The designer's tick is not the video track's: it opens nothing on a video.
    expect(focusQaGateOpen(row({ qaDesigner: true, qaStrategist: true }))).toBe(false);
  });

  it('names both gated moves while shut (B1.A7) and says they are unlocked once open (B4.V2)', () => {
    expect(QA_GATE_NOTE).toBe(
      'Approve and Submit to Client unlock when every required tick for this type is set.',
    );
    expect(QA_GATE_OPEN_NOTE).toBe(
      'Every required tick is set. Approve and Submit to Client are unlocked.',
    );
    expect(focusQaGateNote(row({ qaStrategist: true }))).toBe(QA_GATE_NOTE);
    expect(focusQaGateNote(row({ qaVideoEditor: true, qaStrategist: true }))).toBe(
      QA_GATE_OPEN_NOTE,
    );
  });
});

describe('the preview', () => {
  it('stamps the type and the first stored ratio for the video track, nothing for a still (B1.V16)', () => {
    expect(previewStamp(row({ dimensions: ['9:16'] }))).toBe('Video · 9:16');
    // The first ratio in the vocabulary's order, not the stored order: the picker saves a set.
    expect(previewStamp(row({ dimensions: ['9:16', '1:1'] }))).toBe('Video · 1:1');
    expect(previewStamp(row({ briefType: 'Motion Image', dimensions: ['Facebook Reels'] }))).toBe(
      'Motion Image · 9:16',
    );
    expect(previewStamp(row({ dimensions: [] }))).toBe('Video');
    expect(previewStamp(row({ briefType: 'Static', dimensions: ['1:1'] }))).toBeNull();
    expect(previewStamp(row({ briefType: null, dimensions: ['1:1'] }))).toBeNull();
  });

  it('shows the file’s basename, decoded, and leaves anything else as it came (B1.A24)', () => {
    expect(
      previewFileName('https://cdn.example.com/gratsi/TV01-B3-CasualHangouts-V2_cut03.mp4?v=2'),
    ).toBe('TV01-B3-CasualHangouts-V2_cut03.mp4');
    expect(previewFileName('https://cdn.example.com/a%20b/cut%2003.mp4')).toBe('cut 03.mp4');
    expect(previewFileName('https://www.youtube.com/watch?v=nm1TxQj9IsQ')).toBe('watch');
    expect(previewFileName('https://cdn.example.com/')).toBe('https://cdn.example.com/');
    expect(previewFileName('r2://design/tv1-b1-v2.mp4')).toBe('tv1-b1-v2.mp4');
    expect(previewFileName('not a url')).toBe('not a url');
  });
});
