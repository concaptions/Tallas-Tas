import type { CreativeSheetItemListRow } from '@tas/db';
import { describe, expect, it } from 'vitest';

import {
  focusActions,
  focusCounter,
  focusIndex,
  focusQaChecklist,
  focusQaProgress,
  neighbourIndex,
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
  it('Ad Submitted with QA incomplete: Request Changes on, Approve and Submit off with the reasons', () => {
    const actions = focusActions(row({ qaStrategist: true }));

    expect(actions.revisionStep).toBe('revisions_needed');
    expect(actions.requestChanges).toEqual({ enabled: true, hint: null });
    expect(actions.approve).toEqual({
      enabled: false,
      hint: 'Video Editor QA must be ticked before this brief can go to the client.',
    });
    expect(actions.submitToClient).toEqual({
      enabled: false,
      hint: 'Internal approval first: the client track opens at Approved.',
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
    expect(focusActions(sentBack).submitToClient).toEqual({ enabled: true, hint: null });
    expect(focusActions(sentBack).requestChanges.enabled).toBe(false);
    const pending = row({ internalStatus: 'approved', qaVideoEditor: true, qaStrategist: true });
    expect(focusActions(pending).submitToClient.hint).toBe(
      'This creative is already with the client.',
    );
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
});
