import {
  demoBriefs,
  demoClientAssetFolders,
  demoCreativeModules,
  demoCreativeReports,
  demoCreativeSheetItems,
} from '@tas/db';
import { creativePerformances } from '@tas/db/schema';
import { creativeNameForConcept, dimensionsFor } from '@tas/domain/creatives';
import { describe, expect, it } from 'vitest';

import {
  BRIEF_HEADINGS,
  BRIEF_LINK_SECTIONS,
  BRIEF_QA_CHECKS,
  BRIEF_QA_LABELS,
  NO_BRIEF_LINKS,
  PERFORMANCE_OPTIONS,
  advanceLabel,
  briefCountLabel,
  briefDimensions,
  briefLinkedRecords,
  clientStatusView,
  cpaVsTargetLabel,
  filteredBriefCountLabel,
  briefStageView,
  indexBriefLinkCounts,
  internalStatusView,
  linkCountLabel,
  linkedName,
  matchesQuery,
  nextInternalStatus,
  performanceView,
  priorityView,
  productSuffixOf,
  unlistedPerformance,
  type BriefItem,
  type BriefLinkSources,
} from './fields';

const EMPTY_SNAPSHOT = {
  conceptId: '',
  funnel: 'TOF',
  type: 'Video',
  version: '1',
  batch: '',
  product: '',
  priority: '',
  assignee: '',
  dueDate: '',
  briefToDesign: '',
  scriptContent: '',
  elementsTested: '',
  adContent: '',
  inspiration: '',
  offer: '',
  language: '',
  spellingFeedback2: '',
  angleId: '',
  productId: '',
  inspoLinks: [] as string[],
  dimensions: [] as string[],
  internalStatus: 'approved',
  clientStatus: 'pending_for_approval',
} as const;

/** The first fixture, used as the stored row behind the view fields a test overrides by hand. */
const [firstFixture] = demoBriefs;
if (firstFixture === undefined) {
  throw new Error('the demo brief fixtures are empty');
}
/** Bound once, narrowed: the hoisted `item()` below cannot see the guard above. */
const FIXTURE_ROW = firstFixture;

function item(overrides: Partial<BriefItem> = {}): BriefItem {
  return {
    id: 'brief-1',
    name: 'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    conceptName: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
    type: 'Video',
    typeLabel: 'Video',
    priority: priorityView('Video High'),
    assignee: 'Dorian Vance',
    status: internalStatusView('video', 'approved'),
    clientStatus: clientStatusView('pending_for_approval'),
    performance: null,
    stage: briefStageView('approved'),
    row: FIXTURE_ROW,
    angleName: null,
    productName: null,
    collectionName: null,
    campaignOfferName: null,
    assetName: null,
    funnelLabel: 'TOF',
    sourceLabel: 'TAS',
    href: '/app/briefs/brief-1',
    kanbanFields: { clientStatus: 'pending_for_approval', internalStatus: 'approved' },
    galleryImageUrl: null,
    formSnapshot: EMPTY_SNAPSHOT,
    linkCounts: NO_BRIEF_LINKS,
    ...overrides,
  };
}

/** The four counterpart fixtures, as the pages read them through the demo-aware `load…` functions. */
const DEMO_LINK_SOURCES: BriefLinkSources = {
  sheetItems: demoCreativeSheetItems,
  modules: demoCreativeModules,
  folders: demoClientAssetFolders,
  reports: demoCreativeReports,
};

/** `demoBriefs` ids: the one every counterpart cites, the one only a module cites, the standalone. */
const BODY_CLOCK = '77777777-7777-4777-8777-000000000001';
const NINETY_MINUTES_CAROUSEL = '77777777-7777-4777-8777-000000000006';
const BUNDLE_STANDALONE = '77777777-7777-4777-8777-000000000005';
const BODY_CLOCK_LAUNCHED = '77777777-7777-4777-8777-000000000007';

/**
 * The six-string `BRIEF_COLUMNS` tuple this file used to assert exhaustively ("is the ticket order,
 * exactly") is GONE: the grid's columns are `column_definitions` rows now (AI-64a), so a label, an
 * order or a hidden column is a data edit and a code assertion about them would be a lie. What is
 * still code — and so still worth pinning — is the stage view the primary cell colours itself with
 * and the link-name resolution the server does before the grid sees a row. The "every resolved
 * column has a renderer" gate lives beside the registry, in `briefs-workspace.test.tsx`.
 */
