import { describe, expect, it } from 'vitest';

import { activityValue, diffFields } from './field-diff';

describe('activityValue', () => {
  it('prints text, lists, dates, booleans and numbers; empties are null', () => {
    expect(activityValue('Dorian')).toBe('Dorian');
    expect(activityValue('  ')).toBeNull();
    expect(activityValue(['a', '', 'b'])).toBe('a, b');
    expect(activityValue([])).toBeNull();
    expect(activityValue(new Date('2026-10-01T10:00:00Z'))).toBe('2026-10-01T10:00:00.000Z');
    expect(activityValue(true)).toBe('true');
    expect(activityValue(3)).toBe('3');
    expect(activityValue(undefined)).toBeNull();
  });
});

describe('diffFields', () => {
  interface Row {
    readonly status: string;
    readonly assignee: string | null;
    readonly priority: string;
    readonly tags: readonly string[];
  }
  const before: Row = {
    status: 'sent_to_video_editor',
    assignee: null,
    priority: 'High',
    tags: ['a'],
  };

  it('lists only the fields whose printed value changed, in field order', () => {
    const changes = diffFields(
      before,
      { status: 'video_editing_in_progress', assignee: 'Dorian Vance', priority: 'High' },
      ['status', 'assignee', 'priority', 'tags'],
    );
    expect(changes).toEqual([
      { field: 'status', oldValue: 'sent_to_video_editor', newValue: 'video_editing_in_progress' },
      { field: 'assignee', oldValue: null, newValue: 'Dorian Vance' },
    ]);
  });

  it('ignores fields the write does not carry and empty-for-empty', () => {
    expect(diffFields(before, { assignee: '' }, ['status', 'assignee'])).toEqual([]);
    expect(diffFields(before, {}, ['status'])).toEqual([]);
  });
});
