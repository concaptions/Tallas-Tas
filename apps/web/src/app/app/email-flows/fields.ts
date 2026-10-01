import type { EmailFlowListRow } from '@tas/db';
import {
  emailChannels,
  emailFlowStatuses,
  type EmailChannelsKey,
  type EmailFlowStatusesKey,
} from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';

/**
 * The Email Flows vocabulary (Airtable "Email Flows Management", `tblubVflAQZgJSxcF`): the ten
 * stored fields the panel edits, grouped as the panel renders them, the presentation of the two
 * single-selects, and the pure helpers the page, the grid, the panel and the Server Actions share.
 * One module, so a label, a tone, the dash an unset value renders as or the way a URL list is split
 * cannot drift between them.
 *
 * Status and Type values come from `emailFlowStatuses` and `emailChannels` in `@tas/db/schema` —
 * labels rendered, keys stored — never a string literal. The two formula fields of the base (Design
 * Due Date, Copywriting Due Date) are not fields here: the query layer computes them onto
 * `EmailFlowListRow` and the panel only displays them.
 */
export type EmailFlowFieldName =
  | 'flowName'
  | 'expectedSetupDate'
  | 'flowPurpose'
  | 'status'
  | 'copywriting'
  | 'design'
  | 'klaviyoLink'
  | 'type'
  | 'inspo'
  | 'assigneeId';

/**
 * How the panel draws a field: a one-line input, a calendar date, a URL, strategist prose, one file
 * URL per line (the two attachment fields), or one of the three selects.
 */
export type EmailFlowFieldKind =
  'input' | 'date' | 'url' | 'textarea' | 'urlList' | 'status' | 'type' | 'assignee';

export interface EmailFlowField {
  readonly name: EmailFlowFieldName;
  readonly label: string;
  readonly kind: EmailFlowFieldKind;
  /** Only the flow name is required; a flow is filled in over several sittings. */
  readonly required: boolean;
  readonly placeholder?: string;
  readonly hint?: string;
}

export interface EmailFlowFieldGroup {
  readonly heading: string;
  readonly fields: readonly EmailFlowField[];
}

/** The four headings, in this order. The panel renders exactly these and nothing else. */
export const EMAIL_FLOW_FIELD_GROUPS: readonly EmailFlowFieldGroup[] = [
  {
    heading: 'Flow',
    fields: [
      {
        name: 'flowName',
        label: 'Flow Name',
        kind: 'input',
        required: true,
        placeholder: 'Welcome Series',
      },
      {
        name: 'flowPurpose',
        label: 'Flow Purpose',
        kind: 'textarea',
        required: false,
        placeholder: 'Who enters this flow, what it should move them to do, and over how long.',
      },
      { name: 'type', label: 'Type', kind: 'type', required: false },
      { name: 'status', label: 'Status', kind: 'status', required: false },
      { name: 'assigneeId', label: 'Assignee', kind: 'assignee', required: false },
    ],
  },
  {
    heading: 'Schedule',
    fields: [
      {
        name: 'expectedSetupDate',
        label: 'Expected Setup Date',
        kind: 'date',
        required: false,
        hint: 'Design is due five days before this date, copywriting five days before design.',
      },
    ],
  },
  {
    heading: 'Content',
    fields: [
      {
        name: 'copywriting',
        label: 'Copywriting',
        kind: 'textarea',
        required: false,
        placeholder: 'The body copy, one email or message per paragraph.',
      },
      {
        name: 'klaviyoLink',
        label: 'Klaviyo Link',
        kind: 'url',
        required: false,
        placeholder: 'https://www.klaviyo.com/flows/…',
      },
    ],
  },
  {
    heading: 'Files',
    fields: [
      {
        name: 'design',
        label: 'Design',
        kind: 'urlList',
        required: false,
        hint: 'One file URL per line.',
      },
      {
        name: 'inspo',
        label: 'Inspo',
        kind: 'urlList',
        required: false,
        hint: 'One file URL per line.',
      },
    ],
  },
];

/** Every field, flattened; the Server Actions read the form by this list. */
export const EMAIL_FLOW_FIELDS: readonly EmailFlowField[] = EMAIL_FLOW_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/**
 * The CSV template a strategist downloads before a bulk upload (CLAUDE.md non-negotiable 9): the
 * writable columns in panel order, snake_case as a spreadsheet exported from Airtable carries them.
 * `id`, `brand_id`, the audit columns and the two formulas are absent — none of them is a form's to
 * choose. The campaign links travel as a separate column of campaign names.
 */
export const EMAIL_FLOW_CSV_COLUMNS = [
  'flow_name',
  'flow_purpose',
  'type',
  'status',
  'assignee_id',
  'expected_setup_date',
  'copywriting',
  'klaviyo_link',
  'design',
  'inspo',
  'campaigns',
] as const;

// ── Status and Type presentation ────────────────────────────────────────────────────────

export interface SelectOption<Key extends string> {
  readonly value: Key;
  readonly label: string;
  readonly tone: ChipTone;
}

/**
 * The tone of each of the twelve statuses. A TOTAL map (`Record` over the key union), so a value
 * added to `emailFlowStatuses` fails typecheck here instead of rendering an unstyled chip. Work in
 * progress is `accent`, waiting on the client is `info`, edits required is the one `warn`, the two
 * approvals are `ok`, Live is `accent` as Launched is, and the hand-offs and Pending are `mute`.
 */
const STATUS_TONE: Record<EmailFlowStatusesKey, ChipTone> = {
  client_idea_pending_for_approval: 'info',
  ideas_approved: 'ok',
  copywriting: 'accent',
  copywriting_finished: 'mute',
  template_design: 'accent',
  design_submitted: 'mute',
  client_design_pending_for_approval: 'info',
  client_edits_required: 'warn',
  revisions_submitted: 'mute',
  client_approved: 'ok',
  live: 'accent',
  pending: 'mute',
};