describe('briefStageView', () => {
  it('reads the label and the tone from EDITOR_STAGES, never from this file', () => {
    expect(briefStageView('sent_to_video_editor')).toEqual({
      key: 'incoming',
      label: 'Incoming',
      tone: 'info',
    });
    expect(briefStageView('static_design_in_progress')).toEqual({
      key: 'under_editing',
      label: 'Under Editing',
      tone: 'warn',
    });
    expect(briefStageView('ad_submitted')).toEqual({
      key: 'under_review',
      label: 'Under Review',
      tone: 'accent',
    });
  });

  it('puts revisions back under Editing, where the editor holds the work again', () => {
    expect(briefStageView('videos_revisions')?.key).toBe('under_editing');
    expect(briefStageView('images_revisions')?.key).toBe('under_editing');
    expect(briefStageView('revisions_submitted')?.key).toBe('under_review');
  });

  it('is null once the brief has left the editor board, so the cell shows no stage at all', () => {
    expect(briefStageView('approved')).toBeNull();
    expect(briefStageView('launched')).toBeNull();
    // Not a member of either linear ladder on purpose, so it is off the board too.
    expect(briefStageView('on_hold')).toBeNull();
  });

  it('is null for a status this build does not know, rather than guessing a stage', () => {
    expect(briefStageView('')).toBeNull();
    expect(briefStageView('sent_to_nobody')).toBeNull();
  });
});

describe('linkedName', () => {
  const names = new Map([['product-1', 'Weighted Blanket']]);

  it('names the linked row', () => {
    expect(linkedName('product-1', names)).toBe('Weighted Blanket');
  });

  it('is null for an absent link — the ordinary standalone case, never an error', () => {
    expect(linkedName(null, names)).toBeNull();
  });

  it('is null for a link whose row is another brand\u2019s or soft-deleted, so nothing is invented', () => {
    expect(linkedName('product-9', names)).toBeNull();
  });
});

describe('internalStatusView', () => {
  it('reads the label and the tone from the state machine', () => {
    expect(internalStatusView('video', 'approved')).toEqual({
      key: 'approved',
      label: 'Approved',
      tone: 'ok',
    });
  });

  it('places a static brief on its own ladder', () => {
    expect(internalStatusView('static', 'images_revisions')).toEqual({
      key: 'images_revisions',
      label: 'Images Revisions',
      tone: 'warn',
    });
  });
});

describe('priorityView', () => {
  it('carries the SLA the priority promises, not the word on it', () => {
    expect(priorityView('Static High')).toEqual({ label: 'Static High', tone: 'bad', sla: '12h' });
    expect(priorityView('Video Average')).toEqual({
      label: 'Video Average',
      tone: 'mute',
      sla: '48h',
    });
  });

  it('is null for a brief nobody has prioritised', () => {
    expect(priorityView(null)).toBeNull();
  });
});

describe('PERFORMANCE_OPTIONS', () => {
  it('is the schema vocabulary, in schema order, each value its own label', () => {
    expect(PERFORMANCE_OPTIONS.map((option) => option.key)).toEqual([...creativePerformances]);
    expect(PERFORMANCE_OPTIONS.map((option) => option.label)).toEqual([...creativePerformances]);
  });

  it('tones a winner ok, a loser bad, and the one worth iterating info', () => {
    expect(PERFORMANCE_OPTIONS.map((option) => option.tone)).toEqual(['ok', 'info', 'bad']);
  });
});

describe('performanceView', () => {
  it('reads the label and the tone of a stored grade', () => {
    expect(performanceView('Winning')).toEqual({ key: 'Winning', label: 'Winning', tone: 'ok' });
    expect(performanceView('Losing')).toEqual({ key: 'Losing', label: 'Losing', tone: 'bad' });
  });

  it('is null for a brief that has not run, so the page shows no chip rather than a blank one', () => {
    expect(performanceView(null)).toBeNull();
  });

  it('renders a grade this build does not list muted, never as an empty cell', () => {
    expect(performanceView('Breakeven')).toEqual({
      key: 'Breakeven',
      label: 'Breakeven',
      tone: 'mute',
    });
  });

  it('reads the two graded fixtures back as the grades they carry', () => {
    const graded = demoBriefs
      .filter((brief) => brief.performance !== null)
      .map((brief) => performanceView(brief.performance)?.label);
    expect(graded).toEqual(['High Potential to Iterate', 'Winning']);
  });
});

