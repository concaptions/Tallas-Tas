import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
    elementsTested: null,
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

function render(brief: BriefValues): string {
  return renderToStaticMarkup(
    <BriefDetail
      brief={brief}
      concept={null}
      conceptOptions={[]}
      angleName={null}
      productName={null}
      personaName={null}
      collectionName={null}
      assetName={null}
      copyLinks={[]}
      linked={{ sheetItems: [], modules: [], folders: [], reports: [] }}
      track="video"
      internal="sent_to_video_editor"
      client="pending_for_approval"
      demo={false}
    />,
  );
}

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
