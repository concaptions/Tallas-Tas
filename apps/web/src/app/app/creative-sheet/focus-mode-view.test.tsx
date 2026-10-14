import {
  demoCreativeSheetItems,
  type CreativeSheetBriefDetail,
  type CreativeSheetItemListRow,
} from '@tas/db';
import { DEMO_WRITE_HINT } from '@tas/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { SheetItemView, SheetLookups } from './creative-sheet-workspace';
import { QA_GATE_NOTE, QA_GATE_OPEN_NOTE } from './focus-mode';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/app/app/creative-design/actions', () => ({ toggleQaAction: vi.fn() }));
vi.mock('./review-actions', () => ({
  addAnnotationAction: vi.fn(),
  addCommentAction: vi.fn(),
  approveBriefAction: vi.fn(),
  deleteAnnotationAction: vi.fn(),
  deleteCommentAction: vi.fn(),
  postCreativeCommentAction: vi.fn(),
  requestChangesAction: vi.fn(),
  submitToClientAction: vi.fn(),
}));

// After the mocks: the view resolves the mocked modules on import.
import { FocusModeView } from './focus-mode-view';

/**
 * Focus Mode rendered on the server, as a request would (hooks run, no DOM needed). Board 1's
 * gaps are pinned on the markup: the gate popover with its heading and bold tick, the gate
 * refusal beating the demo hint, the drawn checkbox, the ok-toned open gate box, the dates, the
 * file basename and the play disc — and that none of it names a colour outside the token layer.
 */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;
/** The attribute, not the `disabled:` utilities every button carries. */
const DISABLED = /\sdisabled=""/;
const FILE_URL = 'https://cdn.example.com/gratsi/TV01-B3-CasualHangouts-V2_cut03.mp4';

const NO_LOOKUPS: SheetLookups = {
  concept: null,
  performance: null,
  internalProduct: null,
  angle: null,
  conceptsFromAngle: null,
  designFiles: [],
  designLinkUrl: null,
  platform: null,
  funnel: null,
  type: null,
  proposedCopy: null,
  creativeModule: null,
};

function viewOf(
  overrides: Partial<CreativeSheetItemListRow> = {},
  detail: Partial<CreativeSheetBriefDetail> = {},
): SheetItemView {
  const base = demoCreativeSheetItems[0];
  if (base === undefined) throw new Error('demoCreativeSheetItems is empty');
  return {
    item: {
      ...base,
      briefType: 'Video',
      briefDesignFileUrl: FILE_URL,
      internalStatus: 'ad_submitted',
      status: 'pending_for_approval',
      qaVideoEditor: false,
      qaDesigner: false,
      qaStrategist: true,
      dimensions: ['9:16'],
      ...overrides,
      detail: {
        ...base.detail,
        dueDate: new Date('2026-10-18T00:00:00.000Z'),
        designFile: [FILE_URL],
        inspirationImage: null,
        ...detail,
      },
    },
    lookups: NO_LOOKUPS,
    comments: [
      {
        id: 'c1',
        authorName: 'Sarah K.',
        body: 'Love the hook.',
        at: '10 Oct, 3:42 PM',
        ago: '2 days ago',
      },
    ],
    createdLabel: '',
    createdTitle: '',
    updatedLabel: '',
    updatedTitle: '',
  };
}

function render(view: SheetItemView, demo: boolean): string {
  return renderToStaticMarkup(
    <FocusModeView items={[view]} focusedId={view.item.id} onFocus={vi.fn()} demo={demo} />,
  );
}

/** The opening tag of the review button carrying `slot`. */
function buttonTag(html: string, slot: string): string {
  const match = new RegExp(`<button[^>]*data-slot="${slot}"[^>]*>`).exec(html);
  if (match === null) throw new Error(`no button for ${slot}`);
  return match[0];
}

