import { describe, expect, it } from 'vitest';

import {
  campaignOfferName,
  creativeSheetName,
  creatorCostWithFee,
  creatorNotifyFlag,
  differenceCpa,
  emailCampaignCopywritingDueDate,
  emailCampaignDesignDueDate,
  emailFlowCopywritingDueDate,
  emailFlowDesignDueDate,
  smReminderTrigger,
} from './index';

const utc = (iso: string): Date => new Date(iso);

describe('email due dates (DATEADD chains)', () => {
  it('puts design five days before the send date and copywriting ten, because the formulas chain', () => {
    const send = utc('2026-11-20T00:00:00.000Z');
    expect(emailCampaignDesignDueDate(send)?.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    // The Airtable formula is DATEADD({Design Due Date}, -5) and Design is itself Send - 5, so this
    // is Send - 10. Reading each offset in isolation is wrong by five days.
    expect(emailCampaignCopywritingDueDate(send)?.toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('applies the same chain to flows, from the expected setup date', () => {
    const setup = utc('2026-12-01T09:30:00.000Z');
    expect(emailFlowDesignDueDate(setup)?.toISOString()).toBe('2026-11-26T09:30:00.000Z');
    expect(emailFlowCopywritingDueDate(setup)?.toISOString()).toBe('2026-11-21T09:30:00.000Z');
  });

  it('crosses a month and a year boundary in UTC rather than local time', () => {
    expect(emailCampaignDesignDueDate(utc('2027-01-03T23:00:00.000Z'))?.toISOString()).toBe(
      '2026-12-29T23:00:00.000Z',
    );
  });

  it('derives nothing from an unset or invalid date', () => {
    expect(emailCampaignDesignDueDate(null)).toBeNull();
    expect(emailCampaignCopywritingDueDate(undefined)).toBeNull();
    expect(emailFlowDesignDueDate(new Date('not a date'))).toBeNull();
  });
});

describe('clock-dependent formulas take the clock as a parameter', () => {
  it('flips the SM reminder twelve hours before the due date, not at it', () => {
    const due = utc('2026-10-10T12:00:00.000Z');
    expect(smReminderTrigger(due, utc('2026-10-09T23:59:00.000Z'))).toBe('No');
    expect(smReminderTrigger(due, utc('2026-10-10T00:01:00.000Z'))).toBe('Yes');
    expect(smReminderTrigger(due, utc('2026-10-11T00:00:00.000Z'))).toBe('Yes');
  });

  it('reads No for a task with no due date rather than throwing', () => {
    expect(smReminderTrigger(null, utc('2026-10-10T00:00:00.000Z'))).toBe('No');
  });

  it('raises the creator notify flag on the twenty-fifth day and not the twenty-fourth', () => {
    const activated = utc('2026-09-01T00:00:00.000Z');
    expect(creatorNotifyFlag(activated, utc('2026-09-25T00:00:00.000Z'))).toBeNull();
    expect(creatorNotifyFlag(activated, utc('2026-09-26T00:00:00.000Z'))).toBe('YES');
    // Airtable's IF has no false branch, so a partnership that never activated reads blank.
    expect(creatorNotifyFlag(null, utc('2026-12-31T00:00:00.000Z'))).toBeNull();
  });
});

describe("UGC Creator's cost (USD)", () => {
  it('charges 5.5% on Fiverr and 10% on Insense, not the flat 5% the field description claims', () => {
    expect(creatorCostWithFee(100, 'Fiverr')).toBe(105.5);
    expect(creatorCostWithFee(100, 'Insense')).toBe(110);
    expect(creatorCostWithFee(100, 'Direct Management')).toBe(100);
  });

  it('reads the platform out of the jsonb array this schema stores, case-insensitively', () => {
    expect(creatorCostWithFee(200, ['fiverr'])).toBe(211);
    expect(creatorCostWithFee(200, ['Direct Management', 'Insense'])).toBe(220);
    expect(creatorCostWithFee(200, [])).toBe(200);
  });

  it('rounds to the cent instead of trailing float noise', () => {
    expect(creatorCostWithFee(95, 'Fiverr')).toBe(100.23);
  });

  it('has no cost to report when the internal cost is unset', () => {
    expect(creatorCostWithFee(null, 'Fiverr')).toBeNull();
    expect(creatorCostWithFee(undefined, null)).toBeNull();
  });
});

describe('Difference CPA', () => {
  it('subtracts the target from the actual, and goes negative when under target', () => {
    expect(differenceCpa(42.5, 30)).toBe(12.5);
    expect(differenceCpa(18, 30)).toBe(-12);
  });

  it('is unknowable rather than zero when either side is missing', () => {
    expect(differenceCpa(null, 30)).toBeNull();
    expect(differenceCpa(42, null)).toBeNull();
  });
});

describe('name formulas', () => {
  it('concatenates the campaign name exactly as Airtable does, separators and gaps included', () => {
    expect(campaignOfferName('BFCM', '20% OFF', 'BF26')).toBe('BFCM-20% OFF-BF26');
    // Parity, deliberately: a missing component leaves its separator, as the base shows it.
    expect(campaignOfferName('BFCM', null, 'BF26')).toBe('BFCM--BF26');
    expect(campaignOfferName(null, null, null)).toBe('--');
  });

  it('builds the creative sheet name from the created month and the linked creative', () => {
    expect(creativeSheetName(utc('2026-10-02T11:00:00.000Z'), 'VID001-B1-Body Clock')).toBe(
      'October-VID001-B1-Body Clock',
    );
    expect(creativeSheetName(utc('2026-01-31T23:30:00.000Z'), 'STA002')).toBe('January-STA002');
  });

  it('has no name without a created timestamp', () => {
    expect(creativeSheetName(null, 'VID001')).toBeNull();
  });
});
