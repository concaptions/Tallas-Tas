import { describe, expect, it } from 'vitest';

import type { BriefActivityItem } from '@/lib/briefs-source';

import {
  ACTIVITY_FIELD_LABELS,
  activityFieldLabel,
  activityStatusLabel,
  activityValueTone,
  groupActivity,
} from './activity-groups';

let sequence = 0;

/** One logged row; `at` defaults to a fixed second so two rows group unless a test says otherwise. */
function row(overrides: Partial<BriefActivityItem> = {}): BriefActivityItem {
  sequence += 1;
  return {
    id: `row-${String(sequence)}`,
    field: 'assignee',
    oldValue: null,
    newValue: 'Mia D.',
    actorName: 'Sarah K.',
    actorId: 'user_sarah',
    at: '2026-10-12T10:11:12.000Z',
    ...overrides,
  };
}

/**
 * The log as the server writes a Request Changes (newest first, `desc(created_at), desc(id)`):
 * the three ticks land AFTER the status row, so they come first in the list, milliseconds apart.
 */
function requestChanges(): BriefActivityItem[] {
  return [
    row({
      field: 'qaStrategist',
      oldValue: 'true',
      newValue: 'false',
      at: '2026-10-12T10:11:12.431Z',
    }),
    row({
      field: 'qaVideoEditor',
      oldValue: 'true',
      newValue: 'false',
      at: '2026-10-12T10:11:12.427Z',
    }),
    row({
      field: 'internalStatus',
      oldValue: 'ad_submitted',
      newValue: 'revisions_needed',
      at: '2026-10-12T10:11:12.419Z',
    }),
  ];
}

describe('groupActivity — one write, one group (B5.V4, ruling 19)', () => {
  it('groups consecutive rows by the same actor within the same SECOND', () => {
    const groups = groupActivity(requestChanges());

    expect(groups).toHaveLength(1);
    expect(groups[0]?.entries).toHaveLength(3);
    expect(groups[0]?.actorName).toBe('Sarah K.');
  });

  it('orders a group for reading: the status first, then the ticks in checklist order', () => {
    const [group] = groupActivity(requestChanges());

    expect(group?.entries.map((entry) => entry.field)).toEqual([
      'internalStatus',
      'qaVideoEditor',
      'qaStrategist',
    ]);
  });

  it('keeps the newest row as the group stamp and the first row id as its key', () => {
    const items = requestChanges();
    const [group] = groupActivity(items);

    expect(group?.at).toBe('2026-10-12T10:11:12.431Z');
    expect(group?.id).toBe(items[0]?.id);
  });

  it('splits on a different second, even by one millisecond across the boundary', () => {
    const groups = groupActivity([
      row({ at: '2026-10-12T10:11:13.000Z' }),
      row({ at: '2026-10-12T10:11:12.999Z' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('splits on a different actor within the same second', () => {
    const groups = groupActivity([row({ actorId: 'user_a' }), row({ actorId: 'user_b' })]);

    expect(groups).toHaveLength(2);
  });

  it('groups two rows with no actor at all (a job) when their seconds match', () => {
    const groups = groupActivity([
      row({ actorId: null, actorName: null }),
      row({ actorId: null, actorName: null }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it('returns no group for an empty log', () => {
    expect(groupActivity([])).toEqual([]);
  });
});

describe('groupActivity — the QA reset (B5.V5)', () => {
  it('marks a group that cleared a tick while moving a status to a warn-toned key', () => {
    const [group] = groupActivity(requestChanges());

    expect(group?.reset).toBe(true);
  });

  it('marks the client-track reset the same way (Pending for Approval → Revisions Needed)', () => {
    const [group] = groupActivity([
      row({ field: 'qaDesigner', oldValue: 'true', newValue: 'false' }),
      row({
        field: 'clientStatus',
        oldValue: 'pending_for_approval',
        newValue: 'revisions_needed',
      }),
    ]);

    expect(group?.reset).toBe(true);
  });

  it('does not mark a status move that cleared nothing', () => {
    const [group] = groupActivity([
      row({ field: 'internalStatus', oldValue: 'ad_submitted', newValue: 'revisions_needed' }),
    ]);

    expect(group?.reset).toBe(false);
  });

  it('does not mark a tick cleared by hand, with no status move beside it', () => {
    const [group] = groupActivity([
      row({ field: 'qaStrategist', oldValue: 'true', newValue: 'false' }),
    ]);

    expect(group?.reset).toBe(false);
  });

  it('does not mark a resubmission: Revisions Submitted is not a warn-toned step', () => {
    const [group] = groupActivity([
      row({ field: 'qaStrategist', oldValue: 'true', newValue: 'false' }),
      row({
        field: 'internalStatus',
        oldValue: 'revisions_needed',
        newValue: 'revisions_submitted',
      }),
    ]);

    expect(group?.reset).toBe(false);
  });
});

describe('activityValueTone (B5.V2)', () => {
  it('tones a tick set ok and a tick cleared bad', () => {
    expect(activityValueTone('qaVideoEditor', 'true')).toBe('ok');
    expect(activityValueTone('qaDesigner', 'false')).toBe('bad');
    expect(activityValueTone('qaStrategist', null)).toBe('mute');
  });

  it('leaves every other field quiet, whatever its value says', () => {
    expect(activityValueTone('assignee', 'true')).toBe('mute');
    expect(activityValueTone('internalStatus', 'approved')).toBe('mute');
  });
});

describe('activity labels (B5.V3)', () => {
  it('names the statuses, the three ticks from the checklist table, and the other logged fields', () => {
    expect(activityFieldLabel('internalStatus')).toBe('Internal status');
    expect(activityFieldLabel('clientStatus')).toBe('Client status');
    expect(activityFieldLabel('qaVideoEditor')).toBe('Video Editor QA');
    expect(activityFieldLabel('qaDesigner')).toBe('Graphic Designer QA');
    expect(activityFieldLabel('qaStrategist')).toBe('Creative Strategist QA');
    expect(activityFieldLabel('assignee')).toBe('Assignee');
    expect(activityFieldLabel('priority')).toBe('Priority');
    expect(activityFieldLabel('dueDate')).toBe('Due date');
  });

  it('answers null for a field it has no label for, so the key renders in mono', () => {
    expect(activityFieldLabel('somethingNew')).toBeNull();
    expect(Object.keys(ACTIVITY_FIELD_LABELS)).not.toContain('somethingNew');
  });

  it('resolves a status key through its own vocabulary, and nothing else', () => {
    expect(activityStatusLabel('internalStatus', 'revisions_needed')).toBe('Revisions Needed');
    expect(activityStatusLabel('clientStatus', 'pending_for_approval')).toBe(
      'Pending for Approval',
    );
    expect(activityStatusLabel('internalStatus', 'not_a_key')).toBe('not_a_key');
    expect(activityStatusLabel('assignee', 'approved')).toBeNull();
    expect(activityStatusLabel('internalStatus', null)).toBeNull();
  });
});
