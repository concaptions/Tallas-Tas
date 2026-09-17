import { demoBriefs } from '@tas/db';
import { creativeNameForConcept, dimensionsFor } from '@tas/domain/creatives';
import { describe, expect, it } from 'vitest';

import {
  BRIEF_COLUMNS,
  BRIEF_QA_CHECKS,
  BRIEF_QA_LABELS,
  advanceLabel,
  briefCountLabel,
  briefDimensions,
  filteredBriefCountLabel,
  internalStatusView,
  matchesQuery,
  nextInternalStatus,
  priorityView,
  productSuffixOf,
  type BriefItem,
} from './fields';

/** One row of the list, built the way `page.tsx` builds it. */
function item(overrides: Partial<BriefItem> = {}): BriefItem {
  return {
    id: 'brief-1',
    name: 'TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    conceptName: 'B1-Your Body Clock Is Not Broken-Problem/Solution',
    type: 'Video',
    typeLabel: 'Video',
    priority: priorityView('Video High'),
    assignee: 'Dorian Vance',
    status: internalStatusView('video', 'approved'),
    href: '/app/briefs/brief-1',
    ...overrides,
  };
}

describe('BRIEF_COLUMNS', () => {
  it('is the ticket order, exactly', () => {
    expect([...BRIEF_COLUMNS]).toEqual([
      'Name',
      'Concept',
      'Type',
      'Priority',
      'Assignee',
      'Internal Status',
    ]);
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
        funnel: brief.funnel,
        format: brief.type,
        number: brief.sequence,
        version: brief.version,
        batch: brief.batch,
        product: productSuffixOf(brief.name, brief.version),
      }),
    ).toBe(name);
  });

  it('covers all six fixtures', () => {
    expect(demoBriefs).toHaveLength(6);
  });
});
