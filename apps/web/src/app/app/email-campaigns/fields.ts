import type { EmailCampaignListRow } from '@tas/db';
import {
  emailCampaignStatuses,
  emailCampaignTypes,
  emailChannels,
  type EmailCampaignStatusesKey,
  type EmailCampaignTypesKey,
  type EmailChannelsKey,
} from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';

import type { EmailCampaignFieldName, EmailCampaignLinkName } from './actions';

/**
 * The Email Campaigns vocabulary (Airtable "Email Campaigns Management", audit §2.10): the twelve
 * stored columns and the three record links the panel edits, grouped as the base groups them, plus
 * the presentation rules the grid, the Kanban board, the panel and the Server Actions all read. One
 * module, so a label, a chip tone or the dash an unset value renders as cannot drift between them.
 *
 * Select values come from the `@tas/db/schema` vocabularies (`emailCampaignStatuses`,
 * `emailCampaignTypes`, `emailChannels`): the KEY is stored, the LABEL is rendered, never a string
 * literal. The two formula fields of the base (design due, copywriting due) are not here: the query
 * layer computes them and the panel shows them read-only.
 */
export type { EmailCampaignFieldName, EmailCampaignLinkName };

export type EmailCampaignFieldKind =
  | 'text'
  | 'url'
  | 'date'
  | 'textarea'
  /** One `https://` URL per line; stored as a string array, the shape every attachment column uses. */
  | 'urlList'
  | 'status'
  | 'type'
  | 'channel'
  | 'assignee';

export interface EmailCampaignField {
  readonly name: EmailCampaignFieldName;
  readonly label: string;
  readonly placeholder: string;
  readonly required: boolean;
  readonly kind: EmailCampaignFieldKind;
}

export interface EmailCampaignFieldGroup {
  readonly heading: string;
  readonly fields: readonly EmailCampaignField[];
}

/** The panel renders exactly these groups, in this order. */
export const EMAIL_CAMPAIGN_FIELD_GROUPS: readonly EmailCampaignFieldGroup[] = [
  {
    heading: 'Campaign',
    fields: [
      {
        name: 'name',
        label: 'Name',
        placeholder: 'BFCM Early Access',
        required: true,
        kind: 'text',
      },
      {
        name: 'campaignPurpose',
        label: 'Campaign Purpose',
        placeholder: 'What this send is for and who it goes to',
        required: false,
        kind: 'textarea',
      },
      { name: 'status', label: 'Status', placeholder: '', required: false, kind: 'status' },
      { name: 'type', label: 'Type', placeholder: '', required: false, kind: 'type' },
      { name: 'channel', label: 'Channel', placeholder: '', required: false, kind: 'channel' },
      {
        name: 'sendDate',
        label: 'Send Date',
        placeholder: '2026-11-20',
        required: false,
        kind: 'date',
      },
      { name: 'assigneeId', label: 'Assignee', placeholder: '', required: false, kind: 'assignee' },
    ],
  },
  {
    heading: 'Copy',
    fields: [
      {
        name: 'copywriting',
        label: 'Copywriting',
        placeholder: 'Subject line, preview text and body',
        required: false,
        kind: 'textarea',
      },
      {
        name: 'copyLink',
        label: 'Copy Link',
        placeholder: 'https://docs.example/d/…',
        required: false,
        kind: 'url',
      },
    ],
  },
  {
    heading: 'Design & assets',
    fields: [
      {
        name: 'design',
        label: 'Design',
        placeholder: 'One file URL per line',
        required: false,
        kind: 'urlList',
      },
      {
        name: 'klaviyoLink',
        label: 'Klaviyo Link',
        placeholder: 'https://klaviyo.example/campaigns/…',
        required: false,
        kind: 'url',
      },
      {
        name: 'assets',
        label: 'Assets',
        placeholder: 'One file URL per line',
        required: false,
        kind: 'urlList',
      },
    ],
  },
];

/** Every stored field, flattened; the Server Actions read the form by this list. */
export const EMAIL_CAMPAIGN_FIELDS: readonly EmailCampaignField[] =
  EMAIL_CAMPAIGN_FIELD_GROUPS.flatMap((group) => group.fields);

export interface EmailCampaignLinkField {
  readonly name: EmailCampaignLinkName;
  readonly label: string;
  readonly empty: string;
}

/** The three multipleRecordLinks of the base, edited as chip pickers and posted as repeated inputs. */
export const EMAIL_CAMPAIGN_LINK_FIELDS: readonly EmailCampaignLinkField[] = [
  {
    name: 'campaignOfferIds',
    label: 'Campaigns & Offers',
    empty: 'No campaigns or offers in this brand yet.',
  },
  { name: 'productIds', label: 'Products', empty: 'No products in this brand yet.' },
  { name: 'collectionIds', label: 'Collections', empty: 'No collections in this brand yet.' },
];

/** One option of a select vocabulary as the chip and the Select render it. */
export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly tone: ChipTone;
}

/** The eleven-step email workflow: client-facing waits in `info`, team work in `accent`, done in `ok`. */
const STATUS_TONES: Record<EmailCampaignStatusesKey, ChipTone> = {
  client_idea_pending_for_approval: 'info',
  ideas_approved: 'ok',
  copywriting: 'accent',
  copywriting_finished: 'accent',
  template_design: 'accent',
  design_submitted: 'info',
  client_design_pending_for_approval: 'info',
  client_edits_required: 'warn',
  revisions_submitted: 'mute',
  client_approved: 'ok',
  scheduled: 'ok',
};

