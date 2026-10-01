import type { EmailFlowListRow } from '@tas/db';
import { emailChannels, emailFlowStatuses } from '@tas/db/schema';
import { describe, expect, it } from 'vitest';

import {
  countLabel,
  EMAIL_FLOW_CSV_COLUMNS,
  EMAIL_FLOW_FIELD_GROUPS,
  EMAIL_FLOW_FIELDS,
  EMAIL_FLOW_STATUS_OPTIONS,
  EMAIL_FLOW_TYPE_OPTIONS,
  emailFlowItem,
  formatDate,
  hostLabel,
  isHttpUrl,
  isKanbanGroupField,
  kanbanColumnsFor,
  kanbanGroupOf,
  matchesSearch,
  parseUrlList,
  statusLabel,
  statusTone,
  typeLabel,
  typeTone,
  urlListText,
} from './fields';

/** A plain row, so this suite never imports `@tas/db` at runtime. */
function row(overrides: Partial<EmailFlowListRow> = {}): EmailFlowListRow {
  return {
    id: 'flow-1',
    brandId: 'brand-1',
    createdAt: new Date('2026-09-01T09:00:00.000Z'),
    updatedAt: new Date('2026-09-19T15:20:00.000Z'),
    createdBy: 'user_test',
    updatedBy: 'user_test',
    deletedAt: null,
    templateRowId: null,
    overriddenFields: [],
    customFields: {},
    legacyAirtableId: null,
    flowName: 'Abandoned Cart Recovery',
    expectedSetupDate: '2026-10-20',
    flowPurpose: 'Three-touch recovery.',
    status: 'template_design',
    copywriting: null,
    design: ['https://r2.example/a.png', 'https://r2.example/b.png'],
    klaviyoLink: 'https://www.klaviyo.com/flows/abandoned-cart',
    type: 'email',
    inspo: null,
    assigneeId: 'user_seed_designer',
    campaignIds: ['c-1'],
    campaignNames: ['BFCM-20%OFF-BFCM26'],
    assigneeName: 'Rhiannon Okafor',
    designDueDate: '2026-10-15',
    copywritingDueDate: '2026-10-10',
    ...overrides,
  };
}

describe('EMAIL_FLOW_FIELD_GROUPS', () => {
  it('covers the ten stored Airtable fields, in panel order, under four headings', () => {
    expect(EMAIL_FLOW_FIELD_GROUPS.map((group) => group.heading)).toEqual([
      'Flow',
      'Schedule',
      'Content',
      'Files',
    ]);
    expect(EMAIL_FLOW_FIELDS.map((field) => field.name)).toEqual([
      'flowName',
      'flowPurpose',
      'type',
      'status',
      'assigneeId',
      'expectedSetupDate',
      'copywriting',
      'klaviyoLink',
      'design',
      'inspo',
    ]);
  });

  it('requires only the flow name', () => {
    expect(EMAIL_FLOW_FIELDS.filter((field) => field.required).map((f) => f.name)).toEqual([
      'flowName',
    ]);
  });

  it('draws the two attachment fields as URL lists and the three selects by their kind', () => {
    const kinds = Object.fromEntries(EMAIL_FLOW_FIELDS.map((field) => [field.name, field.kind]));
    expect(kinds).toMatchObject({
      design: 'urlList',
      inspo: 'urlList',
      status: 'status',
      type: 'type',
      assigneeId: 'assignee',
      expectedSetupDate: 'date',
      klaviyoLink: 'url',
    });
  });

  it('offers a CSV template of writable snake_case columns, never the formulas or audit columns', () => {
    expect(EMAIL_FLOW_CSV_COLUMNS).toContain('flow_name');
    expect(EMAIL_FLOW_CSV_COLUMNS).toContain('campaigns');
    expect(EMAIL_FLOW_CSV_COLUMNS).not.toContain('design_due_date');
    expect(EMAIL_FLOW_CSV_COLUMNS).not.toContain('brand_id');
  });
});

describe('status and type presentation', () => {
  it('renders every vocabulary label and stores every key, in the base’s order', () => {
    expect(EMAIL_FLOW_STATUS_OPTIONS.map((option) => option.value)).toEqual(
      emailFlowStatuses.map((status) => status.key),
    );
    expect(EMAIL_FLOW_STATUS_OPTIONS.map((option) => option.label)).toEqual(
      emailFlowStatuses.map((status) => status.label),
    );
    expect(EMAIL_FLOW_TYPE_OPTIONS.map((option) => option.value)).toEqual(
      emailChannels.map((channel) => channel.key),
    );
  });

  it('labels a key with the base’s text and gives every key a tone', () => {
    expect(statusLabel('client_idea_pending_for_approval')).toBe(
      'Client: Idea Pending for Approval',
    );
    expect(statusLabel('live')).toBe('Live');
    expect(typeLabel('push_notification')).toBe('Push Notification');
    for (const option of EMAIL_FLOW_STATUS_OPTIONS) {
      expect(statusTone(option.value)).toBe(option.tone);
    }
    for (const option of EMAIL_FLOW_TYPE_OPTIONS) {
      expect(typeTone(option.value)).toBe(option.tone);
    }
  });

  it('warns only on edits required, approves the two approvals, accents live work', () => {
    expect(statusTone('client_edits_required')).toBe('warn');
    expect(statusTone('client_approved')).toBe('ok');
    expect(statusTone('ideas_approved')).toBe('ok');
    expect(statusTone('live')).toBe('accent');
    expect(statusTone('pending')).toBe('mute');
    expect(typeTone('email')).toBe('info');
  });
});

