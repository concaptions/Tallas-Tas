import { demoCollections } from '@tas/db';
import { COPY_CTAS, COPY_LIMITS } from '@tas/domain/copy';
import { COPY_STATUS, copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import { collectionsPath } from '@/lib/routes';

import {
  CAMPAIGNS_READ_ONLY_NOTE,
  COLLECTIONS_READ_ONLY_NOTE,
  COPY_FIELDS,
  COPY_HEADINGS,
  COUNTER_TONE_CLASS,
  CTA_OPTIONS,
  NO_CREATIVE_LABEL,
  NO_CREATIVE_VALUE,
  STATUS_OPTIONS,
  collectionsByCopy,
  copyCountLabel,
  copyTypeIdsByCopy,
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
    copyNumber: 1,
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
    copyTypeIds: ['c0b7a1d3-0013-4013-8013-000000000001'],
    campaigns: [],
    collections: [],
    linkedCollectionId: null,
    angleName: null,
    productId: null,
    productName: null,
    productLink: null,
    offer: null,
    campaignNames: null,
    campaignCodes: null,
    collectionUrls: null,
    collectionProducts: null,
    copyTypeNames: ['Problem / Agitate / Solve'],
    clientApprovalStatus: null,
    createdBy: 'seed',
    updatedLabel: 'yesterday',
    updatedTitle: '2026-09-16 11:20',
    ...overrides,
  };
}

/** A copy type as `loadCopyTypes` hands it to the page: its id and the Meta copies tagged with it. */
function copyType(id: string, metaCopyIds: readonly string[]) {
  return { id, metaCopies: metaCopyIds.map((copyId) => ({ id: copyId })) };
}

const COPY_A = '88888888-8888-4888-8888-000000000001';
const COPY_B = '88888888-8888-4888-8888-000000000002';
const TYPE_PAS = 'c0b7a1d3-0013-4013-8013-000000000001';
const TYPE_TESTIMONIAL = 'c0b7a1d3-0013-4013-8013-000000000002';
const TYPE_UNUSED = 'c0b7a1d3-0013-4013-8013-000000000004';

describe('copyTypeIdsByCopy', () => {
  it('inverts each type’s Meta copies into the ids the copy is tagged with', () => {
    const byCopy = copyTypeIdsByCopy([
      copyType(TYPE_PAS, [COPY_A, COPY_B]),
      copyType(TYPE_TESTIMONIAL, [COPY_B]),
    ]);

    expect(byCopy.get(COPY_A)).toEqual([TYPE_PAS]);
    expect(byCopy.get(COPY_B)).toEqual([TYPE_PAS, TYPE_TESTIMONIAL]);
  });

  it('gives a copy tagged with nothing no entry, so the page falls back to an empty list', () => {
    const byCopy = copyTypeIdsByCopy([copyType(TYPE_PAS, [COPY_A]), copyType(TYPE_UNUSED, [])]);

    expect(byCopy.has(COPY_B)).toBe(false);
    expect([...byCopy.values()].flat()).not.toContain(TYPE_UNUSED);
  });

  it('keeps the order the types arrived in and stores a repeated link once', () => {
    const byCopy = copyTypeIdsByCopy([
      copyType(TYPE_TESTIMONIAL, [COPY_A]),
      copyType(TYPE_PAS, [COPY_A, COPY_A]),
    ]);

    expect(byCopy.get(COPY_A)).toEqual([TYPE_TESTIMONIAL, TYPE_PAS]);
  });
});

describe('the three record-link sections', () => {
  it('names them the way Airtable does, so the E2E assertions and the panel agree', () => {
    expect(COPY_HEADINGS.copyTypes).toBe('Copy Types');
    expect(COPY_HEADINGS.campaigns).toBe('Campaigns & Offers');
    expect(COPY_HEADINGS.collections).toBe('Collections');
  });

  it('says why the campaigns list has no picker rather than leaving the gap unexplained', () => {
    expect(CAMPAIGNS_READ_ONLY_NOTE).toContain('ships with');
  });

  it('says where the collection link is made instead of offering a picker for a link it does not own', () => {
    expect(COLLECTIONS_READ_ONLY_NOTE).toContain('Copywriting ID');
  });
});

describe('collectionsByCopy', () => {
  /**
   * Run over the collection fixtures the page serves in demo mode: BFCM points at Copy #1 through
   * its `copywritingId`, the summer collection points at nothing. Read by name, so a renumbered
   * fixture cannot silently pass.
   */
  const bfcm = demoCollections.find((row) => row.name === 'BFCM 2026 Collection');
  const summer = demoCollections.find((row) => row.name === 'Summer Cooling Collection');
  if (bfcm === undefined || summer === undefined)
    throw new Error('demo collection fixture missing');
  const byCopy = collectionsByCopy(demoCollections);

  it('lists the BFCM collection on the Meta copy its copywriting_id points at, linking to its panel', () => {
    expect(bfcm.copywritingId).not.toBeNull();
    expect(byCopy.get(bfcm.copywritingId ?? '')).toEqual([
      {
        id: bfcm.id,
        label: 'BFCM 2026 Collection',
        href: `${collectionsPath}?collection=${bfcm.id}`,
      },
    ]);
  });

  it('gives a copy no collection points at no entry, so the panel renders the em dash', () => {
    expect(summer.copywritingId).toBeNull();
    const listed = [...byCopy.values()].flat().map((record) => record.id);
    expect(listed).not.toContain(summer.id);
    expect(byCopy.has('88888888-8888-4888-8888-000000000099')).toBe(false);
  });

  it('keeps the order the collections arrived in when two point at the same copy', () => {
    const copyId = bfcm.copywritingId ?? '';
    const twice = collectionsByCopy([
      { id: summer.id, name: summer.name, copywritingId: copyId },
      { id: bfcm.id, name: bfcm.name, copywritingId: copyId },
    ]);

    expect(twice.get(copyId)?.map((record) => record.id)).toEqual([summer.id, bfcm.id]);
  });
});

describe('matchesQuery over the lookup cells (GRATSI-MATCH, 2026-10-04)', () => {
  it('finds a row by its resolved angle, product or campaign code', () => {
    const row = item({
      angleName: 'Your Body Clock Is Not Broken',
      productName: 'Reset Bundle',
      campaignCodes: 'BFCM26',
    });

    expect(matchesQuery(row, 'body clock')).toBe(true);
    expect(matchesQuery(row, 'reset bundle')).toBe(true);
    expect(matchesQuery(row, 'bfcm26')).toBe(true);
    expect(matchesQuery(row, 'no such thing anywhere')).toBe(false);
  });

  it('a null lookup cell matches nothing rather than throwing', () => {
    expect(matchesQuery(item(), 'bfcm26')).toBe(false);
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
