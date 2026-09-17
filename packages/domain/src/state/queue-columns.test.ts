import { describe, expect, it } from 'vitest';

import { INTERNAL_STATIC_STATUS, INTERNAL_VIDEO_STATUS, ON_HOLD } from './creative-status';
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
 * The seven seeded briefs' internal statuses, in `demoBriefs` order (which is `updated_at desc`).
 * Copied from the `packages/db` client-queue handoff rather than imported: `@tas/domain` has no
 * dependency on `@tas/db` and must not grow one. Three rows are `approved` so the Client Queue board
 * has cards, and the seventh is `launched`.
 */
const demoStatuses = [
  'approved',
  'static_design_in_progress',
  'ad_submitted',
  'approved',
  'approved',
  'sent_to_video_editor',
  'launched',
];

describe('internalQueueColumns', () => {
  it('lists every column in PRD §9 order with On Hold last', () => {
    expect(internalQueueColumns().map((column) => column.key)).toEqual([
      'sent_to_designer',
      'static_design_in_progress',
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'images_revisions',
      'videos_revisions',
      'revisions_submitted',
      'approved',
      'launched',
      'on_hold',
    ]);
  });

  it('returns the same frozen list every call', () => {
    expect(internalQueueColumns()).toBe(INTERNAL_QUEUE_COLUMNS);
  });

  it('is the union of the two ladders plus On Hold, each shared key exactly once', () => {
    const keys = INTERNAL_QUEUE_COLUMNS.map((column) => column.key);
    const union = new Set<string>([
      ...INTERNAL_VIDEO_STATUS.map((entry) => entry.key),
      ...INTERNAL_STATIC_STATUS.map((entry) => entry.key),
      ON_HOLD.key,
    ]);
    expect(new Set(keys)).toEqual(union);
    expect(keys).toHaveLength(union.size);
    for (const key of ['ad_submitted', 'revisions_submitted', 'approved', 'launched']) {
      expect(keys.filter((candidate) => candidate === key)).toHaveLength(1);
    }
  });

  it('keeps each ladder in its own order', () => {
    const keys: string[] = INTERNAL_QUEUE_COLUMNS.map((column) => column.key);
    for (const ladder of [INTERNAL_VIDEO_STATUS, INTERNAL_STATIC_STATUS]) {
      const positions = ladder.map((entry) => keys.indexOf(entry.key));
      expect(positions).not.toContain(-1);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('carries the label and description straight from the status vocabulary', () => {
    const approved = internalQueueColumnEntry('approved');
    expect(approved).toEqual(INTERNAL_VIDEO_STATUS.find((entry) => entry.key === 'approved'));
    expect(internalQueueColumnEntry('on_hold')).toEqual(ON_HOLD);
    for (const column of INTERNAL_QUEUE_COLUMNS) {
      expect(column.label.length).toBeGreaterThan(0);
      expect(column.description.length).toBeGreaterThan(0);
    }
  });

  it('has no entry for a status it does not carry', () => {
    expect(internalQueueColumnEntry('pending_for_approval')).toBeUndefined();
  });
});

describe('internalQueueColumnKey', () => {
  it('answers with the status itself for every column', () => {
    for (const column of INTERNAL_QUEUE_COLUMNS) {
      expect(internalQueueColumnKey(column.key)).toBe(column.key);
    }
  });

  it('sends a client status, an unknown status and an empty string to Other', () => {
    for (const value of ['pending_for_approval', 'shipped_to_mars', '']) {
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
    // Three of the seven fixtures share the `approved` step, so the empty columns are counted
    // against the DISTINCT statuses, not the row count.
    expect(columns.filter((column) => column.count === 0)).toHaveLength(
      INTERNAL_QUEUE_COLUMNS.length - new Set(demoStatuses).size,
    );
  });

  it('counts what it holds', () => {
    const columns = groupByInternalStatus([
      row('a', 'approved'),
      row('b', 'approved'),
      row('c', 'launched'),
    ]);
    const approved = columns.find((column) => column.key === 'approved');
    expect(approved?.count).toBe(2);
    expect(approved?.rows.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(columns.find((column) => column.key === 'launched')?.count).toBe(1);
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

  it('holds on_hold briefs in the last column rather than in a stepper step', () => {
    const columns = groupByInternalStatus([row('paused', ON_HOLD.key)]);
    const last = columns[columns.length - 1];
    expect(last?.key).toBe(ON_HOLD.key);
    expect(last?.rows.map((entry) => entry.id)).toEqual(['paused']);
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
