import { describe, expect, it } from 'vitest';

import {
  countLabel,
  CREATIVE_REPORT_FIELD_GROUPS,
  CREATIVE_REPORT_FIELDS,
  ctrToPercentText,
  differenceCpaView,
  formatCtr,
  formatCurrency,
  formatNumber,
  formatRate,
  formatRoas,
  hostLabel,
  matchesCreativeReportSearch,
  percentTextToCtr,
  urlListText,
} from './fields';

describe('CREATIVE_REPORT_FIELDS', () => {
  it('is every stored column of the Airtable table plus the brief link, in panel order', () => {
    expect(CREATIVE_REPORT_FIELDS.map((field) => field.name)).toEqual([
      'nameAngleOffer',
      'briefId',
      'notes',
      'adDesign',
      'adLink',
      'ctr',
      'thumbStopRate',
      'results',
      'cpa',
      'targetCpa',
      'roas',
      'targetRoas',
    ]);
  });

  it('requires only the name', () => {
    expect(CREATIVE_REPORT_FIELDS.filter((field) => field.required).map((f) => f.name)).toEqual([
      'nameAngleOffer',
    ]);
  });

  it('gives every metric a number input at its column scale', () => {
    const numbers = CREATIVE_REPORT_FIELDS.filter((field) => field.kind === 'number');
    expect(Object.fromEntries(numbers.map((field) => [field.name, field.scale]))).toEqual({
      ctr: 2,
      thumbStopRate: 2,
      results: 1,
      cpa: 2,
      targetCpa: 2,
      roas: 2,
      targetRoas: 1,
    });
  });

  it('groups the panel as the base groups the sheet', () => {
    expect(CREATIVE_REPORT_FIELD_GROUPS.map((group) => group.heading)).toEqual([
      'Report',
      'Ad',
      'Engagement',
      'Cost & return',
    ]);
  });
});

describe('CTR percent ↔ fraction', () => {
  it('shows the stored fraction as the percent a buyer types', () => {
    expect(ctrToPercentText('0.0412')).toBe('4.12');
    expect(ctrToPercentText('0.1')).toBe('10');
    expect(ctrToPercentText(null)).toBe('');
  });

  it('stores a typed percent as the fraction at scale 4', () => {
    expect(percentTextToCtr('4.12')).toBe('0.0412');
    expect(percentTextToCtr(' 10 ')).toBe('0.1000');
    expect(percentTextToCtr('')).toBeNull();
    expect(percentTextToCtr('abc')).toBeNull();
  });

  it('round-trips', () => {
    expect(ctrToPercentText(percentTextToCtr('4.12'))).toBe('4.12');
  });
});

describe('metric formatting', () => {
  it('formats a numeric column at a fixed number of decimals and dashes a null', () => {
    expect(formatNumber('184.0', 0)).toBe('184');
    expect(formatNumber('3.4', 2)).toBe('3.40');
    expect(formatNumber(null, 2)).toBe('—');
  });

  it('reads CTR as a percent, thumb-stop as a rate, CPA as currency and ROAS as a multiple', () => {
    expect(formatCtr('0.0412')).toBe('4.12%');
    expect(formatRate('31.5')).toBe('31.50%');
    expect(formatCurrency('24.5')).toBe('$24.50');
    expect(formatRoas('3.4')).toBe('3.40x');
    expect(formatRoas('3.0', 1)).toBe('3.0x');
  });

  it('dashes every unset metric', () => {
    expect([formatCtr(null), formatRate(null), formatCurrency(null), formatRoas(null)]).toEqual([
      '—',
      '—',
      '—',
      '—',
    ]);
  });

  it('returns an unreadable stored value untouched instead of hiding it', () => {
    expect(formatCtr('n/a')).toBe('n/a');
    expect(formatNumber('n/a', 2)).toBe('n/a');
  });
});

describe('differenceCpaView', () => {
  it('is ok at or under target and bad over it, with the sign in the label', () => {
    expect(differenceCpaView(-2.2)).toEqual({ label: '−$2.20', tone: 'ok' });
    expect(differenceCpaView(0)).toEqual({ label: '$0.00', tone: 'ok' });
    expect(differenceCpaView(2.5)).toEqual({ label: '+$2.50', tone: 'bad' });
  });

  it('is null while the formula has no value', () => {
    expect(differenceCpaView(null)).toBeNull();
  });
});

describe('hostLabel', () => {
  it('shortens a link to its host and drops www', () => {
    expect(hostLabel('https://www.facebook.com/ads/library/?id=1')).toBe('facebook.com');
  });

  it('returns null for an absent or blank link, and an unparseable value untouched', () => {
    expect(hostLabel(null)).toBeNull();
    expect(hostLabel('   ')).toBeNull();
    expect(hostLabel('facebook.com')).toBe('facebook.com');
  });
});

describe('urlListText', () => {
  it('shows one URL per line and an empty textarea for null', () => {
    expect(urlListText(['https://a.example/1', 'https://a.example/2'])).toBe(
      'https://a.example/1\nhttps://a.example/2',
    );
    expect(urlListText(null)).toBe('');
  });
});

describe('countLabel', () => {
  it('pluralises and reports a filtered count', () => {
    expect(countLabel(1, 1)).toBe('1 report');
    expect(countLabel(4, 4)).toBe('4 reports');
    expect(countLabel(4, 2)).toBe('2 of 4 reports');
  });
});

describe('matchesCreativeReportSearch', () => {
  const row = {
    nameAngleOffer: 'Body Clock V1 — Shift Worker — 90-Night Trial',
    briefName: 'TAS-TV3-B1-Your Body Clock Is Not Broken-Problem/Solution-V1',
    notes: 'CPA came in under target from day four.',
    adLink: 'https://www.facebook.com/ads/library/?id=1',
  };

  it('matches the name, the brief name, the notes and the link', () => {
    expect(matchesCreativeReportSearch(row, 'shift worker')).toBe(true);
    expect(matchesCreativeReportSearch(row, 'tv3-b1')).toBe(true);
    expect(matchesCreativeReportSearch(row, 'day four')).toBe(true);
    expect(matchesCreativeReportSearch(row, 'facebook')).toBe(true);
  });

  it('ignores a term found nowhere, and copes with every optional field unset', () => {
    expect(matchesCreativeReportSearch(row, 'klaviyo')).toBe(false);
    expect(
      matchesCreativeReportSearch(
        { nameAngleOffer: 'Bare', briefName: null, notes: null, adLink: null },
        'bare',
      ),
    ).toBe(true);
  });
});
