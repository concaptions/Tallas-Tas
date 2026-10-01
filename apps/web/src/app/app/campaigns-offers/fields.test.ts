import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_FIELD_GROUPS,
  countLabel,
  emailCampaignHref,
  emailCampaignLink,
  emailFlowHref,
  emailFlowLink,
  formatDate,
  indexByCampaign,
  matchesCampaignSearch,
  youtubeCopyHref,
  youtubeCopyLink,
  youtubeCopyLinkLabel,
  type LinkedRecord,
} from './fields';

const BFCM = 'dddddddd-dddd-4ddd-8ddd-000000000001';
const VDAY = 'dddddddd-dddd-4ddd-8ddd-000000000002';
const SUMMER = 'dddddddd-dddd-4ddd-8ddd-000000000003';

describe('CAMPAIGN_FIELD_GROUPS', () => {
  /** The group the panel renders the free-text columns in; it must exist for the next asserts. */
  function campaignDetails() {
    const group = CAMPAIGN_FIELD_GROUPS.find((g) => g.heading === 'Campaign Details');
    if (group === undefined) throw new Error('the Campaign Details group is missing');
    return group;
  }

  it('places Promotional Ideas directly after Description, both as textareas', () => {
    const names = campaignDetails().fields.map((field) => field.name);
    const description = names.indexOf('description');

    expect(description).toBeGreaterThanOrEqual(0);
    expect(names[description + 1]).toBe('promotionalIdeas');
    expect(campaignDetails().fields[description]?.type).toBe('textarea');
    expect(campaignDetails().fields[description + 1]?.type).toBe('textarea');
  });

  it('labels the field with the exact Airtable name, which the E2E spec matches verbatim', () => {
    const field = campaignDetails().fields.find((f) => f.name === 'promotionalIdeas');

    expect(field).toMatchObject({ label: 'Promotional Ideas', required: false });
  });

  it('declares each field name once across every group', () => {
    const names = CAMPAIGN_FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.name));

    expect(new Set(names).size).toBe(names.length);
  });
});

describe('countLabel', () => {
  it('is singular at one and plural otherwise', () => {
    expect(countLabel(1, 1)).toBe('1 campaign');
    expect(countLabel(3, 3)).toBe('3 campaigns');
  });

  it('says how many of the total are visible while a search narrows the grid', () => {
    expect(countLabel(3, 1)).toBe('1 of 3 campaigns');
  });
});

describe('matchesCampaignSearch', () => {
  const campaign = { name: 'BFCM-20%OFF-BFCM26', holiday: 'BFCM', code: 'BFCM26', country: null };

  it('matches the generated name, the holiday and the code, case-insensitively', () => {
    expect(matchesCampaignSearch(campaign, 'bfcm26')).toBe(true);
    expect(matchesCampaignSearch(campaign, '20%off')).toBe(true);
  });

  it('treats a null column as empty rather than matching everything', () => {
    expect(matchesCampaignSearch(campaign, 'us')).toBe(false);
  });
});

