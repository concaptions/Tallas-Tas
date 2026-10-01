import { youtubeCopyCtas, youtubeCopyFunnels } from '@tas/db/schema';
import { COPY_STATUS, copyStatusLabel, copyStatusTone } from '@tas/domain/state';
import { describe, expect, it } from 'vitest';

import {
  booleanChip,
  campaignChipLabel,
  copyNumberLabel,
  countLabel,
  CTA_KEYS,
  CTA_OPTIONS,
  ctaLabel,
  DESCRIPTIONS_LIMIT_MESSAGE,
  DESCRIPTIONS_MAX,
  FUNNEL_KEYS,
  FUNNEL_OPTIONS,
  funnelLabel,
  kanbanColumnsFor,
  kanbanValueOf,
  matchesQuery,
  metaRatingLabel,
  NO_FUNNEL_LABEL,
  NONE_VALUE,
  selectOptionsFor,
  STATUS_OPTIONS,
  truncate,
  YOUTUBE_COPY_FIELDS,
  type YoutubeCopyItem,
} from './fields';

/** One row in the shape `page.tsx` builds, so the helpers are tested against what they receive. */
function item(overrides: Partial<YoutubeCopyItem> = {}): YoutubeCopyItem {
  const status = 'approved';
  return {
    id: 'a1b2c3d4-0012-4012-8012-000000000001',
    copyNumber: 1,
    title: 'Copy 1',
    status,
    statusLabel: copyStatusLabel(status),
    statusTone: copyStatusTone(status),
    angle: 'Your Body Clock Is Not Broken',
    descriptions: 'Weighted, breathable, 90-night trial.',
    headline: 'Sleep Like Your Shift Never Happened',
    newsFeed: 'Niagara Deep Sleep Weighted Blanket',
    cta: 'shop_now',
    ctaLabel: 'Shop Now',
    funnel: 'tof',
    funnelLabel: 'TOF',
    clientComment: null,
    used: true,
    winning: true,
    metaRating: 5,
    linkedCollections: [{ id: 'c1', name: 'BFCM 2026 Collection', url: null }],
    linkedProducts: [{ id: 'p1', name: 'Weighted Blanket', link: 'https://x.example' }],
    linkedCampaigns: [{ id: 'k1', name: 'BFCM-20%OFF-BFCM26', code: 'BFCM26', offer: '20%OFF' }],
    linkedCopyTypes: [{ id: 't1', name: 'Testimonial' }],
    updatedLabel: 'yesterday',
    updatedTitle: '2026-09-17 10:20',
    ...overrides,
  };
}

describe('copyNumberLabel', () => {
  it('renders the Airtable primary field, "Copy N", from the stored integer', () => {
    expect(copyNumberLabel(3)).toBe('Copy 3');
  });

  it('never goes blank: a missing or impossible number renders as Copy ?', () => {
    expect(copyNumberLabel(null)).toBe('Copy ?');
    expect(copyNumberLabel(undefined)).toBe('Copy ?');
    expect(copyNumberLabel(0)).toBe('Copy ?');
    expect(copyNumberLabel(1.5)).toBe('Copy ?');
  });
});

describe('the 90-character rule', () => {
  it('is 90, with the one message the panel and the action both show', () => {
    expect(DESCRIPTIONS_MAX).toBe(90);
    expect(DESCRIPTIONS_LIMIT_MESSAGE).toBe('Descriptions are limited to 90 characters');
  });

  it('is described on the Descriptions field, which is a textarea', () => {
    const field = YOUTUBE_COPY_FIELDS.find((candidate) => candidate.name === 'descriptions');
    expect(field?.kind).toBe('textarea');
    expect(field?.hint).toContain('90');
  });
});