describe('unlistedPerformance', () => {
  it('is null for an ungraded brief and for each of the three listed grades', () => {
    expect(unlistedPerformance(null)).toBeNull();
    for (const grade of creativePerformances) {
      expect(unlistedPerformance(grade)).toBeNull();
    }
  });

  it('returns an unmapped Gratsi choice as its own muted view, so the select can offer it', () => {
    expect(unlistedPerformance('Winning (ROAS/CPA Goal)')).toEqual({
      key: 'Winning (ROAS/CPA Goal)',
      label: 'Winning (ROAS/CPA Goal)',
      tone: 'mute',
    });
  });

  it('is null for every fixture, which all carry a listed grade or none', () => {
    expect(demoBriefs.map((brief) => unlistedPerformance(brief.performance))).toEqual(
      demoBriefs.map(() => null),
    );
  });
});

describe('BRIEF_HEADINGS', () => {
  it('names the five Gratsi fields the parity spec looks for, verbatim', () => {
    expect([
      BRIEF_HEADINGS.batch,
      BRIEF_HEADINGS.angle,
      BRIEF_HEADINGS.product,
      BRIEF_HEADINGS.performance,
      BRIEF_HEADINGS.spellingFeedback2,
    ]).toEqual(['Batch', 'Angle', 'Product', 'Performance', 'Spelling Feedback 2']);
  });
});

describe('matchesQuery', () => {
  it('matches the generated name, the concept, the type, the assignee and the status label', () => {
    expect(matchesQuery(item(), 'body clock')).toBe(true);
    expect(matchesQuery(item(), 'video')).toBe(true);
    expect(matchesQuery(item(), 'okafor')).toBe(false);
    expect(matchesQuery(item(), 'approved')).toBe(true);
  });

  it('finds a standalone brief by the slug its cell renders', () => {
    expect(matchesQuery(item({ conceptName: null }), 'standalone')).toBe(true);
  });

  it('keeps every row on an empty query', () => {
    expect(matchesQuery(item(), '')).toBe(true);
  });
});

describe('count labels', () => {
  it('never says "1 briefs"', () => {
    expect(briefCountLabel(1)).toBe('1 brief');
    expect(briefCountLabel(6)).toBe('6 briefs');
  });

  it('says how many of how many while a search is narrowing', () => {
    expect(filteredBriefCountLabel(1, 6)).toBe('1 of 6 briefs');
  });
});

describe('briefDimensions', () => {
  it('renders the stored ratios, in vocabulary order and with their pixel sizes', () => {
    expect(briefDimensions(['9:16', '1:1'], 'Static').map((entry) => entry.key)).toEqual([
      '9:16',
      '1:1',
    ]);
    expect(briefDimensions(['1:1'], 'Static')[0]?.pixels).toBe('1080x1080');
  });

  it('falls back to the PRD §8 defaults for the type when the row carries none', () => {
    expect(briefDimensions([], 'Video').map((entry) => entry.key)).toEqual([
      ...dimensionsFor('Video'),
    ]);
    expect(briefDimensions([], 'Carousel').map((entry) => entry.key)).toEqual(['1:1', '9:16']);
  });

  it('drops a ratio this build cannot deliver rather than rendering it raw', () => {
    expect(briefDimensions(['1:1', '21:9'], 'Static').map((entry) => entry.key)).toEqual(['1:1']);
  });
});

describe('nextInternalStatus', () => {
  it('offers the next linear step of the brief own ladder', () => {
    expect(nextInternalStatus('static', 'sent_to_designer')?.key).toBe('static_design_in_progress');
    expect(nextInternalStatus('video', 'sent_to_video_editor')?.key).toBe(
      'video_editing_in_progress',
    );
  });

  it('never offers the non-linear on_hold branch', () => {
    expect(nextInternalStatus('video', 'video_editing_in_progress')?.key).toBe('ad_submitted');
  });

  it('is null at the end of the track', () => {
    expect(nextInternalStatus('video', 'launched')).toBeNull();
  });

  it('labels the button with the step it moves to', () => {
    const next = nextInternalStatus('video', 'approved');
    expect(next).not.toBeNull();
    expect(next === null ? '' : advanceLabel(next)).toBe('Advance to Launched');
  });
});

