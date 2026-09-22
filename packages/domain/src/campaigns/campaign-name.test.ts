import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_NAME_PARTS,
  CAMPAIGN_NAME_SEPARATOR,
  campaignName,
  type CampaignNameInput,
} from './campaign-name';

describe('campaignName', () => {
  it('concatenates Holiday-DiscountOffer-Code, matching the Airtable formula exactly', () => {
    expect(campaignName({ holiday: 'BFCM', discountOffer: '20%OFF', code: 'BFCM26' })).toBe(
      'BFCM-20%OFF-BFCM26',
    );
  });

  it('produces real campaign names from sample Airtable rows', () => {
    expect(campaignName({ holiday: 'Valentine', discountOffer: '15%OFF', code: 'VDAY26' })).toBe(
      'Valentine-15%OFF-VDAY26',
    );

    expect(
      campaignName({ holiday: 'Summer Sale', discountOffer: 'Buy 2 Get 1 Free', code: 'SUM26' }),
    ).toBe('Summer Sale-Buy 2 Get 1 Free-SUM26');

    expect(campaignName({ holiday: 'Mothers Day', discountOffer: '25%OFF', code: 'MOM26' })).toBe(
      'Mothers Day-25%OFF-MOM26',
    );
  });

  it('matches Airtable CONCATENATE on empty segments: double-dash, not a collapsed name', () => {
    expect(campaignName({ holiday: 'BFCM', code: 'BFCM26' })).toBe('BFCM--BFCM26');
    expect(campaignName({ holiday: 'BFCM' })).toBe('BFCM--');
    expect(campaignName({ discountOffer: '20%OFF' })).toBe('-20%OFF-');
    expect(campaignName({ code: 'XMAS26' })).toBe('--XMAS26');
  });

  it('returns two dashes when all three segments are empty, just like Airtable', () => {
    expect(campaignName({})).toBe('--');
    expect(campaignName({ holiday: null, discountOffer: null, code: null })).toBe('--');
    expect(campaignName({ holiday: '', discountOffer: '', code: '' })).toBe('--');
    expect(campaignName({ holiday: '   ', discountOffer: '  ', code: ' ' })).toBe('--');
  });

  it('trims whitespace from each segment', () => {
    expect(campaignName({ holiday: ' BFCM ', discountOffer: ' 20%OFF ', code: ' BFCM26 ' })).toBe(
      'BFCM-20%OFF-BFCM26',
    );
  });

  it('uses exactly the three parts in the documented order', () => {
    expect(CAMPAIGN_NAME_PARTS).toEqual(['holiday', 'discountOffer', 'code']);
    expect(CAMPAIGN_NAME_SEPARATOR).toBe('-');
  });

  it('accepts the full CampaignNameInput interface shape', () => {
    const input: CampaignNameInput = {
      holiday: 'BFCM',
      discountOffer: '20%OFF',
      code: 'BFCM26',
    };
    expect(campaignName(input)).toBe('BFCM-20%OFF-BFCM26');
  });
});