const TYPE_TONES: Record<EmailCampaignTypesKey, ChipTone> = {
  plain_text_email: 'mute',
  product_promotion_campaign: 'info',
  collection_promotion_campaign: 'info',
  multi_product_promotion: 'info',
  sale_campaign: 'accent',
  seasonal_campaign: 'accent',
  brand_builder: 'mute',
  blog_post_educational: 'mute',
  flash_sale: 'warn',
  subscription_based: 'info',
  hype: 'accent',
};

const CHANNEL_TONES: Record<EmailChannelsKey, ChipTone> = {
  email: 'info',
  sms: 'accent',
  push_notification: 'warn',
};

export const STATUS_OPTIONS: readonly ChoiceOption[] = emailCampaignStatuses.map(
  ({ key, label }) => ({ value: key, label, tone: STATUS_TONES[key] }),
);

export const TYPE_OPTIONS: readonly ChoiceOption[] = emailCampaignTypes.map(({ key, label }) => ({
  value: key,
  label,
  tone: TYPE_TONES[key],
}));

export const CHANNEL_OPTIONS: readonly ChoiceOption[] = emailChannels.map(({ key, label }) => ({
  value: key,
  label,
  tone: CHANNEL_TONES[key],
}));

export function statusView(key: EmailCampaignStatusesKey | null): ChoiceOption | null {
  return key === null
    ? null
    : { value: key, label: labelOf(emailCampaignStatuses, key), tone: STATUS_TONES[key] };
}

export function typeView(key: EmailCampaignTypesKey | null): ChoiceOption | null {
  return key === null
    ? null
    : { value: key, label: labelOf(emailCampaignTypes, key), tone: TYPE_TONES[key] };
}

export function channelView(key: EmailChannelsKey | null): ChoiceOption | null {
  return key === null
    ? null
    : { value: key, label: labelOf(emailChannels, key), tone: CHANNEL_TONES[key] };
}

function labelOf<K extends string>(
  vocabulary: readonly { key: K; label: string }[],
  key: K,
): string {
  return vocabulary.find((entry) => entry.key === key)?.label ?? key;
}

/** The three fields the Kanban board can group by (`table-views.ts`, tableKey `email-campaigns`). */
export type EmailCampaignGroupField = 'status' | 'type' | 'channel';

export const GROUP_FIELDS: readonly EmailCampaignGroupField[] = ['status', 'type', 'channel'];

export function isGroupField(value: string): value is EmailCampaignGroupField {
  return (GROUP_FIELDS as readonly string[]).includes(value);
}

/** Every column of a board grouped by `field`, in vocabulary order, empty columns included. */
export function groupOptions(field: EmailCampaignGroupField): readonly ChoiceOption[] {
  switch (field) {
    case 'status':
      return STATUS_OPTIONS;
    case 'type':
      return TYPE_OPTIONS;
    case 'channel':
      return CHANNEL_OPTIONS;
  }
}

/** Where one row sits on a board grouped by `field`, or null when the value is unset. */
export function groupView(
  row: Pick<EmailCampaignListRow, 'status' | 'type' | 'channel'>,
  field: EmailCampaignGroupField,
): ChoiceOption | null {
  switch (field) {
    case 'status':
      return statusView(row.status);
    case 'type':
      return typeView(row.type);
    case 'channel':
      return channelView(row.channel);
  }
}

/** The Kanban column for rows with no value: its `groupValue` and its header. */
export const UNSET_GROUP_VALUE = '';
export const UNSET_GROUP_LABEL = 'Not set';

/** The dash a null cell shows, so an unset value is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** The host of a link, for a grid cell; the full URL goes in the cell's `title`. */
export function hostLabel(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

/** A stored URL list as the textarea shows it: one URL per line. */
export function urlListText(list: readonly string[] | null): string {
  return list === null ? '' : list.join('\n');
}

export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'email campaign' : 'email campaigns';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

/** The search reads what the grid shows: name, purpose, assignee, the three select labels and links. */
export function matchesEmailCampaignSearch(row: EmailCampaignListRow, query: string): boolean {
  return [
    row.name,
    row.campaignPurpose ?? '',
    row.assigneeName ?? '',
    statusView(row.status)?.label ?? '',
    typeView(row.type)?.label ?? '',
    channelView(row.channel)?.label ?? '',
    ...row.campaignOfferNames,
    ...row.productNames,
    ...row.collectionNames,
  ].some((value) => value.toLowerCase().includes(query));
}

/** One grid row: the record plus the strings the server computes once, so the client never formats. */
export interface EmailCampaignItem {
  readonly row: EmailCampaignListRow;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
  /** The Copy and Klaviyo link hosts, or null when unset; the full URL is the cell's `title`. */
  readonly copyHost: string | null;
  readonly klaviyoHost: string | null;
}

export function toEmailCampaignItem(row: EmailCampaignListRow, now: Date): EmailCampaignItem {
  return {
    row,
    updatedLabel: relativeTime(row.updatedAt, now),
    updatedTitle: absoluteTime(row.updatedAt),
    copyHost: hostLabel(row.copyLink),
    klaviyoHost: hostLabel(row.klaviyoLink),
  };
}
