import { renderToStaticMarkup } from 'react-dom/server';
import type { CreativeTrack } from '@tas/domain/state';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BriefActivityItem } from '@/lib/briefs-source';

import { NO_BRIEF_LINKS } from '../fields';
import type { BriefDimensionsPickerProps } from './dimensions-picker';

/**
 * The brief page rendered on the server, exactly as a request would, with the three modules a
 * server render cannot own mocked: the App Router (no router is mounted in a test), the two
 * Server Action modules (no Next runtime), and the Dimensions picker, replaced by a stub that
 * CAPTURES the props the page hands it — so a test can read what the page seeded the picker with
 * and call the handler the page gave it, the same call Radix makes on a tick. Hooks run during the
 * server render; a state update after it is a no-op on the server, which is what makes calling
 * the captured handler afterwards safe.
 */
const mocks = vi.hoisted(() => ({
  change: vi.fn<(id: string, change: { op: 'add' | 'remove'; key: string }) => Promise<unknown>>(),
  picker: { current: null as BriefDimensionsPickerProps | null },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('../actions', () => ({
  updateBriefAction: vi.fn(),
  toggleQaAction: vi.fn(),
  changeBriefDimensionAction: mocks.change,
}));
vi.mock('../spell-check-action', () => ({ runSpellCheckAction: vi.fn() }));
vi.mock('./dimensions-picker', () => ({
  BriefDimensionsPicker: (props: BriefDimensionsPickerProps) => {
    mocks.picker.current = props;
    return null;
  },
}));

// After the mocks: `brief-detail` resolves the mocked modules on import.
import { BriefDetail, type BriefValues } from './brief-detail';

/** An imported Gratsi video brief: a manual name and Airtable placement names for its ratios. */
function values(overrides: Partial<BriefValues> = {}): BriefValues {
  return {
    id: '050ea4fe-6915-4e33-8eec-555de55834b3',
    name: 'TV01-Everyday Wine Culture-Hrenee_23-V1',
    nameMode: 'manual',
    source: 'TAS',
    conceptId: null,
    designFileUrl: null,
    platform: [],
    batch: null,
    funnel: 'TOF',
    type: 'Video',
    sequence: 1,
    version: 1,
    priority: null,
    performance: null,
    assignee: null,
    dueDate: '',
    briefToDesign: null,
    scriptContent: null,
    inspoLinks: [],
    dimensions: ['Facebook Reels', 'Facebook Feed Square'],
    spellingFeedback: null,
    angleId: null,
    productId: null,
    spellingFeedback2: null,
    clickForAiSpellChecker: false,
    adContent: null,
    inspiration: null,
    inspirationImage: null,
    qaChecklistDoc: null,
    designFile: null,
    scriptAndBriefBreakdown: null,
    language: null,
    offer: null,
    qaVideoEditor: false,
    qaDesigner: false,
    qaStrategist: false,
    clientStatusNote: null,
    ...overrides,
  };
}

function render(
  brief: BriefValues,
  options: { track?: CreativeTrack; activity?: readonly BriefActivityItem[] } = {},
): string {
  return renderToStaticMarkup(
    <BriefDetail
      brief={brief}
      concept={null}
      conceptOptions={[]}
      angleName={null}
      productName={null}
      personaName={null}
      assetName={null}
      copyLinks={[]}
      linked={{ sheetItems: [], modules: [], folders: [], reports: [] }}
      track={options.track ?? 'video'}
      internal="sent_to_editor_or_designer"
      client="pending_for_approval"
      demo={false}
      activity={options.activity}
    />,
  );
}

/** The QA checklist's markup: from its slot to the next card in the rail. */
function qaSection(markup: string): string {
  const start = markup.indexOf('data-slot="brief-qa"');
  const end = markup.indexOf('data-slot="brief-spelling"', start);
  return start === -1 || end === -1 ? '' : markup.slice(start, end);
}

/** A Request Changes write as the log returns it: newest first, the ticks after the status. */
const RESET_WRITE: readonly BriefActivityItem[] = [
  {
    id: 'a3',
    field: 'qaStrategist',
    oldValue: 'true',
    newValue: 'false',
    actorName: 'Sarah K.',
    actorId: 'user_sarah',
    at: '2026-10-12T10:11:12.431Z',
  },
  {
    id: 'a2',
    field: 'qaVideoEditor',
    oldValue: 'true',
    newValue: 'false',
    actorName: 'Sarah K.',
    actorId: 'user_sarah',
    at: '2026-10-12T10:11:12.427Z',
  },
  {
    id: 'a1',
    field: 'internalStatus',
    oldValue: 'ad_submitted',
    newValue: 'revisions_needed',
    actorName: 'Sarah K.',
    actorId: 'user_sarah',
    at: '2026-10-12T10:11:12.419Z',
  },
];

const PLAIN_EDIT: readonly BriefActivityItem[] = [
  {
    id: 'b1',
    field: 'assignee',
    oldValue: null,
    newValue: 'Mia D.',
    actorName: null,
    actorId: 'user_mia',
    at: '2026-10-11T08:00:00.000Z',
  },
];

afterEach(() => {
  mocks.change.mockReset();
  mocks.picker.current = null;
});

describe('BriefDetail — the Dimensions picker (smoke test, 2026-10-10)', () => {
  it('seeds the picker from the STORED array, with imported placement names read as ratios', () => {
    render(values());

    expect(mocks.picker.current?.selected).toEqual(['1:1', '9:16']);
  });

  it('dispatches the change action on a tick, with the brief id and ONE merged change', () => {
    mocks.change.mockResolvedValue({ ok: true, dimensions: ['4:5', '1:1', '9:16'] });
    const brief = values();
    render(brief);

    mocks.picker.current?.onToggle('4:5');

    expect(mocks.change).toHaveBeenCalledTimes(1);
    expect(mocks.change).toHaveBeenCalledWith(brief.id, { op: 'add', key: '4:5' });
  });

  it('dispatches a removal for a ratio the brief already carries', () => {
    mocks.change.mockResolvedValue({ ok: true, dimensions: ['9:16'] });
    const brief = values();
    render(brief);

    mocks.picker.current?.onToggle('1:1');

    expect(mocks.change).toHaveBeenCalledWith(brief.id, { op: 'remove', key: '1:1' });
  });

  it('keeps the sheet-item link counts type honest: NO_BRIEF_LINKS still names four kinds', () => {
    expect(Object.keys(NO_BRIEF_LINKS)).toHaveLength(4);
  });
});

/** The h1 the page prints for the name. */
function heading(markup: string): string | undefined {
  return /data-slot="brief-name"[^>]*>([^<]*)</.exec(markup)?.[1];
}

describe('BriefDetail — the name (smoke test, 2026-10-10)', () => {
  it('shows a manual-named brief under its STORED name, never a recomputed one', () => {
    const markup = render(values({ name: 'SMOKETEST-DELETE-ME-20261010', nameMode: 'manual' }));

    expect(heading(markup)).toBe('SMOKETEST-DELETE-ME-20261010');
    expect(markup).not.toContain('TAS-TV2-Batch-Standalone-V1');
    expect(markup).toContain('Nothing rewrites this name.');
  });

  it('shows an auto-named brief under its stored name too — the formula runs at create time only', () => {
    const markup = render(
      values({ name: 'TAS_TOF_V_007_pain-ugc_B1', nameMode: 'auto', version: 3 }),
    );

    expect(heading(markup)).toBe('TAS_TOF_V_007_pain-ugc_B1');
  });
});

describe('BriefDetail — the QA checklist (B4.V3, Oct 12 UI overhaul)', () => {
  it('lists all three ticks for a video brief, with the designer’s struck through as N/A', () => {
    const qa = qaSection(render(values()));

    expect(qa).toContain('Video Editor QA');
    expect(qa).toContain('Graphic Designer QA');
    expect(qa).toContain('Creative Strategist QA');
    expect(qa).toMatch(/data-check="qaDesigner" data-applicable="false"/);
    expect(qa).toContain('N/A · video');
  });

  it('flips the N/A row to the editor on the static track', () => {
    const qa = qaSection(render(values({ type: 'Static' }), { track: 'static' }));

    expect(qa).toMatch(/data-check="qaVideoEditor" data-applicable="false"/);
    expect(qa).toMatch(/data-check="qaDesigner" data-applicable="true"/);
    expect(qa).toContain('N/A · static');
  });

  it('tags each missing required tick and says how far the gate is from opening, in warn', () => {
    const qa = qaSection(render(values()));

    expect(qa.match(/>Required</g)).toHaveLength(2);
    expect(qa).toMatch(
      /data-slot="brief-qa-gate" data-open="false" class="text-\[11px\] text-warn"/,
    );
    expect(qa).toContain('0 of 2 required checks complete.');
  });

  it('turns the gate line ok once every required tick is set, with no tag left', () => {
    const qa = qaSection(render(values({ qaVideoEditor: true, qaStrategist: true })));

    expect(qa).not.toContain('>Required<');
    expect(qa).toMatch(/data-open="true" class="text-\[11px\] text-ok"/);
    expect(qa).toContain('2 of 2 required checks complete.');
  });

  it('keeps the brief-qa-check slot and data-check on each input, for the e2e', () => {
    const qa = qaSection(render(values()));

    expect(qa.match(/<input[^>]*data-slot="brief-qa-check"/g)).toHaveLength(3);
    expect(qa).toMatch(/<input[^>]*id="brief-qa-qaStrategist"[^>]*data-check="qaStrategist"/);
  });
});

describe('BriefDetail — the Activity section (board 5: B5.V4, B5.V1, B5.V2, B5.V3, B5.V5)', () => {
  it('shows the empty state when nothing is logged', () => {
    const markup = render(values());

    expect(markup).toContain('data-slot="brief-activity-empty"');
    expect(markup).toContain('No activity yet.');
  });

  it('draws a Request Changes write as ONE group: the actor once, the status row, then the ticks', () => {
    const markup = render(values(), { activity: RESET_WRITE });

    expect(markup.match(/data-slot="brief-activity-group"/g)).toHaveLength(1);
    expect(markup.match(/data-slot="brief-activity-actor"/g)).toHaveLength(1);
    expect(markup).toContain('>Sarah K.<');
    const fields = [
      ...markup.matchAll(/data-slot="brief-activity-entry" data-field="([^"]+)"/g),
    ].map((match) => match[1]);
    expect(fields).toEqual(['internalStatus', 'qaVideoEditor', 'qaStrategist']);
  });

  it('renders a status move as two chips with the arrow, keeping the raw key in the slot', () => {
    const markup = render(values(), { activity: RESET_WRITE });

    expect(markup).toContain('>Internal status<');
    expect(markup).toMatch(/data-slot="brief-activity-old" data-value="ad_submitted"/);
    expect(markup).toMatch(/data-slot="brief-activity-new" data-value="revisions_needed"/);
    expect(markup).toContain('data-tone="mute"');
    expect(markup).toContain('data-tone="warn"');
    expect(markup).toContain('>Ad Submitted<');
    expect(markup).toContain('>Revisions Needed<');
    // The stored key travels as data-value only; a screen reader hears the chip's label, then "to".
    expect(markup).not.toContain('>ad_submitted<');
    expect(markup).toContain('class="sr-only">to<');
    expect(markup).toContain('lucide-arrow-right');
  });

  it('tones the cleared ticks bad and the previous true ok, in mono, under the checklist labels', () => {
    const markup = render(values(), { activity: RESET_WRITE });

    expect(markup).toContain('Video Editor QA');
    expect(markup).toMatch(
      /data-slot="brief-activity-old" data-value="true" class="font-mono text-\[10px\] text-ok"/,
    );
    expect(markup).toMatch(
      /data-slot="brief-activity-new" data-value="false" class="font-mono text-\[10px\] text-bad"/,
    );
  });

  it('names the shut gate once under a reset group, and tints the card', () => {
    const markup = render(values(), { activity: RESET_WRITE });

    expect(markup.match(/data-slot="brief-activity-reset"/g)).toHaveLength(1);
    expect(markup).toContain('QA reset · Submit to Client re-locked');
    expect(markup).toContain('lucide-lock');
    expect(markup).toMatch(
      /data-slot="brief-activity-group" data-reset="true"[^>]*border-warn\/40/,
    );
  });

  it('renders a plain edit without the gate line, a dash for the empty side, and the actor id as fallback', () => {
    const markup = render(values(), { activity: PLAIN_EDIT });

    expect(markup).not.toContain('data-slot="brief-activity-reset"');
    expect(markup).toContain('>Assignee<');
    expect(markup).toContain('>user_mia<');
    expect(markup).toMatch(
      /data-slot="brief-activity-old" class="font-mono text-\[11px\] text-text4">—</,
    );
    expect(markup).toMatch(/data-slot="brief-activity-at">11 Oct, 8:00 AM</);
  });

  it('keeps the heading id the section is labelled by', () => {
    const markup = render(values(), { activity: PLAIN_EDIT });

    expect(markup).toContain('aria-labelledby="brief-activity-heading"');
    expect(markup).toContain('id="brief-activity-heading"');
  });
});

describe('BriefDetail — the token layer', () => {
  it('holds every colour in a token class: no literal anywhere on the page', () => {
    const markup = render(values(), { activity: [...RESET_WRITE, ...PLAIN_EDIT] });

    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toContain('rgb(');
  });
});