/** The three channels: email reads as information, SMS as the accent, push as muted. */
const TYPE_TONE: Record<EmailChannelsKey, ChipTone> = {
  email: 'info',
  sms: 'accent',
  push_notification: 'mute',
};

/** The twelve statuses in the base's order, ready for the Select, the chip and the kanban. */
export const EMAIL_FLOW_STATUS_OPTIONS: readonly SelectOption<EmailFlowStatusesKey>[] =
  emailFlowStatuses.map(({ key, label }) => ({ value: key, label, tone: STATUS_TONE[key] }));

/** The three types in the base's order. */
export const EMAIL_FLOW_TYPE_OPTIONS: readonly SelectOption<EmailChannelsKey>[] = emailChannels.map(
  ({ key, label }) => ({ value: key, label, tone: TYPE_TONE[key] }),
);

const STATUS_LABEL = new Map(
  EMAIL_FLOW_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);
const TYPE_LABEL = new Map(EMAIL_FLOW_TYPE_OPTIONS.map((option) => [option.value, option.label]));

export function statusLabel(status: EmailFlowStatusesKey): string {
  return STATUS_LABEL.get(status) ?? status;
}

export function statusTone(status: EmailFlowStatusesKey): ChipTone {
  return STATUS_TONE[status];
}

export function typeLabel(type: EmailChannelsKey): string {
  return TYPE_LABEL.get(type) ?? type;
}

export function typeTone(type: EmailChannelsKey): ChipTone {
  return TYPE_TONE[type];
}

// ── Kanban grouping ─────────────────────────────────────────────────────────────────────

/** The two fields the board groups by, the `kanbanFields` of the `email-flows` capability. */
export type KanbanGroupField = 'status' | 'type';

export function isKanbanGroupField(value: string): value is KanbanGroupField {
  return value === 'status' || value === 'type';
}

/** The board's columns for a group field: the whole vocabulary, in order, empties kept. */
export function kanbanColumnsFor(
  field: KanbanGroupField,
): readonly { readonly value: string; readonly label: string }[] {
  const options: readonly SelectOption<string>[] =
    field === 'status' ? EMAIL_FLOW_STATUS_OPTIONS : EMAIL_FLOW_TYPE_OPTIONS;
  return options.map(({ value, label }) => ({ value, label }));
}

/** Where one flow sits on the board for a group field, or null when the field is unset. */
export function kanbanGroupOf(
  flow: EmailFlowListRow,
  field: KanbanGroupField,
): { readonly value: string; readonly label: string; readonly tone: ChipTone } | null {
  if (field === 'status') {
    return flow.status === null
      ? null
      : { value: flow.status, label: statusLabel(flow.status), tone: statusTone(flow.status) };
  }
  return flow.type === null
    ? null
    : { value: flow.type, label: typeLabel(flow.type), tone: typeTone(flow.type) };
}

// ── Values ──────────────────────────────────────────────────────────────────────────────

/** The dash a null cell shows, so an unset value is never an empty gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

/** `http(s)` or nothing: the only thing a link column or a file list may hold. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The host of a link, for a grid cell: the Klaviyo URL is long enough to break a row, so the cell
 * shows the host and carries the full URL in its `title`. A value that is not a parseable URL is
 * returned untouched rather than hidden — the strategist typed it, and the panel is where it gets
 * corrected.
 */
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

/** A `YYYY-MM-DD` column as "Oct 20, 2026", in UTC so the day never shifts; the dash when null. */
export function formatDate(value: string | null): string {
  if (value === null) return EM_DASH;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** An attachment column (a jsonb array of file URLs) as the textarea shows it: one per line. */
export function urlListText(list: readonly string[] | null): string {
  return list === null ? '' : list.join('\n');
}

/** The textarea back into a list: one URL per line, trimmed, blank lines dropped. */
export function parseUrlList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

// ── Grid rows ───────────────────────────────────────────────────────────────────────────

/**
 * A row as the grid, the board and the panel receive it: the decorated row plus every string the
 * server formats once (a client that formatted a relative time itself would disagree with the
 * server and break hydration).
 */
export interface EmailFlowItem {
  readonly flow: EmailFlowListRow;
  readonly setupLabel: string;
  readonly designDueLabel: string;
  readonly copywritingDueLabel: string;
  /** The Klaviyo link's host, or null when there is none; the full URL is the cell's `title`. */
  readonly klaviyoHost: string | null;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

export function emailFlowItem(flow: EmailFlowListRow, now: Date): EmailFlowItem {
  return {
    flow,
    setupLabel: formatDate(flow.expectedSetupDate),
    designDueLabel: formatDate(flow.designDueDate),
    copywritingDueLabel: formatDate(flow.copywritingDueDate),
    klaviyoHost: hostLabel(flow.klaviyoLink),
    updatedLabel: relativeTime(flow.updatedAt, now),
    updatedTitle: absoluteTime(flow.updatedAt),
  };
}

/** The search reads what the grid shows: name, purpose, status, type, assignee, campaigns, link. */
export function matchesSearch(item: EmailFlowItem, query: string): boolean {
  const { flow } = item;
  return [
    flow.flowName,
    flow.flowPurpose ?? '',
    flow.status === null ? '' : statusLabel(flow.status),
    flow.type === null ? '' : typeLabel(flow.type),
    flow.assigneeName ?? '',
    flow.campaignNames.join(' '),
    flow.klaviyoLink ?? '',
  ].some((value) => value.toLowerCase().includes(query));
}

export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'flow' : 'flows';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}