describe('formatDate', () => {
  it('renders the em dash for an unset date', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('renders a calendar date in the short US form', () => {
    expect(formatDate('2026-11-27')).toBe('Nov 27, 2026');
  });
});

describe('the deep links into the sibling modules', () => {
  it('open the email campaign, the email flow and the YouTube copy on their own pages', () => {
    expect(emailCampaignHref('ee11')).toBe('/app/email-campaigns?emailCampaign=ee11');
    expect(emailFlowHref('ef10')).toBe('/app/email-flows?email-flow=ef10');
    expect(youtubeCopyHref('a1b2')).toBe('/app/youtube-copywriting?youtube-copy=a1b2');
  });

  it('encode an id so a stray character cannot add a second parameter', () => {
    expect(emailCampaignHref('a&b')).toBe('/app/email-campaigns?emailCampaign=a%26b');
  });
});

describe('youtubeCopyLinkLabel', () => {
  it('joins the generated title and the headline with a middle dot', () => {
    expect(youtubeCopyLinkLabel(3, 'Two Sleepers. One Bed. Zero Arguments.')).toBe(
      'Copy 3 · Two Sleepers. One Bed. Zero Arguments.',
    );
  });

  it('is the title alone when the copy has no headline yet', () => {
    expect(youtubeCopyLinkLabel(2, null)).toBe('Copy 2');
    expect(youtubeCopyLinkLabel(2, '   ')).toBe('Copy 2');
  });

  it('never throws on a number that is not a copy number', () => {
    expect(youtubeCopyLinkLabel(0, 'Headline')).toBe('Copy ? · Headline');
  });
});

describe('the link builders', () => {
  it('name an email campaign and point at its panel, with no status chip', () => {
    expect(emailCampaignLink({ id: 'ee11', name: 'BFCM Early Access — VIP list' })).toEqual({
      id: 'ee11',
      label: 'BFCM Early Access — VIP list',
      href: '/app/email-campaigns?emailCampaign=ee11',
    });
  });

  it('name an email flow by its flow name', () => {
    expect(emailFlowLink({ id: 'ef10', flowName: 'Abandoned Cart Recovery' })).toEqual({
      id: 'ef10',
      label: 'Abandoned Cart Recovery',
      href: '/app/email-flows?email-flow=ef10',
    });
  });

  it('label a YouTube copy with its title and headline and tone its status from the domain', () => {
    expect(
      youtubeCopyLink({
        id: 'a1b2',
        copyNumber: 1,
        headline: 'Sleep Like Your Shift Never Happened',
        status: 'approved',
      }),
    ).toEqual({
      id: 'a1b2',
      label: 'Copy 1 · Sleep Like Your Shift Never Happened',
      href: '/app/youtube-copywriting?youtube-copy=a1b2',
      chip: { tone: 'ok', label: 'Approved' },
    });
  });

  it('renders a status this build does not know back as itself, muted', () => {
    expect(
      youtubeCopyLink({ id: 'x', copyNumber: 1, headline: null, status: 'brand_new_state' }).chip,
    ).toEqual({ tone: 'mute', label: 'brand_new_state' });
  });
});

describe('indexByCampaign', () => {
  interface Row {
    readonly id: string;
    readonly name: string;
    readonly campaignIds: readonly string[];
  }
  const toLink = (row: Row): LinkedRecord => ({ id: row.id, label: row.name });
  const rows: readonly Row[] = [
    { id: 'r1', name: 'First', campaignIds: [BFCM] },
    { id: 'r2', name: 'Second', campaignIds: [] },
    { id: 'r3', name: 'Third', campaignIds: [BFCM, VDAY] },
  ];

  it('inverts the rows into campaignId -> links, keeping row order', () => {
    const index = indexByCampaign(rows, (row) => row.campaignIds, toLink);
    expect(index[BFCM]?.map((link) => link.label)).toEqual(['First', 'Third']);
    expect(index[VDAY]?.map((link) => link.label)).toEqual(['Third']);
  });

  it('has no key for a campaign nothing links to, so the caller reads the empty state', () => {
    const index = indexByCampaign(rows, (row) => row.campaignIds, toLink);
    expect(index[SUMMER]).toBeUndefined();
    expect(Object.keys(index)).toEqual([BFCM, VDAY]);
  });

  it('yields one link when a row repeats a campaign id', () => {
    const index = indexByCampaign(
      [{ id: 'r4', name: 'Twice', campaignIds: [BFCM, BFCM] }],
      (row) => row.campaignIds,
      toLink,
    );
    expect(index[BFCM]).toHaveLength(1);
  });

  it('does not build a link for a row that links nowhere', () => {
    let built = 0;
    indexByCampaign(
      rows,
      (row) => row.campaignIds,
      (row) => {
        built += 1;
        return toLink(row);
      },
    );
    expect(built).toBe(2);
  });
});
