import { smPlatforms, smTaskStatuses } from '@tas/db/schema';
import { describe, expect, it } from 'vitest';

import {
  buildSmTaskItem,
  countLabel,
  emptyLaneLabel,
  formatDueDate,
  isPlatformKey,
  isSmKanbanField,
  isStatusKey,
  kanbanGroupValue,
  kanbanLaneTone,
  kanbanLanes,
  matchesSmTaskSearch,
  parseDateTimeLocalValue,
  PLATFORM_OPTIONS,
  platformLabel,
  platformTone,
  REMINDER_LEAD_HOURS,
  reminderState,
  SM_TASK_FIELDS,
  STATUS_OPTIONS,
  statusLabel,
  statusTone,
  toDateTimeLocalValue,
} from './fields';

/** A task row with the five stored fields set, for the pure helpers that read one. */
function task(overrides: Partial<Parameters<typeof matchesSmTaskSearch>[0]> = {}) {
  return {
    id: 'task-1',
    brandId: 'brand-1',
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    updatedAt: new Date('2026-09-30T10:00:00.000Z'),
    createdBy: 'user_test',
    updatedBy: 'user_test',
    deletedAt: null,
    templateRowId: null,
    overriddenFields: [],
    customFields: {},
    legacyAirtableId: null,
    taskName: 'Launch the weighted blanket reel',
    platform: 'tiktok' as const,
    dueDate: new Date('2026-10-15T09:00:00.000Z'),
    status: 'todo' as const,
    notes: 'Pin the comment with the launch code.',
    ...overrides,
  };
}

