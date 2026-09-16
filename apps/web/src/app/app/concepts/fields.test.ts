import { INTERNAL_VIDEO_STATUS, chipTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  CONCEPT_COLUMNS,
  CONCEPT_GROUP_HEADINGS,
  CONCEPT_VIEWS,
  NO_CONCEPTS_NOTE,
  NO_MATCH_NOTE,
  SEARCH_PARAM,
  conceptColumns,
  conceptCountLabel,
  conceptViewFromParam,
  filteredConceptCountLabel,
  internalStatusView,
  internalStatusViews,
  matchesQuery,
  type ConceptItem,
} from './fields';

/** One list item in the shape the page builds, with only the fields a test cares about set. */
function item(id: string, status: (typeof INTERNAL_VIDEO_STATUS)[number]['key']): ConceptItem {
  return {
    id,
    name: `B1-Angle-Theme-${id}`,
    batch: 'B1',
    angleName: 'Angle',
    themeName: 'Theme',
    status: internalStatusView('video', status),
    href: `/app/concepts/${id}`,
  };
}

describe('conceptViewFromParam', () => {
  it('reads the two views the URL may ask for', () => {
    expect(conceptViewFromParam('table')).toBe('table');
    expect(conceptViewFromParam('board')).toBe('board');
  });

  it.each([null, undefined, '', 'grid', 'BOARD', 'table '])(
    'falls back to the table for %o',
    (value) => {
      expect(conceptViewFromParam(value)).toBe('table');
    },
  );

  it('offers exactly the two views, table first', () => {
    expect(CONCEPT_VIEWS).toEqual(['table', 'board']);
  });
});

describe('internalStatusViews', () => {
  it('is the track in order, with the state machine own labels and tones', () => {
    expect(internalStatusViews('video')).toEqual(
      INTERNAL_VIDEO_STATUS.map((entry) => ({
        key: entry.key,
        label: entry.label,
        tone: chipTone(entry.label),
      })),
    );
  });

  it('puts Approved on the ok tone and Videos Revisions on warn, straight from chipTone', () => {
    expect(internalStatusView('video', 'approved').tone).toBe('ok');
    expect(internalStatusView('video', 'videos_revisions').tone).toBe('warn');
  });

  it('renders a key the track does not list rather than an empty label', () => {
    // A static-track key handed to the video track: the label falls back to the stored value.
    expect(internalStatusView('video', 'sent_to_designer')).toEqual({
      key: 'sent_to_designer',
      label: 'sent_to_designer',
      tone: 'mute',
    });
  });
});

describe('conceptColumns', () => {
  it('keeps one column per step of the track, in track order, empties included', () => {
    const columns = conceptColumns('video', [item('a', 'ad_submitted')]);

    expect(columns.map((column) => column.status.key)).toEqual(
      INTERNAL_VIDEO_STATUS.map((entry) => entry.key),
    );
    expect(columns.find((column) => column.status.key === 'ad_submitted')?.items).toHaveLength(1);
    expect(columns.find((column) => column.status.key === 'approved')?.items).toHaveLength(0);
  });

  it('puts every row in exactly one column', () => {
    const items = [item('a', 'ad_submitted'), item('b', 'ad_submitted'), item('c', 'launched')];
    const columns = conceptColumns('video', items);

    expect(columns.flatMap((column) => column.items.map((entry) => entry.id))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('conceptCountLabel', () => {
  it.each([
    [0, '0 concepts'],
    [1, '1 concept'],
    [4, '4 concepts'],
  ])('reads %i as %s', (count, label) => {
    expect(conceptCountLabel(count)).toBe(label);
  });
});

describe('filteredConceptCountLabel', () => {
  it('reads as "n of m concepts", so the count never contradicts the rows', () => {
    expect(filteredConceptCountLabel(1, 4)).toBe('1 of 4 concepts');
    expect(filteredConceptCountLabel(0, 4)).toBe('0 of 4 concepts');
    expect(filteredConceptCountLabel(1, 1)).toBe('1 of 1 concept');
  });

  it('never reports a negative or fractional count', () => {
    expect(filteredConceptCountLabel(-2, 4)).toBe('0 of 4 concepts');
  });
});

describe('matchesQuery', () => {
  /** One row of the shape the table renders, with the four searchable fields set. */
  function row(overrides: Partial<ConceptItem> = {}): ConceptItem {
    return { ...item('a', 'videos_revisions'), ...overrides };
  }

  it('keeps every row when there is no query', () => {
    expect(matchesQuery(row(), '')).toBe(true);
  });

  it('reads the generated name, the batch and both halves of the pairing', () => {
    const concept = row({
      name: 'B2-It Is Not Just Your Age-Green Screen',
      batch: 'B2',
      angleName: 'It Is Not Just Your Age',
      themeName: 'Green Screen',
    });

    expect(matchesQuery(concept, 'green')).toBe(true);
    expect(matchesQuery(concept, 'b2')).toBe(true);
    expect(matchesQuery(concept, 'your age')).toBe(true);
    expect(matchesQuery(concept, 'zzzznomatch')).toBe(false);
  });

  it('reads the status LABEL, so the chip a reader can see is searchable', () => {
    expect(matchesQuery(row(), 'revisions')).toBe(true);
    expect(matchesQuery(row(), 'videos_revisions')).toBe(false);
  });

  it('treats an unpaired row as empty text rather than matching everything', () => {
    const bare = row({ name: 'B1', batch: null, angleName: null, themeName: null });

    expect(matchesQuery(bare, 'green')).toBe(false);
    expect(matchesQuery(bare, 'b1')).toBe(true);
  });
});

describe('the empty state copy', () => {
  it('says two different things, because they are two different problems', () => {
    expect(NO_CONCEPTS_NOTE).not.toBe(NO_MATCH_NOTE);
    expect(NO_MATCH_NOTE).toContain('search');
    expect(NO_CONCEPTS_NOTE).toContain('No concepts yet');
  });
});

describe('the page contract', () => {
  it('puts the search on the same ?q= key every other workspace uses', () => {
    expect(SEARCH_PARAM).toBe('q');
  });

  it('names the five table columns in the ticket order', () => {
    expect(CONCEPT_COLUMNS).toEqual(['Name', 'Batch', 'Angle', 'Theme', 'Internal Status']);
  });

  it('names the three blocks of the detail page in order', () => {
    expect(CONCEPT_GROUP_HEADINGS).toEqual(['Pairing', 'Inherited', 'Brief']);
  });
});
