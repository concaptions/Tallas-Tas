import { describe, expect, it } from 'vitest';

import { INTERNAL_STATUS } from './creative-status';
import {
  INTERNAL_QUEUE_COLUMNS,
  QUEUE_OTHER_COLUMN,
  groupByInternalStatus,
  internalQueueColumnEntry,
  internalQueueColumnKey,
  internalQueueColumns,
} from './queue-columns';

interface Row {
  readonly id: string;
  readonly internalStatus: string;
}

const row = (id: string, internalStatus: string): Row => ({ id, internalStatus });

/**
 * The seven seeded briefs' internal statuses after the Oct 12 consolidation, in `demoBriefs` order
 * (which is `updated_at desc`). Copied from `packages/db` rather than imported: `@tas/domain` has
 * no dependency on `@tas/db` and must not grow one. Four rows are `approved` so the Client Queue
 * board has cards (the seventh was `launched` before 0067 mapped it to `approved`).
 */
const demoStatuses = [
  'approved',
  'under_editing_or_designing',
  'ad_submitted',
  'approved',
  'approved',
  'sent_to_editor_or_designer',
  'approved',
];

describe('internalQueueColumns', () => {
  it('lists every column in flow order — the one internal list, no On Hold siding', () => {
    expect(internalQueueColumns().map((column) => column.key)).toEqual([
      'draft',
      'sent_to_editor_or_designer',
      'under_editing_or_designing',
      'ad_submitted',
      'revisions_needed',
      'revisions_submitted',
      'approved',
    ]);
  });

  it('returns the same frozen list every call', () => {
    expect(internalQueueColumns()).toBe(INTERNAL_QUEUE_COLUMNS);
  });

  it('is the internal vocabulary itself, each key exactly once and in its order', () => {
    expect(INTERNAL_QUEUE_COLUMNS).toBe(INTERNAL_STATUS);
    const keys = INTERNAL_QUEUE_COLUMNS.map((column) => column.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries the label and description straight from the status vocabulary', () => {
    const approved = internalQueueColumnEntry('approved');
    expect(approved).toEqual(INTERNAL_STATUS.find((entry) => entry.key === 'approved'));
    for (const column of INTERNAL_QUEUE_COLUMNS) {
      expect(column.label.length).toBeGreaterThan(0);
      expect(column.description.length).toBeGreaterThan(0);
    }
  });

  it('has no entry for a status it does not carry, the retired keys included', () => {
    expect(internalQueueColumnEntry('pending_for_approval')).toBeUndefined();
    expect(internalQueueColumnEntry('on_hold')).toBeUndefined();
    expect(internalQueueColumnEntry('launched')).toBeUndefined();
    expect(internalQueueColumnEntry('videos_revisions')).toBeUndefined();
  });
});

describe('internalQueueColumnKey', () => {
  it('answers with the status itself for every column', () => {
    for (const column of INTERNAL_QUEUE_COLUMNS) {
      expect(internalQueueColumnKey(column.key)).toBe(column.key);
    }
  });

  it('sends a client status, a retired status, an unknown status and an empty string to Other', () => {
    for (const value of ['pending_for_approval', 'on_hold', 'launched', 'shipped_to_mars', '']) {
      expect(internalQueueColumnKey(value)).toBe(QUEUE_OTHER_COLUMN.key);
    }
  });
});

describe('groupByInternalStatus', () => {
  it('still yields every column for an empty board, each with a count of 0', () => {
    const columns = groupByInternalStatus([]);
    expect(columns).toHaveLength(INTERNAL_QUEUE_COLUMNS.length);
    expect(columns.map((column) => column.key)).toEqual(
      INTERNAL_QUEUE_COLUMNS.map((column) => column.key),
    );
    for (const column of columns) {
      expect(column.rows).toEqual([]);
      expect(column.count).toBe(0);
    }
  });

  it('puts every seeded brief in exactly one column and leaves the rest empty', () => {
    const rows = demoStatuses.map((status, index) => row(`brief-${String(index)}`, status));
    const columns = groupByInternalStatus(rows);

    expect(columns).toHaveLength(INTERNAL_QUEUE_COLUMNS.length);
    const placed = columns.flatMap((column) => column.rows.map((entry) => entry.id));
    expect(placed).toHaveLength(rows.length);
    expect(new Set(placed)).toEqual(new Set(rows.map((entry) => entry.id)));

    const filled = columns.filter((column) => column.count > 0).map((column) => column.key);
    expect(new Set(filled)).toEqual(new Set(demoStatuses));
    // Four of the seven fixtures share the `approved` step, so the empty columns are counted
    // against the DISTINCT statuses, not the row count.
    expect(columns.filter((column) => column.count === 0)).toHaveLength(
      INTERNAL_QUEUE_COLUMNS.length - new Set(demoStatuses).size,
    );
  });

  it('counts what it holds', () => {
    const columns = groupByInternalStatus([
      row('a', 'approved'),
      row('b', 'approved'),
      row('c', 'revisions_needed'),
    ]);
    const approved = columns.find((column) => column.key === 'approved');
    expect(approved?.count).toBe(2);
    expect(approved?.rows.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(columns.find((column) => column.key === 'revisions_needed')?.count).toBe(1);
  });

  it('keeps the order the rows arrived in inside a column', () => {
    const columns = groupByInternalStatus([
      row('newest', 'approved'),
      row('older', 'approved'),
      row('oldest', 'approved'),
    ]);
    expect(
      columns.find((column) => column.key === 'approved')?.rows.map((entry) => entry.id),
    ).toEqual(['newest', 'older', 'oldest']);
  });

  it('sends a brief on a retired status to Other rather than dropping it (0067 moved every live row off them)', () => {
    const columns = groupByInternalStatus([row('paused', 'on_hold'), row('live', 'launched')]);
    const last = columns[columns.length - 1];
    expect(last?.key).toBe(QUEUE_OTHER_COLUMN.key);
    expect(last?.rows.map((entry) => entry.id)).toEqual(['paused', 'live']);
  });

  it('adds an Other column for an unknown status so no card vanishes', () => {
    const columns = groupByInternalStatus([
      row('known', 'approved'),
      row('strange', 'shipped_to_mars'),
    ]);
    expect(columns).toHaveLength(INTERNAL_QUEUE_COLUMNS.length + 1);
    const other = columns[columns.length - 1];
    expect(other?.key).toBe(QUEUE_OTHER_COLUMN.key);
    expect(other?.label).toBe('Other');
    expect(other?.count).toBe(1);
    expect(other?.rows.map((entry) => entry.id)).toEqual(['strange']);
  });

  it('adds no Other column when every status is one the board knows', () => {
    const columns = groupByInternalStatus(demoStatuses.map((status, i) => row(String(i), status)));
    expect(columns.map((column) => column.key)).not.toContain(QUEUE_OTHER_COLUMN.key);
  });

  it('does not mutate the rows it is handed', () => {
    const rows = [row('a', 'approved'), row('b', 'shipped_to_mars')];
    const snapshot = structuredClone(rows);
    groupByInternalStatus(rows);
    expect(rows).toEqual(snapshot);
  });

  it('accepts any row carrying an internalStatus, not just a brief', () => {
    const columns = groupByInternalStatus([
      { internalStatus: 'approved', assignee: 'Dorian Vance' },
    ]);
    expect(columns.find((column) => column.key === 'approved')?.rows[0]?.assignee).toBe(
      'Dorian Vance',
    );
  });
});
