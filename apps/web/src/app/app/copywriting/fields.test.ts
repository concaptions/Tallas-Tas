import { COPY_CTAS, COPY_FIELD_LABELS, COPY_LIMITS } from '@tas/domain/copy';
import { COPY_STATUS, copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  COPY_COLUMNS,
  COPY_FIELDS,
  COUNTER_TONE_CLASS,
  CTA_OPTIONS,
  NO_CREATIVE_LABEL,
  NO_CREATIVE_VALUE,
  STATUS_OPTIONS,
  copyCountLabel,
  counterLabel,
  counterTone,
  filteredCopyCountLabel,
  matchesQuery,
  type CopyItem,
} from './fields';

/** One row in the shape `page.tsx` builds, so the helpers are tested against what they receive. */
function item(overrides: Partial<CopyItem> = {}): CopyItem {
  const status = 'approved';
  return {
    id: '88888888-8888-4888-8888-000000000001',
    title: 'Copy #1',
    headline: 'Your Rota Is Broken. You Are Not.',
    primaryCopy: 'Six years of night shifts and he still could not sleep at noon.',
    linkDescription: '90 nights. Sleep or return.',
    cta: 'Shop Now',
    status,
    statusLabel: copyStatusLabel(status),
    statusTone: copyStatusTone(status),
    creativeBriefId: '77777777-7777-4777-8777-000000000001',
    creativeName: 'TAS-TV1-B1-Your Body Clock Is Not Broken-Problem/Solution-V2',
    creativeHref: '/app/briefs/77777777-7777-4777-8777-000000000001',
    conceptId: null,
    conceptName: null,
    funnel: null,
    used: false,
    winning: false,
    metaRating: null,
    spellingFeedback: null,
    clientComment: null,
    updatedLabel: 'yesterday',
    updatedTitle: '2026-09-16 11:20',
    ...overrides,
  };
}

describe('COPY_COLUMNS', () => {
  it('is exactly the six columns of the table, in order', () => {
    expect(COPY_COLUMNS).toEqual([
      'Copy title / Headline',
      'Linked Creative',
      'Concept',
      'Funnel',
      'Status',
      'Updated',
    ]);
  });

  it('names both values the first cell stacks', () => {
    expect(COPY_COLUMNS).toHaveLength(6);
    expect(COPY_COLUMNS[0]).toContain('Copy title');
    expect(COPY_COLUMNS[0]).toContain(COPY_FIELD_LABELS.headline);
  });
});

describe('COPY_FIELDS', () => {
  it('is exactly the four copy fields, in the PRD §5.11 order', () => {
    expect(COPY_FIELDS.map((field) => field.name)).toEqual([
      'primaryCopy',
      'headline',
      'linkDescription',
      'cta',
    ]);
  });

  it('never carries the client comment, which the client writes', () => {
    expect(COPY_FIELDS.map((field) => field.name)).not.toContain('clientComment');
  });

  it('shows the PRD character guidance on the three limited fields, and none on the CTA', () => {
    for (const field of COPY_FIELDS) {
      if (field.limit === null) {
        expect(field.name).toBe('cta');
        expect(field.hint).not.toMatch(/~\d/u);
      } else {
        expect(field.hint).toContain(`~${String(COPY_LIMITS[field.limit])}`);
      }
    }
  });
});

describe('the closed vocabularies', () => {
  it('offers every CTA the domain declares, in its order, and none of its own', () => {
    expect(CTA_OPTIONS.map((option) => option.value)).toEqual(COPY_CTAS.map((entry) => entry.key));
  });

  it('offers every copy status the domain declares, in its order', () => {
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual(
      COPY_STATUS.map((entry) => entry.key),
    );
  });

  it('keeps the "No creative" sentinel out of the brief ids it could collide with', () => {
    expect(NO_CREATIVE_VALUE).toBe('none');
    expect(NO_CREATIVE_LABEL).toBe('No creative');
    expect(COPY_STATUS.map((entry) => entry.key)).not.toContain(NO_CREATIVE_VALUE);
  });
});

describe('counterTone', () => {
  it('is muted while there is room', () => {
    expect(counterTone('short', 'headline')).toBe('muted');
  });

  it('turns warn exactly at the guide, because the last character still fits', () => {
    expect(counterTone('a'.repeat(COPY_LIMITS.headline), 'headline')).toBe('warn');
  });

  it('turns bad past the guide', () => {
    expect(counterTone('a'.repeat(COPY_LIMITS.headline + 1), 'headline')).toBe('bad');
  });

  it('is muted on an empty field rather than shouting at a blank form', () => {
    expect(counterTone(null, 'primaryCopy')).toBe('muted');
    expect(counterTone('', 'primaryCopy')).toBe('muted');
  });

  it('resolves every tone to a token class, never a colour', () => {
    for (const className of Object.values(COUNTER_TONE_CLASS)) {
      expect(className).not.toMatch(/#/u);
      expect(className.startsWith('text-')).toBe(true);
    }
  });
});

describe('counterLabel', () => {
  it('reads used of the guide', () => {
    expect(counterLabel('abc', 'headline')).toBe(`3 of ${String(COPY_LIMITS.headline)}`);
  });

  it('counts an emoji once, the way the copywriter typed it', () => {
    expect(counterLabel('🔥', 'headline')).toBe(`1 of ${String(COPY_LIMITS.headline)}`);
  });

  it('does not count the whitespace around the copy', () => {
    expect(counterLabel('  hi  ', 'headline')).toBe(`2 of ${String(COPY_LIMITS.headline)}`);
  });
});

describe('the count labels', () => {
  it.each([
    [0, '0 copy rows'],
    [1, '1 copy row'],
    [4, '4 copy rows'],
  ])('counts %s as %s', (count, label) => {
    expect(copyCountLabel(count)).toBe(label);
  });

  it('says how much of the list a search is showing', () => {
    expect(filteredCopyCountLabel(1, 4)).toBe('1 of 4 copy rows');
  });
});

describe('matchesQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matchesQuery(item(), '')).toBe(true);
  });

  it('finds a row by its generated title', () => {
    expect(matchesQuery(item(), 'copy #1')).toBe(true);
  });

  it('finds a row by its headline and by a phrase inside the primary copy', () => {
    expect(matchesQuery(item(), 'rota')).toBe(true);
    expect(matchesQuery(item(), 'night shifts')).toBe(true);
  });

  it('finds a row by its linked creative and by its status label', () => {
    expect(matchesQuery(item(), 'tv1-b1')).toBe(true);
    expect(matchesQuery(item(), 'approved')).toBe(true);
  });

  it('finds the unattached row by the words the panel offers for it', () => {
    const unattached = item({ creativeBriefId: null, creativeName: null, creativeHref: null });

    expect(matchesQuery(unattached, 'no creative')).toBe(true);
  });

  it('matches nothing it does not contain', () => {
    expect(matchesQuery(item(), 'carousel')).toBe(false);
  });
});
