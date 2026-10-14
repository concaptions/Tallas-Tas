import { renderToStaticMarkup } from 'react-dom/server';
import { BRIEF_QA_CHECK_LABELS, qaProgressLabel } from '@tas/domain/state';
import { describe, expect, it, vi } from 'vitest';

import {
  NO_ACTIVITY_NOTE,
  QA_RESET_NOTE,
} from '@/app/app/creative-design/[briefId]/brief-activity';

// The QA checklist dispatches a Server Action; mocking the module keeps the auth and database
// drivers out of a markup test, as `brief-detail.test.tsx` does.
vi.mock('@/app/app/creative-design/actions', () => ({
  toggleQaAction: vi.fn(),
  updateBriefAction: vi.fn(),
  changeBriefDimensionAction: vi.fn(),
}));

// After the mock: the stories resolve the mocked module on import.
import {
  BriefActivityStory,
  BriefContentFieldsStory,
  BriefQaChecklistStory,
  QaCheckRowStory,
} from './briefs.stories';

/**
 * The brief-page stories rendered as the page renders them (B4.V14, B5.V19): the checklist with a
 * track, the one QA row in every state, and the grouped Activity with its reset line — pinned on
 * the markup, with no colour outside the token layer.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('BriefQaChecklistStory', () => {
  const html = renderToStaticMarkup(<BriefQaChecklistStory />);

  it('mounts a video checklist with the strategist missing and a static one with every tick set', () => {
    expect(html.match(/data-slot="brief-qa"/g)).toHaveLength(2);
    expect(html).toContain('data-slot="brief-qa-gate" data-open="false"');
    expect(html).toContain('data-slot="brief-qa-gate" data-open="true"');
    expect(html).toContain(
      qaProgressLabel('video', { qaVideoEditor: true, qaDesigner: false, qaStrategist: false }),
    );
    expect(html).toContain(
      qaProgressLabel('static', { qaVideoEditor: false, qaDesigner: true, qaStrategist: true }),
    );
  });

  it('strikes the other track’s tick through as N/A on both', () => {
    expect(html.match(/data-kind="na"/g)).toHaveLength(2);
    expect(html).toContain('N/A · video');
    expect(html).toContain('N/A · static');
    expect(html.match(/data-kind="required"/g)).toHaveLength(1);
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('QaCheckRowStory', () => {
  const html = renderToStaticMarkup(<QaCheckRowStory />);

  it('draws the required-unset, N/A and ticked rows live, then the same three disabled', () => {
    expect(html.match(/data-slot="qa-check-row"/g)).toHaveLength(6);
    expect(html.match(/data-kind="required"/g)).toHaveLength(2);
    expect(html.match(/data-kind="na"/g)).toHaveLength(2);
    expect(html.match(/data-variant="na"/g)).toHaveLength(2);
    expect(html.match(/data-slot="story-qa-check-disabled"[^>]*disabled=""/g)).toHaveLength(3);
    for (const label of Object.values(BRIEF_QA_CHECK_LABELS)) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

describe('BriefActivityStory', () => {
  const html = renderToStaticMarkup(<BriefActivityStory />);

  it('groups the fixtures into three writes, two of them resets, and shows the empty state beside them', () => {
    expect(html.match(/data-slot="brief-activity-group"/g)).toHaveLength(3);
    expect(html.match(/data-reset="true"/g)).toHaveLength(2);
    expect(html.match(/data-slot="brief-activity-reset"/g)).toHaveLength(2);
    expect(html.match(new RegExp(QA_RESET_NOTE, 'g'))).toHaveLength(2);
    expect(html).toContain('data-slot="brief-activity-empty"');
    expect(html).toContain(NO_ACTIVITY_NOTE);
  });

  it('renders the status pair as chips and the cleared ticks in bad', () => {
    expect(html).toContain('data-field="clientStatus"');
    expect(html).toContain('data-field="internalStatus"');
    expect(
      html.match(
        /data-slot="brief-activity-new" data-value="revisions_needed" class="inline-flex"/g,
      ),
    ).toHaveLength(2);
    expect(html).toContain('data-slot="status-chip"');
    expect(html.match(/text-\[10px\] text-bad">false</g)).toHaveLength(4);
    expect(html).toContain('data-field="assignee"');
    expect(html).toContain('lucide-lock');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});

/**
 * The Ticket 6 Content section story (migration 0069): three columns — empty, partial, full —
 * each with the four fields the sidebar edits. The story draws the same cards the sidebar does
 * and must stay on the token layer.
 */
describe('BriefContentFieldsStory', () => {
  const html = renderToStaticMarkup(<BriefContentFieldsStory />);

  it('mounts three columns, one for each state the sidebar can render', () => {
    expect(html.match(/data-slot="brief-content-column"/g)).toHaveLength(3);
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('data-state="partial"');
    expect(html).toContain('data-state="full"');
  });

  it('labels the four Content fields the ticket spells', () => {
    for (const label of ['Brief', 'Music', 'Voiceover type', 'Voiceover script']) {
      // Each label appears three times — once per column.
      expect(html.match(new RegExp(label, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses the token layer only', () => {
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});
