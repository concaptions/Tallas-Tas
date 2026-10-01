import type { SmCampaignFeedTaskListRow } from '@tas/db';
import {
  smPlatforms,
  smTaskStatuses,
  type SmPlatformsKey,
  type SmTaskStatusesKey,
} from '@tas/db/schema';
import type { ChipTone } from '@tas/domain/state';

import { absoluteTime, relativeTime } from '@/lib/relative-time';

/**
 * The five stored SM Campaign Feed fields (Airtable `tblLRajTW55XEhVhk`) and the presentation rules
 * the grid, the board, the panel and the Server Actions all read. One module, so a label, a chip tone,
 * the dash an unset value renders as or the way a due moment is written cannot drift between them.
 *
 * Select values come from the `smPlatforms` / `smTaskStatuses` tuples in `@tas/db/schema`: the KEYS
 * are stored and validated, the LABELS are rendered, never a string literal. The tones are a local
 * total map (every key named, so adding an option fails to compile here rather than rendering grey):
 * `chipTone` from `@tas/domain/state` is keyed on the creative-approval labels and knows none of these.
 */
export type SmTaskFieldName = 'taskName' | 'platform' | 'dueDate' | 'status' | 'notes';

export interface SmTaskField {
  readonly name: SmTaskFieldName;
  readonly label: string;
  /** `input` is one line, `textarea` is prose, `datetime` is the due moment, the rest are Selects. */
  readonly kind: 'input' | 'platform' | 'datetime' | 'status' | 'textarea';
  readonly placeholder: string;
  /** Only the task name is required: Airtable's primary field is the one that is always present. */
  readonly required: boolean;
}

/** The panel renders exactly these five, in this order, and nothing else is editable. */
export const SM_TASK_FIELDS: readonly SmTaskField[] = [
  {
    name: 'taskName',
    label: 'Task Name',
    kind: 'input',
    placeholder: 'Launch the weighted blanket reel',
    required: true,
  },
  { name: 'platform', label: 'Platform', kind: 'platform', placeholder: '', required: false },
  { name: 'dueDate', label: 'Due Date (UTC)', kind: 'datetime', placeholder: '', required: false },
  { name: 'status', label: 'Status', kind: 'status', placeholder: '', required: false },
  {
    name: 'notes',
    label: 'Notes',
    kind: 'textarea',
    placeholder: 'What the post needs, who signs it off, which link to pin.',
    required: false,
  },
];

/** The dash a null cell or an unset field shows, so an empty value is never a blank gap. */
export const EM_DASH = '—';
export const NOT_SET = 'Not set';

export interface SmSelectOption<Key extends string> {
  readonly value: Key;
  readonly label: string;
  readonly tone: ChipTone;
}

const PLATFORM_TONE: Record<SmPlatformsKey, ChipTone> = {
  meta: 'info',
  tiktok: 'accent',
  snapchat: 'warn',
  x: 'mute',
};

const STATUS_TONE: Record<SmTaskStatusesKey, ChipTone> = {
  todo: 'mute',
  in_progress: 'info',
  done: 'ok',
};

/** The platforms in the vocabulary's own order, ready for the Select, the chip and the board's lanes. */
export const PLATFORM_OPTIONS: readonly SmSelectOption<SmPlatformsKey>[] = smPlatforms.map(
  (option) => ({ value: option.key, label: option.label, tone: PLATFORM_TONE[option.key] }),
);

/** The three statuses in workflow order: Todo, In progress, Done. */
export const STATUS_OPTIONS: readonly SmSelectOption<SmTaskStatusesKey>[] = smTaskStatuses.map(
  (option) => ({ value: option.key, label: option.label, tone: STATUS_TONE[option.key] }),
);

export function isPlatformKey(value: string): value is SmPlatformsKey {
  return PLATFORM_OPTIONS.some((option) => option.value === value);
}