describe('SM_TASK_FIELDS', () => {
  it('is the five stored Airtable fields, in panel order', () => {
    expect(SM_TASK_FIELDS.map((field) => field.name)).toEqual([
      'taskName',
      'platform',
      'dueDate',
      'status',
      'notes',
    ]);
  });

  it('marks only the task name required — the primary field is the one always present', () => {
    expect(SM_TASK_FIELDS.map((field) => field.required)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('select options', () => {
  it('are the vocabulary tuples from @tas/db/schema, keys stored and labels rendered', () => {
    expect(PLATFORM_OPTIONS.map((option) => option.value)).toEqual(smPlatforms.map((o) => o.key));
    expect(PLATFORM_OPTIONS.map((option) => option.label)).toEqual(smPlatforms.map((o) => o.label));
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual(['todo', 'in_progress', 'done']);
    expect(STATUS_OPTIONS.map((option) => option.label)).toEqual(
      smTaskStatuses.map((o) => o.label),
    );
  });

  it('labels and tones every key, so no chip ever renders a raw key', () => {
    expect(platformLabel('tiktok')).toBe('Tiktok');
    expect(platformLabel('x')).toBe('X');
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusTone('todo')).toBe('mute');
    expect(statusTone('in_progress')).toBe('info');
    expect(statusTone('done')).toBe('ok');
    for (const option of PLATFORM_OPTIONS) {
      expect(platformTone(option.value)).toBe(option.tone);
    }
  });

  it('guards a form value against the vocabulary', () => {
    expect(isPlatformKey('meta')).toBe(true);
    expect(isPlatformKey('Meta')).toBe(false);
    expect(isStatusKey('done')).toBe(true);
    expect(isStatusKey('')).toBe(false);
  });
});

describe('reminderState', () => {
  const due = new Date('2026-10-15T09:00:00.000Z');
  const lead = REMINDER_LEAD_HOURS * 60 * 60 * 1000;

  it('is quiet before the lead window opens', () => {
    expect(reminderState(due, 'todo', new Date('2026-10-14T20:00:00.000Z'))).toBe('quiet');
  });

  it('is strict at the boundary, like IS_AFTER: exactly twelve hours before is still quiet', () => {
    expect(reminderState(due, 'todo', new Date(due.getTime() - lead))).toBe('quiet');
    expect(reminderState(due, 'todo', new Date(due.getTime() - lead + 1))).toBe('due');
  });

  it('is due inside the window and after the due moment, for todo and in-progress tasks', () => {
    expect(reminderState(due, 'todo', new Date('2026-10-15T00:00:00.000Z'))).toBe('due');
    expect(reminderState(due, 'in_progress', new Date('2026-10-20T00:00:00.000Z'))).toBe('due');
    expect(reminderState(due, null, new Date('2026-10-20T00:00:00.000Z'))).toBe('due');
  });

  it('never fires for a done task, however overdue', () => {
    expect(reminderState(due, 'done', new Date('2026-11-01T00:00:00.000Z'))).toBe('quiet');
  });

  it('never fires for an undated task', () => {
    expect(reminderState(null, 'todo', new Date('2026-11-01T00:00:00.000Z'))).toBe('quiet');
  });
});

describe('due moments', () => {
  it('formats a grid cell in UTC and renders the em dash for an undated task', () => {
    expect(formatDueDate(new Date('2026-10-15T09:05:00.000Z'))).toBe('2026-10-15 09:05 UTC');
    expect(formatDueDate(null)).toBe('—');
  });

  it('round-trips a datetime-local value through the stored moment', () => {
    const stored = new Date('2026-10-15T09:05:00.000Z');
    expect(toDateTimeLocalValue(stored)).toBe('2026-10-15T09:05');
    expect(parseDateTimeLocalValue('2026-10-15T09:05')).toEqual(stored);
    expect(parseDateTimeLocalValue('2026-10-15T09:05:00')).toEqual(stored);
    expect(toDateTimeLocalValue(null)).toBe('');
  });

  it('refuses text that is not a datetime-local value, or names a day that does not exist', () => {
    expect(parseDateTimeLocalValue('')).toBeNull();
    expect(parseDateTimeLocalValue('2026-10-15')).toBeNull();
    expect(parseDateTimeLocalValue('15/10/2026 09:05')).toBeNull();
    expect(parseDateTimeLocalValue('2026-02-30T10:00')).toBeNull();
    expect(parseDateTimeLocalValue('2026-10-15T25:00')).toBeNull();
  });
});

describe('buildSmTaskItem', () => {
  it('computes every derived string once, from the page’s now', () => {
    const now = new Date('2026-10-15T00:00:00.000Z');
    const item = buildSmTaskItem(task(), now);

    expect(item.dueLabel).toBe('2026-10-15 09:00 UTC');
    expect(item.reminder).toBe('due');
    expect(item.updatedLabel).toBe('2 weeks ago');
    expect(item.updatedTitle).toBe('2026-09-30 10:00');
  });
});

describe('matchesSmTaskSearch', () => {
  it('reads the task name, the notes and the rendered labels, not the stored keys', () => {
    expect(matchesSmTaskSearch(task(), 'blanket')).toBe(true);
    expect(matchesSmTaskSearch(task(), 'launch code')).toBe(true);
    expect(matchesSmTaskSearch(task(), 'tiktok')).toBe(true);
    expect(matchesSmTaskSearch(task({ status: 'in_progress' }), 'in progress')).toBe(true);
    expect(matchesSmTaskSearch(task({ status: 'in_progress' }), 'in_progress')).toBe(false);
    expect(matchesSmTaskSearch(task({ notes: null, platform: null }), 'tiktok')).toBe(false);
  });
});

describe('countLabel', () => {
  it('pluralises and shows the narrowed count', () => {
    expect(countLabel(1, 1)).toBe('1 task');
    expect(countLabel(5, 5)).toBe('5 tasks');
    expect(countLabel(5, 2)).toBe('2 of 5 tasks');
  });
});

describe('kanban grouping', () => {
  it('accepts exactly the two capability fields', () => {
    expect(isSmKanbanField('status')).toBe(true);
    expect(isSmKanbanField('platform')).toBe(true);
    expect(isSmKanbanField('dueDate')).toBe(false);
  });

  it('lays out one lane per vocabulary option, in order, plus a named lane for the unset value', () => {
    expect(kanbanLanes('status').map((lane) => lane.label)).toEqual([
      'Todo',
      'In progress',
      'Done',
    ]);
    expect(kanbanLanes('platform').map((lane) => lane.value)).toEqual([
      'meta',
      'tiktok',
      'snapchat',
      'x',
    ]);
    expect(emptyLaneLabel('status')).toBe('No status');
    expect(emptyLaneLabel('platform')).toBe('No platform');
  });

  it('keys a card on the stored key and sends an unset field to the empty lane', () => {
    expect(kanbanGroupValue(task(), 'status')).toBe('todo');
    expect(kanbanGroupValue(task(), 'platform')).toBe('tiktok');
    expect(kanbanGroupValue(task({ platform: null }), 'platform')).toBe('');
  });

  it('stripes a card with its lane’s tone and leaves the empty lane unstriped', () => {
    expect(kanbanLaneTone('status', 'done')).toBe('ok');
    expect(kanbanLaneTone('platform', 'meta')).toBe('info');
    expect(kanbanLaneTone('status', '')).toBeUndefined();
  });
});