describe('BRIEF_QA_LABELS', () => {
  it('names the three reviewers of criterion 10, in order', () => {
    expect(BRIEF_QA_CHECKS.map((check) => BRIEF_QA_LABELS[check])).toEqual([
      'Video Editor QA',
      'Graphic Designer QA',
      'Creative Strategist QA',
    ]);
  });
});

describe('productSuffixOf', () => {
  it('reads the PRD §7 product suffix back out of a standalone name', () => {
    expect(productSuffixOf('RS1-B4-Standalone-V3-NIGHT RESET BUNDLE', 3)).toBe(
      'NIGHT RESET BUNDLE',
    );
  });

  it('is null for a linked brief, whose name carries no suffix', () => {
    expect(
      productSuffixOf('TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2', 2),
    ).toBeNull();
  });

  it('is not confused by hyphens inside the concept segment', () => {
    expect(productSuffixOf('AM1-B2-Make 9am Look Like 3am-POV: X vs Y-V1', 1)).toBeNull();
  });

  it('is null when the name does not carry the version it was given', () => {
    expect(productSuffixOf('RS1-B4-Standalone-V3-NIGHT RESET BUNDLE', 5)).toBeNull();
  });
});

describe('BRIEF_LINK_SECTIONS', () => {
  it('gives every section its own data-slot, in the rail order', () => {
    const slots = BRIEF_LINK_SECTIONS.map((section) => section.slot);
    expect(slots).toEqual([
      'brief-creative-sheet',
      'brief-creative-modules',
      'brief-client-assets',
      'brief-creative-reports',
    ]);
    expect(new Set(slots).size).toBe(slots.length);
  });
});

describe('linkCountLabel', () => {
  it('counts each table in rail order, singular at one', () => {
    expect(linkCountLabel({ sheetItems: 1, modules: 2, folders: 0, reports: 1 })).toBe(
      '1 sheet row · 2 modules · 0 asset folders · 1 report',
    );
  });

  it('never says "1 rows" and never hides a zero', () => {
    expect(linkCountLabel(NO_BRIEF_LINKS)).toBe(
      '0 sheet rows · 0 modules · 0 asset folders · 0 reports',
    );
  });
});

describe('indexBriefLinkCounts', () => {
  const index = indexBriefLinkCounts(DEMO_LINK_SOURCES);

  it('counts every counterpart row that points at the brief, by the junction', () => {
    expect(index.get(BODY_CLOCK)).toEqual({ sheetItems: 1, modules: 1, folders: 1, reports: 1 });
    expect(index.get(NINETY_MINUTES_CAROUSEL)).toEqual({
      sheetItems: 0,
      modules: 1,
      folders: 0,
      reports: 0,
    });
  });

  it('leaves a brief nobody cites out, so the page reads NO_BRIEF_LINKS for it', () => {
    expect(index.get('77777777-7777-4777-8777-999999999999')).toBeUndefined();
  });

  it('skips a sheet row or report whose link is still empty rather than indexing a null', () => {
    const sheetTotal = [...index.values()].reduce((sum, counts) => sum + counts.sheetItems, 0);
    const reportTotal = [...index.values()].reduce((sum, counts) => sum + counts.reports, 0);
    expect(sheetTotal).toBe(demoCreativeSheetItems.filter((row) => row.briefId !== null).length);
    expect(reportTotal).toBe(demoCreativeReports.filter((row) => row.briefId !== null).length);
  });
});

