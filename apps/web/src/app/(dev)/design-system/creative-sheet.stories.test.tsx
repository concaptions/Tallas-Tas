import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { BRIEF_QA_CHECK_LABELS, INTERNAL_GATE_REASON, qaGateReason } from '@tas/domain/state';
import { describe, expect, it, vi } from 'vitest';

import {
  QA_GATE_HEADING,
  QA_GATE_NOTE,
  QA_GATE_OPEN_NOTE,
} from '@/app/app/creative-sheet/focus-mode';
import type { ResolvedColumnView } from '@/components/views/resolved-columns';

// The stories mount the real Focus Mode, sidebar and workspace pieces, which import the App
// Router and four Server Action modules; none is reached by a markup render, and mocking them
// keeps the auth and database drivers out of the test (as `focus-mode-view.test.tsx` does).
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/app/creative-design/actions', () => ({
  toggleQaAction: vi.fn(),
  moveBriefStageAction: vi.fn(),
  startBriefAction: vi.fn(),
  createBriefAction: vi.fn(),
}));
vi.mock('@/app/app/creative-sheet/review-actions', () => ({
  approveCreativeAction: vi.fn(),
  postCreativeCommentAction: vi.fn(),
  requestChangesAction: vi.fn(),
  submitToClientAction: vi.fn(),
}));
vi.mock('@/app/app/creative-sheet/actions', () => ({
  updateCreativeSheetItemAction: vi.fn(),
  updateCreativeSheetItemDimensionsAction: vi.fn(),
  moveCreativeSheetItemAction: vi.fn(),
}));

// After the mocks: the stories resolve the mocked modules on import.
import {
  FOCUS_FIXTURE_IDS,
  focusFixture,
  FocusModeStory,
  MultiSelectStory,
  QaGateBoxStory,
} from './creative-sheet.stories';

/**
 * The Creative Sheet stories rendered as the page renders them (B4.A19, B3.V29): the three gate
 * fixtures resolve to the positions the boards document, the popover is held open on the
 * QA-gated button with its heading, Focus Mode shows the gate refusal rather than the demo hint,
 * and the multi-select story mounts the lifted picker and confirm — none naming a colour outside
 * the token layer.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

/** A handful of the sheet's columns, in the resolver's shape; the registry supplies the cells. */
const COLUMNS: readonly ResolvedColumnView[] = [
  { columnKey: 'name', displayLabel: 'Name', displayOrder: 0 },
  { columnKey: 'brief_id', displayLabel: 'Brief', displayOrder: 1 },
  { columnKey: 'internal_status', displayLabel: 'Internal Status', displayOrder: 2 },
  { columnKey: 'status', displayLabel: 'Client Approval', displayOrder: 3 },
  { columnKey: 'type', displayLabel: 'Type', displayOrder: 4 },
];

const VIDEO_QA_HINT = qaGateReason('video', {
  qaVideoEditor: false,
  qaDesigner: false,
  qaStrategist: true,
});
const STATIC_QA_HINT = qaGateReason('static', {
  qaVideoEditor: false,
  qaDesigner: true,
  qaStrategist: false,
});

describe('focusFixture', () => {
  it('names the three positions the boards document, each under its own id', () => {
    expect(focusFixture('video-gated').item.id).toBe(FOCUS_FIXTURE_IDS['video-gated']);
    expect(focusFixture('static-gated').item.briefType).toBe('Static');
    expect(focusFixture('open').item.status).toBe('revisions_needed');
    // The comment stamps are the server's `formatCommentStamp` shape (B1.A21).
    expect(focusFixture('video-gated').comments[0]?.at).toBe('10 Oct, 3:42 PM');
  });
});

describe('QaGateBoxStory', () => {
  const html = renderToStaticMarkup(<QaGateBoxStory />);

  it('shows both gate-box tones across the three fixtures (B4.V1 / B4.V2)', () => {
    expect(html.match(/data-slot="focus-qa-gate" data-open="false"/g)).toHaveLength(2);
    expect(html.match(/data-slot="focus-qa-gate" data-open="true"/g)).toHaveLength(1);
    expect(html).toContain('border-warn/35 bg-warn/10 text-warn');
    expect(html).toContain('border-ok/40 bg-ok/10 text-ok');
    expect(html).toContain(QA_GATE_NOTE);
    expect(html).toContain(QA_GATE_OPEN_NOTE);
  });

  it('holds the popover open on the QA-gated Approve with its heading and the bold tick (B1.A6)', () => {
    // React escapes the `&` of the arbitrary variant in the rendered attribute: one held popover per fixture.
    expect(html.split('[&amp;_[data-slot=disabled-write-popover]]:visible')).toHaveLength(4);
    expect(html.match(new RegExp(QA_GATE_HEADING, 'g'))).toHaveLength(2);
    expect(html).toContain(
      `<b class="font-semibold text-text">${BRIEF_QA_CHECK_LABELS.qaVideoEditor}</b>`,
    );
    expect(html).toContain(
      `<b class="font-semibold text-text">${BRIEF_QA_CHECK_LABELS.qaStrategist}</b>`,
    );
    expect(html).toContain(VIDEO_QA_HINT ?? '');
    expect(html).toContain(STATIC_QA_HINT ?? '');
    expect(html).toContain(INTERNAL_GATE_REASON);
  });

  it('enables Approve in the success variant and Submit with the open padlock where the client sent it back', () => {
    const open = html.slice(html.indexOf('data-fixture="open"'));
    expect(open).toMatch(/data-slot="story-approve"[^>]*class="[^"]*bg-ok text-on-ok/);
    expect(open).not.toMatch(/data-slot="story-approve"[^>]*disabled=""/);
    expect(open).toContain('lucide-lock-open');
    expect(open).not.toMatch(/data-slot="story-submit"[^>]*disabled=""/);
    const gated = html.slice(0, html.indexOf('data-fixture="static-gated"'));
    expect(gated).toMatch(/data-slot="story-approve"[^>]*disabled=""/);
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('FocusModeStory', () => {
  const html = renderToStaticMarkup(<FocusModeStory />);

  it('opens on the gated video fixture with the QA refusal, not the demo hint, on Approve (B4.V13)', () => {
    expect(html).toContain(`data-focus-id="${FOCUS_FIXTURE_IDS['video-gated']}"`);
    expect(html).toContain(QA_GATE_HEADING);
    expect(html).toContain(VIDEO_QA_HINT ?? '');
    expect(html).toContain(INTERNAL_GATE_REASON);
    // Request Changes is the one button the guard allows here, so only it carries the demo hint.
    expect(html.match(new RegExp(DEMO_WRITE_HINT, 'g'))?.length).toBeGreaterThan(0);
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('MultiSelectStory', () => {
  const html = renderToStaticMarkup(<MultiSelectStory columns={COLUMNS} />);

  it('mounts the grid with a ticked row, the bar with its three glyphed actions, and the two inline pieces', () => {
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-slot="selection-bar"');
    expect(html).toContain('lucide-copy');
    expect(html).toContain('lucide-refresh-cw');
    expect(html).toContain('lucide-trash');
    expect(html).toContain('data-slot="selection-status-picker"');
    expect(html).toContain('data-slot="selection-delete-confirm"');
    expect(html).toContain('data-slot="multiselect-story-demo"');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});
