import { emailCampaignStatuses, emailCampaignTypes, emailChannels } from '@tas/db/schema';
import { describe, expect, it } from 'vitest';

import {
  CHANNEL_OPTIONS,
  channelView,
  countLabel,
  EMAIL_CAMPAIGN_FIELDS,
  EMAIL_CAMPAIGN_LINK_FIELDS,
  groupOptions,
  groupView,
  hostLabel,
  isGroupField,
  matchesEmailCampaignSearch,
  STATUS_OPTIONS,
  statusView,
  TYPE_OPTIONS,
  typeView,
  urlListText,
} from './fields';

describe('EMAIL_CAMPAIGN_FIELDS', () => {
  it('is every stored column of the Airtable table, in panel order', () => {
    expect(EMAIL_CAMPAIGN_FIELDS.map((field) => field.name)).toEqual([
      'name',
      'campaignPurpose',
      'status',
      'type',
      'channel',
      'sendDate',
      'assigneeId',
      'copywriting',
      'copyLink',
      'design',
      'klaviyoLink',
      'assets',
    ]);
  });

  it('requires only the name', () => {
    expect(EMAIL_CAMPAIGN_FIELDS.filter((field) => field.required).map((f) => f.name)).toEqual([
      'name',
    ]);
  });

  it('edits the three record links as pickers', () => {
    expect(EMAIL_CAMPAIGN_LINK_FIELDS.map((field) => field.name)).toEqual([
      'campaignOfferIds',
      'productIds',
      'collectionIds',
    ]);
  });
});

describe('select vocabularies', () => {
  it('renders every option of each @tas/db vocabulary, key stored and label shown, with a tone', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual(emailCampaignStatuses.map((s) => s.key));
    expect(STATUS_OPTIONS.map((o) => o.label)).toEqual(emailCampaignStatuses.map((s) => s.label));
    expect(TYPE_OPTIONS.map((o) => o.value)).toEqual(emailCampaignTypes.map((t) => t.key));
    expect(CHANNEL_OPTIONS.map((o) => o.value)).toEqual(emailChannels.map((c) => c.key));
    for (const option of [...STATUS_OPTIONS, ...TYPE_OPTIONS, ...CHANNEL_OPTIONS]) {
      expect(['ok', 'warn', 'bad', 'info', 'accent', 'mute']).toContain(option.tone);
    }
  });

  it('tones the workflow: client waits are info, edits are warn, approved and scheduled are ok', () => {
    expect(statusView('client_idea_pending_for_approval')).toMatchObject({ tone: 'info' });
    expect(statusView('client_edits_required')).toMatchObject({ tone: 'warn' });
    expect(statusView('client_approved')).toMatchObject({
      label: 'Client: Approved',
      tone: 'ok',
    });
    expect(statusView('scheduled')).toMatchObject({ tone: 'ok' });
    expect(statusView(null)).toBeNull();
  });

  it('labels a type and a channel from the vocabulary', () => {
    expect(typeView('blog_post_educational')).toMatchObject({ label: 'Blog Post/Educational' });
    expect(channelView('push_notification')).toMatchObject({
      label: 'Push Notification',
      tone: 'warn',
    });
    expect(typeView(null)).toBeNull();
    expect(channelView(null)).toBeNull();
  });
});

describe('kanban grouping', () => {
  it('accepts exactly the three capability fields', () => {
    expect(isGroupField('status')).toBe(true);
    expect(isGroupField('type')).toBe(true);
    expect(isGroupField('channel')).toBe(true);
    expect(isGroupField('sendDate')).toBe(false);
  });

  it('lists every column of a board in vocabulary order, empty ones included', () => {
    expect(groupOptions('status')).toHaveLength(11);
    expect(groupOptions('type')).toHaveLength(11);
    expect(groupOptions('channel').map((o) => o.label)).toEqual([
      'Email',
      'SMS',
      'Push Notification',
    ]);
  });

  it('places a row by the chosen field and returns null when it is unset', () => {
    const row = { status: 'copywriting', type: null, channel: 'sms' } as const;
    expect(groupView(row, 'status')).toMatchObject({ value: 'copywriting', label: 'Copywriting' });
    expect(groupView(row, 'type')).toBeNull();
    expect(groupView(row, 'channel')).toMatchObject({ value: 'sms', label: 'SMS' });
  });
});

describe('hostLabel', () => {
  it('shortens a link to its host and drops www', () => {
    expect(hostLabel('https://www.klaviyo.example/campaigns/bfcm')).toBe('klaviyo.example');
  });

  it('returns null for an absent or blank link, and an unparseable value untouched', () => {
    expect(hostLabel(null)).toBeNull();
    expect(hostLabel('   ')).toBeNull();
    expect(hostLabel('klaviyo.example')).toBe('klaviyo.example');
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
    expect(countLabel(1, 1)).toBe('1 email campaign');
    expect(countLabel(5, 5)).toBe('5 email campaigns');
    expect(countLabel(5, 2)).toBe('2 of 5 email campaigns');
  });
});

describe('matchesEmailCampaignSearch', () => {
  const row = {
    name: 'BFCM Early Access',
    campaignPurpose: 'VIP window',
    assigneeName: 'Rhiannon Okafor',
    status: 'template_design',
    type: 'sale_campaign',
    channel: 'email',
    campaignOfferNames: ['BFCM-20%OFF-BFCM26'],
    productNames: ['Niagara Deep Sleep Weighted Blanket'],
    collectionNames: [],
  } as unknown as Parameters<typeof matchesEmailCampaignSearch>[0];

  it('matches the name, the purpose, the assignee, a select label and a linked name', () => {
    expect(matchesEmailCampaignSearch(row, 'early')).toBe(true);
    expect(matchesEmailCampaignSearch(row, 'vip')).toBe(true);
    expect(matchesEmailCampaignSearch(row, 'okafor')).toBe(true);
    expect(matchesEmailCampaignSearch(row, 'template design')).toBe(true);
    expect(matchesEmailCampaignSearch(row, 'weighted')).toBe(true);
  });

  it('matches the label, never the stored key', () => {
    expect(matchesEmailCampaignSearch(row, 'sale campaign')).toBe(true);
    expect(matchesEmailCampaignSearch(row, 'sale_campaign')).toBe(false);
  });
});