describe('briefLinkedRecords', () => {
  const linked = briefLinkedRecords(BODY_CLOCK, DEMO_LINK_SOURCES);

  it('renders the sheet row by its computed name, in mono, with the sheet own two status chips', () => {
    expect(linked.sheetItems).toEqual([
      {
        id: 'c5c5c5c5-c5c5-4c5c-8c5c-000000000001',
        label: 'October-TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
        mono: true,
        href: '/app/creative-sheet?creative-sheet=c5c5c5c5-c5c5-4c5c-8c5c-000000000001',
        detail: null,
        chips: [
          { label: 'Approved', tone: 'ok' },
          { label: 'Pending For Approval', tone: 'info' },
        ],
      },
    ]);
  });

  it('links the module and the asset folder to their own panels by name', () => {
    expect(linked.modules).toEqual([
      {
        id: '1234abcd-1234-4abc-8abc-000000000001',
        label: 'Problem → Solution Hooks',
        mono: false,
        href: '/app/creative-modules?module=1234abcd-1234-4abc-8abc-000000000001',
        detail: null,
        chips: [],
      },
    ]);
    expect(linked.folders).toEqual([
      {
        id: 'f01de125-f01d-4f01-8f01-000000000002',
        label: 'Product Photography — Deep Sleep Blanket',
        mono: false,
        href: '/app/client-assets?folder=f01de125-f01d-4f01-8f01-000000000002',
        detail: null,
        chips: [],
      },
    ]);
  });

  it('reads a report as its name, CPA against target, and the difference as a chip', () => {
    expect(linked.reports).toEqual([
      {
        id: 'c0c0c0c0-c0c0-4c0c-8c0c-000000000002',
        label: 'Body Clock V2 — Shift Worker — 90-Night Trial',
        mono: false,
        href: '/app/creative-reporting?creativeReport=c0c0c0c0-c0c0-4c0c-8c0c-000000000002',
        detail: 'CPA $24.50 vs target $22.00',
        chips: [{ label: '+$2.50', tone: 'bad' }],
      },
    ]);
  });

  it('reads a report under target as ok', () => {
    const [report] = briefLinkedRecords(BODY_CLOCK_LAUNCHED, DEMO_LINK_SOURCES).reports;
    expect(report?.detail).toBe('CPA $19.80 vs target $22.00');
    expect(report?.chips).toEqual([{ label: '−$2.20', tone: 'ok' }]);
  });

  it('keeps two chips that share a word, one per track', () => {
    const [sheet] = briefLinkedRecords(BUNDLE_STANDALONE, DEMO_LINK_SOURCES).sheetItems;
    expect(sheet?.chips).toEqual([
      { label: 'Approved', tone: 'ok' },
      { label: 'Approved', tone: 'ok' },
    ]);
  });

  it('is empty, not absent, for a table nothing points from', () => {
    const sparse = briefLinkedRecords(NINETY_MINUTES_CAROUSEL, DEMO_LINK_SOURCES);
    expect(sparse.sheetItems).toEqual([]);
    expect(sparse.modules.map((record) => record.label)).toEqual(['Parent Handover Window']);
    expect(sparse.folders).toEqual([]);
    expect(sparse.reports).toEqual([]);
  });
});

describe('cpaVsTargetLabel', () => {
  it('formats both sides as currency and dashes an unset side', () => {
    expect(cpaVsTargetLabel('24.5', '22')).toBe('CPA $24.50 vs target $22.00');
    expect(cpaVsTargetLabel(null, '30.00')).toBe('CPA — vs target $30.00');
  });
});

/**
 * The assertion `packages/db` asked `apps/web` to own: `demo-data.ts` builds its fixture names with
 * a two-line copy of the §7 formula, because `@tas/db` cannot depend on `@tas/domain`. This is the
 * place the two copies meet — the app imports both — so a drift in either one fails here rather
 * than on a page.
 */
describe('the fixture names and the domain formula agree', () => {
  it.each(demoBriefs.map((brief) => [brief.name, brief] as const))('rebuilds %s', (name, brief) => {
    const concept =
      brief.conceptName === null ? null : { name: brief.conceptName, batch: brief.batch };

    expect(
      creativeNameForConcept(concept, {
        source: brief.source,
        funnel: brief.funnel,
        format: brief.type,
        number: brief.sequence,
        version: brief.version,
        batch: brief.batch,
        product: productSuffixOf(brief.name, brief.version),
      }),
    ).toBe(name);
  });

  it('covers all seven fixtures', () => {
    expect(demoBriefs).toHaveLength(7);
  });
});