describe('kanban grouping', () => {
  it('accepts exactly the two capability fields', () => {
    expect(isKanbanGroupField('status')).toBe(true);
    expect(isKanbanGroupField('type')).toBe(true);
    expect(isKanbanGroupField('assigneeId')).toBe(false);
  });

  it('lays out the whole vocabulary as columns, empties kept', () => {
    expect(kanbanColumnsFor('status')).toHaveLength(emailFlowStatuses.length);
    expect(kanbanColumnsFor('type').map((column) => column.label)).toEqual([
      'Email',
      'SMS',
      'Push Notification',
    ]);
  });

  it('places a flow by the chosen field and returns null when it is unset', () => {
    expect(kanbanGroupOf(row(), 'status')).toEqual({
      value: 'template_design',
      label: 'Template Design',
      tone: 'accent',
    });
    expect(kanbanGroupOf(row(), 'type')).toMatchObject({ value: 'email', label: 'Email' });
    expect(kanbanGroupOf(row({ status: null }), 'status')).toBeNull();
  });
});

describe('formatDate', () => {
  it('reads a calendar date in UTC so the day never shifts', () => {
    expect(formatDate('2026-10-20')).toBe('Oct 20, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('renders the dash for null and leaves an unparseable value visible', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('next week')).toBe('next week');
  });
});

describe('hostLabel and isHttpUrl', () => {
  it('shortens the Klaviyo link to its host without www', () => {
    expect(hostLabel('https://www.klaviyo.com/flows/abandoned-cart')).toBe('klaviyo.com');
  });

  it('is null for nothing and untouched for a value that is not a URL', () => {
    expect(hostLabel(null)).toBeNull();
    expect(hostLabel('  ')).toBeNull();
    expect(hostLabel('klaviyo')).toBe('klaviyo');
  });

  it('accepts http and https only', () => {
    expect(isHttpUrl('https://r2.example/a.png')).toBe(true);
    expect(isHttpUrl('ftp://r2.example/a.png')).toBe(false);
    expect(isHttpUrl('a.png')).toBe(false);
  });
});

describe('url lists', () => {
  it('round-trips an attachment column through one-URL-per-line text', () => {
    const list = ['https://r2.example/a.png', 'https://r2.example/b.png'];
    expect(urlListText(list)).toBe('https://r2.example/a.png\nhttps://r2.example/b.png');
    expect(parseUrlList(urlListText(list))).toEqual(list);
  });

  it('shows null as empty text and drops blank or padded lines on the way back', () => {
    expect(urlListText(null)).toBe('');
    expect(parseUrlList('')).toEqual([]);
    expect(parseUrlList('  https://r2.example/a.png  \r\n\n\nhttps://r2.example/b.png\n')).toEqual([
      'https://r2.example/a.png',
      'https://r2.example/b.png',
    ]);
  });
});

describe('emailFlowItem', () => {
  it('formats every derived string once, on the server', () => {
    const item = emailFlowItem(row(), new Date('2026-09-20T15:20:00.000Z'));
    expect(item).toMatchObject({
      setupLabel: 'Oct 20, 2026',
      designDueLabel: 'Oct 15, 2026',
      copywritingDueLabel: 'Oct 10, 2026',
      klaviyoHost: 'klaviyo.com',
      updatedLabel: 'yesterday',
      updatedTitle: '2026-09-19 15:20',
    });
  });

  it('dashes the due dates and nulls the host when the flow has no setup date or link', () => {
    const item = emailFlowItem(
      row({
        expectedSetupDate: null,
        designDueDate: null,
        copywritingDueDate: null,
        klaviyoLink: null,
      }),
      new Date('2026-09-20T15:20:00.000Z'),
    );
    expect(item.designDueLabel).toBe('—');
    expect(item.copywritingDueLabel).toBe('—');
    expect(item.klaviyoHost).toBeNull();
  });
});

describe('matchesSearch', () => {
  const item = emailFlowItem(row(), new Date('2026-09-20T15:20:00.000Z'));

  it('matches on the name, the status label, the type label, the assignee and a campaign', () => {
    expect(matchesSearch(item, 'abandoned')).toBe(true);
    expect(matchesSearch(item, 'template design')).toBe(true);
    expect(matchesSearch(item, 'email')).toBe(true);
    expect(matchesSearch(item, 'rhiannon')).toBe(true);
    expect(matchesSearch(item, 'bfcm26')).toBe(true);
  });

  it('misses what the grid does not show', () => {
    expect(matchesSearch(item, 'user_seed_designer')).toBe(false);
    expect(matchesSearch(item, 'nothing matches this')).toBe(false);
  });
});

describe('countLabel', () => {
  it('counts the library, singular at one, and narrows under a filter', () => {
    expect(countLabel(1, 1)).toBe('1 flow');
    expect(countLabel(4, 4)).toBe('4 flows');
    expect(countLabel(4, 2)).toBe('2 of 4 flows');
  });
});