describe('FocusModeView', () => {
  it('lets a gate refusal beat the demo hint, with the QA heading and the missing tick in bold (B4.V13 / B1.A6)', () => {
    const html = render(viewOf(), true);

    // Submit is refused by the internal gate; Approve by the QA gate; Request Changes only by demo.
    expect(html).toContain('title="Internal approval first: the client track opens at Approved."');
    expect(html).toContain(
      '<b class="font-semibold text-text">Video Editor QA</b> must be ticked before this brief can go to the client.',
    );
    expect(html).toContain('QA checklist incomplete');
    expect(html).toContain(`title="${DEMO_WRITE_HINT}"`);
    expect(html.match(/data-slot="disabled-write-popover"/g)).toHaveLength(3);
    for (const slot of ['focus-request-changes', 'focus-approve', 'focus-submit']) {
      expect(buttonTag(html, slot), slot).toMatch(DISABLED);
    }
  });

  it('draws the bar the board draws: card-radius nav, 13px mono name, the three buttons on their variants (B1.V1 / B1.V4 / B1.V12 / B1.V13 / B1.A1)', () => {
    const html = render(viewOf(), true);

    expect(html).toMatch(/rounded-card border border-line bg-surface2 p-0\.5/);
    expect(html).toContain('lucide-chevron-left');
    expect(html).toContain('lucide-chevron-right');
    expect(html).toMatch(
      /data-slot="focus-name" class="truncate font-mono text-\[13px\] font-medium tracking-\[-\.01em\] text-text"/,
    );
    expect(buttonTag(html, 'focus-approve')).toContain('bg-ok text-on-ok');
    expect(buttonTag(html, 'focus-request-changes')).toContain('bg-bad/10');
    expect(buttonTag(html, 'focus-submit')).toContain('text-on-accent');
    for (const slot of ['focus-request-changes', 'focus-approve', 'focus-submit']) {
      expect(buttonTag(html, slot), slot).toContain('text-xs');
    }
    expect(html).toContain('lucide-x');
    expect(html).toContain('lucide-check');
    expect(html).toMatch(/data-slot="focus-submit"[^>]*>\s*<svg[^>]*lucide-lock size-3\.5"/);
  });

  it('runs full-bleed under the page header, the aside reaching the bottom (B1.V15)', () => {
    const html = render(viewOf(), true);

    expect(html).toMatch(
      /data-slot="focus-mode"[^>]*class="flex flex-col overflow-hidden border-t border-line bg-bg lg:min-h-\[calc\(100vh-14rem\)\]"/,
    );
    expect(html).toContain('grid flex-1 gap-0 lg:grid-cols-[300px_minmax(0,1fr)]');
    expect(html).toContain('lg:grid-cols-[392px_minmax(0,1fr)]');
  });

  it('ticks with the drawn Checkbox, names the track, and keeps the gate box shut in warn (B1.V7 / B4.A3 / B4.V1)', () => {
    const html = render(viewOf(), true);

    expect(html.match(/data-slot="focus-qa-check"/g)).toHaveLength(2);
    expect(html).toMatch(
      /<input type="checkbox"[^>]*data-slot="focus-qa-check"[^>]*data-check="qaStrategist"[^>]*checked/,
    );
    expect(html).not.toContain('accent-[var(--accent)]');
    expect(html).toContain('Required on the video track');
    expect(html).not.toContain('type is Video');
    expect(html).toContain('data-open="false"');
    expect(html).toContain(QA_GATE_NOTE);
    expect(html).toContain('1 of 2 required checks complete.');
    expect(html.match(/data-slot="section-label"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('opens the gate box in ok and swaps Submit to the open padlock once the guard allows it (B4.V1 / B4.V2)', () => {
    const html = render(
      viewOf({
        internalStatus: 'approved',
        status: 'revisions_needed',
        qaVideoEditor: true,
        qaStrategist: true,
      }),
      false,
    );

    expect(html).toContain('data-open="true"');
    expect(html).toContain(QA_GATE_OPEN_NOTE);
    expect(buttonTag(html, 'focus-submit')).not.toMatch(DISABLED);
    expect(html).toMatch(/data-slot="focus-submit"[^>]*>\s*<svg[^>]*lucide-lock-open/);
  });

  it('renders the due date sans, the comment stamp with its relative title, and the "You" composer (B1.A22 / B1.A21 / B1.V23)', () => {
    const html = render(viewOf(), true);

    expect(html).toContain('18 Oct 2026');
    expect(html).not.toContain('2026-10-18');
    expect(html).toContain(
      '<span class="text-[10px] text-text4" title="2 days ago">10 Oct, 3:42 PM</span>',
    );
    expect(html).toContain('bg-accent-line text-[10px] font-semibold text-on-accent">SK</span>');
    expect(html).toContain('text-text3">You</span>');
    expect(html).toMatch(/<textarea[^>]*rows="1"/);
  });

  it('previews the video track with the glass play disc, the type · ratio stamp and the file basename (B1.V16 / B1.A24)', () => {
    const html = render(viewOf(), true);

    expect(html).toContain('bg-linear-to-br from-surface3 via-surface2 via-55% to-bg-deep');
    expect(html).toContain('data-slot="focus-play"');
    expect(html).toContain('lucide-play');
    expect(html).toContain('Video · 9:16');
    expect(html).toContain(`title="${FILE_URL}">TV01-B3-CasualHangouts-V2_cut03.mp4</span>`);

    const still = render(viewOf({ briefType: 'Static', qaDesigner: false }), true);
    expect(still).not.toContain('data-slot="focus-play"');
    expect(still).not.toContain('Static · ');
    expect(still).toContain('Required on the static track');
  });

  it('names no colour outside the token layer', () => {
    expect(render(viewOf(), true)).not.toMatch(COLOUR_LITERAL);
    expect(render(viewOf({ internalStatus: 'approved', qaVideoEditor: true }), false)).not.toMatch(
      COLOUR_LITERAL,
    );
  });
});