describe('truncate', () => {
  it('returns a short text untouched', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('cuts a long text with an ellipsis inside the limit', () => {
    const cut = truncate('a'.repeat(100), 56);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(56);
  });

  it('does not leave a trailing space before the ellipsis', () => {
    expect(truncate('one two three', 8)).toBe('one two…');
  });
});

describe('the closed vocabularies', () => {
  it('offers every CTA the schema declares, in its order, labels shown and keys stored', () => {
    expect(CTA_OPTIONS.map((option) => option.value)).toEqual(
      youtubeCopyCtas.map((entry) => entry.key),
    );
    expect(CTA_OPTIONS.map((option) => option.label)).toEqual(
      youtubeCopyCtas.map((entry) => entry.label),
    );
    expect(CTA_KEYS).toEqual(youtubeCopyCtas.map((entry) => entry.key));
  });

  it('offers every funnel the schema declares, wider than the Meta copy vocabulary', () => {
    expect(FUNNEL_OPTIONS.map((option) => option.value)).toEqual(
      youtubeCopyFunnels.map((entry) => entry.key),
    );
    expect(FUNNEL_OPTIONS.map((option) => option.label)).toContain('MOF & BOF');
    expect(FUNNEL_KEYS).toEqual(youtubeCopyFunnels.map((entry) => entry.key));
  });

  it('offers every copy status the domain declares, in its order', () => {
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual(
      COPY_STATUS.map((entry) => entry.key),
    );
  });

  it('labels a stored key, keeps an unknown one visible, and leaves null alone', () => {
    expect(ctaLabel('get_offer')).toBe('Get Offer');
    expect(ctaLabel('from_a_newer_build')).toBe('from_a_newer_build');
    expect(ctaLabel(null)).toBeNull();
    expect(funnelLabel('post_purchase')).toBe('POST PURCHASE');
    expect(funnelLabel(null)).toBeNull();
  });

  it('keeps the "none" sentinel out of every key it could collide with', () => {
    expect(CTA_KEYS).not.toContain(NONE_VALUE);
    expect(FUNNEL_KEYS).not.toContain(NONE_VALUE);
    expect(COPY_STATUS.map((entry) => entry.key)).not.toContain(NONE_VALUE);
  });

  it('gives the CTA and funnel selects a none row and the status select none', () => {
    expect(selectOptionsFor('cta').noneLabel).toBe('No CTA');
    expect(selectOptionsFor('funnel').noneLabel).toBe(NO_FUNNEL_LABEL);
    expect(selectOptionsFor('status').noneLabel).toBeNull();
    expect(selectOptionsFor('status').options).toBe(STATUS_OPTIONS);
  });
});

describe('YOUTUBE_COPY_FIELDS', () => {
  it('covers every stored column but the generated copy number, once each', () => {
    const names = YOUTUBE_COPY_FIELDS.map((field) => field.name);
    expect([...names].sort()).toEqual(
      [
        'angle',
        'clientComment',
        'cta',
        'descriptions',
        'funnel',
        'headline',
        'metaRating',
        'newsFeed',
        'status',
        'used',
        'winning',
      ].sort(),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('puts the copy fields first and the client comment last', () => {
    expect(YOUTUBE_COPY_FIELDS[0].group).toBe('copy');
    expect(YOUTUBE_COPY_FIELDS.at(-1)?.name).toBe('clientComment');
  });
});

describe('the cell helpers', () => {
  it('renders a rating out of five and null when unrated', () => {
    expect(metaRatingLabel(4)).toBe('4 / 5');
    expect(metaRatingLabel(0)).toBe('0 / 5');
    expect(metaRatingLabel(null)).toBeNull();
  });

  it('renders a checkbox as an ok Yes chip or a muted No chip', () => {
    expect(booleanChip(true)).toEqual({ label: 'Yes', tone: 'ok' });
    expect(booleanChip(false)).toEqual({ label: 'No', tone: 'mute' });
  });

  it('labels a campaign chip by its Campaign Code, falling back to the generated name', () => {
    expect(campaignChipLabel({ name: 'BFCM-20%OFF-BFCM26', code: 'BFCM26' })).toBe('BFCM26');
    expect(campaignChipLabel({ name: 'Summer Sale', code: null })).toBe('Summer Sale');
  });
});

describe('countLabel', () => {
  it.each([
    [0, 0, '0 copy rows'],
    [1, 1, '1 copy row'],
    [4, 4, '4 copy rows'],
    [4, 1, '1 of 4 copy rows'],
  ])('counts %s total and %s visible as %s', (total, visible, label) => {
    expect(countLabel(total, visible)).toBe(label);
  });
});

describe('matchesQuery', () => {
  it('matches everything on an empty query', () => {
    expect(matchesQuery(item(), '')).toBe(true);
  });

  it('finds a row by its generated title, its headline and a phrase in its description', () => {
    expect(matchesQuery(item(), 'copy 1')).toBe(true);
    expect(matchesQuery(item(), 'shift never')).toBe(true);
    expect(matchesQuery(item(), '90-night')).toBe(true);
  });

  it('finds a row by its status, CTA and funnel labels', () => {
    expect(matchesQuery(item(), 'approved')).toBe(true);
    expect(matchesQuery(item(), 'shop now')).toBe(true);
    expect(matchesQuery(item(), 'tof')).toBe(true);
  });

  it('finds a row by a linked campaign code, collection, product or copy type', () => {
    expect(matchesQuery(item(), 'bfcm26')).toBe(true);
    expect(matchesQuery(item(), 'bfcm 2026')).toBe(true);
    expect(matchesQuery(item(), 'weighted blanket')).toBe(true);
    expect(matchesQuery(item(), 'testimonial')).toBe(true);
  });

  it('matches nothing it does not contain', () => {
    expect(matchesQuery(item(), 'carousel')).toBe(false);
  });
});

describe('the kanban groupings', () => {
  it('groups by status in PRD order, every column kept even when empty', () => {
    expect(kanbanColumnsFor('status').map((column) => column.value)).toEqual(
      COPY_STATUS.map((entry) => entry.key),
    );
  });

  it('groups by funnel in vocabulary order with a No funnel column last', () => {
    const columns = kanbanColumnsFor('funnel');
    expect(columns.slice(0, -1).map((column) => column.value)).toEqual(
      youtubeCopyFunnels.map((entry) => entry.key),
    );
    expect(columns[columns.length - 1]).toEqual({ value: '', label: NO_FUNNEL_LABEL });
  });

  it('places an item by its status or its funnel, with a null funnel in the empty column', () => {
    expect(kanbanValueOf(item(), 'status')).toBe('approved');
    expect(kanbanValueOf(item(), 'funnel')).toBe('tof');
    expect(kanbanValueOf(item({ funnel: null, funnelLabel: null }), 'funnel')).toBe('');
  });
});