export function isStatusKey(value: string): value is SmTaskStatusesKey {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

export function platformLabel(key: SmPlatformsKey): string {
  return PLATFORM_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

export function platformTone(key: SmPlatformsKey): ChipTone {
  return PLATFORM_TONE[key];
}

export function statusLabel(key: SmTaskStatusesKey): string {
  return STATUS_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

export function statusTone(key: SmTaskStatusesKey): ChipTone {
  return STATUS_TONE[key];
}

// ── Reminder Trigger (Airtable formula, computed here, never stored) ─────────

/** Airtable: `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")`. */
export const REMINDER_LEAD_HOURS = 12;
const REMINDER_LEAD_MS = REMINDER_LEAD_HOURS * 60 * 60 * 1000;

export type ReminderState = 'due' | 'quiet';

/** What the Reminder column says when it fires, and the tone it fires in. */
export const REMINDER_LABEL = 'Due';
export const REMINDER_TONE: ChipTone = 'warn';

/**
 * The formula, with the clock as an argument: `due` once `now` is past the lead window (strictly
 * after `dueDate − 12h`, as `IS_AFTER` is strict) while the task is not done; `quiet` otherwise, and
 * always quiet for an undated task. The page calls this with the one `now` it renders with; no
 * component reads the clock.
 */
export function reminderState(
  dueDate: Date | null,
  status: SmTaskStatusesKey | null,
  now: Date,
): ReminderState {
  if (dueDate === null || status === 'done') {
    return 'quiet';
  }
  return now.getTime() > dueDate.getTime() - REMINDER_LEAD_MS ? 'due' : 'quiet';
}

// ── Due moments ───────────────────────────────────────────────────────────────

/**
 * The due moment for a grid cell: `YYYY-MM-DD HH:mm UTC`, or the em dash. Written in UTC on purpose:
 * the string is computed on the server and must not depend on where the server or the browser is,
 * or the two would disagree and break hydration.
 */
export function formatDueDate(value: Date | null): string {
  if (value === null) {
    return EM_DASH;
  }
  const iso = value.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** The `datetime-local` input value for a stored due moment (`YYYY-MM-DDTHH:mm`, UTC wall clock), or `''`. */
export function toDateTimeLocalValue(value: Date | null): string {
  return value === null ? '' : value.toISOString().slice(0, 16);
}

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/**
 * The stored moment for a `datetime-local` value, read as UTC to mirror `toDateTimeLocalValue`, or
 * null when the text is not one. A calendar-impossible value such as `2026-02-30T10:00` is refused
 * too: the parsed moment must write back to the same minute it was read from.
 */
export function parseDateTimeLocalValue(value: string): Date | null {
  if (!DATETIME_LOCAL.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toDateTimeLocalValue(parsed) === value.slice(0, 16) ? parsed : null;
}

// ── The row as the page hands it to the workspace ────────────────────────────

/**
 * One task with every derived string already computed on the server: the due label, the reminder
 * state for the page's `now`, and the relative timestamp. The workspace and the panel render these
 * and compute nothing.
 */
export interface SmTaskItem {
  readonly task: SmCampaignFeedTaskListRow;
  readonly dueLabel: string;
  readonly reminder: ReminderState;
  readonly updatedLabel: string;
  readonly updatedTitle: string;
}

export function buildSmTaskItem(task: SmCampaignFeedTaskListRow, now: Date): SmTaskItem {
  return {
    task,
    dueLabel: formatDueDate(task.dueDate),
    reminder: reminderState(task.dueDate, task.status, now),
    updatedLabel: relativeTime(task.updatedAt, now),
    updatedTitle: absoluteTime(task.updatedAt),
  };
}

/** The search reads what the grid shows: the task, its notes, and the platform and status labels. */
export function matchesSmTaskSearch(task: SmCampaignFeedTaskListRow, query: string): boolean {
  return [
    task.taskName,
    task.notes ?? '',
    task.platform === null ? '' : platformLabel(task.platform),
    task.status === null ? '' : statusLabel(task.status),
  ].some((value) => value.toLowerCase().includes(query));
}

export function countLabel(total: number, visible: number): string {
  const noun = total === 1 ? 'task' : 'tasks';
  return total === visible
    ? `${String(total)} ${noun}`
    : `${String(visible)} of ${String(total)} ${noun}`;
}

// ── Kanban (by status, by platform) ───────────────────────────────────────────

/** The two fields the board can group by — the `kanbanFields` of the `sm-campaign-feed` capability. */
export type SmKanbanField = 'status' | 'platform';

export function isSmKanbanField(value: string): value is SmKanbanField {
  return value === 'status' || value === 'platform';
}

export interface KanbanLane {
  readonly value: string;
  readonly label: string;
}

/** The `groupValue` the board keys a card on: the stored key, or `''` for an unset field. */
export const EMPTY_LANE = '';

/** Every option of the field as a lane, in the vocabulary's order, so an empty lane is still shown. */
export function kanbanLanes(field: SmKanbanField): readonly KanbanLane[] {
  const options: readonly SmSelectOption<string>[] =
    field === 'status' ? STATUS_OPTIONS : PLATFORM_OPTIONS;
  return options.map((option) => ({ value: option.value, label: option.label }));
}

/** The lane an unset field lands in, appended only while a visible task needs it. */
export function emptyLaneLabel(field: SmKanbanField): string {
  return field === 'status' ? 'No status' : 'No platform';
}

export function kanbanGroupValue(task: SmCampaignFeedTaskListRow, field: SmKanbanField): string {
  return (field === 'status' ? task.status : task.platform) ?? EMPTY_LANE;
}

/** The stripe tone of a card in its lane; undefined for the empty lane, so the card has no stripe. */
export function kanbanLaneTone(field: SmKanbanField, value: string): ChipTone | undefined {
  if (field === 'status') {
    return isStatusKey(value) ? statusTone(value) : undefined;
  }
  return isPlatformKey(value) ? platformTone(value) : undefined;
}
