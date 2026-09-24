import { describe, expect, it } from 'vitest';

import { CLIENT_STATUS, CLIENT_TRANSITIONS, canTransitionClient } from '../state/creative-status';
import { QUEUE_OTHER_COLUMN } from '../state/queue-columns';
import {
  CLIENT_QUEUE_ACTIONS,
  CLIENT_QUEUE_COLUMNS,
  clientQueueAction,
  clientQueueActionsFor,
  clientQueueColumnEntry,
  clientQueueColumnKey,
  clientQueueColumns,
  clientQueueRows,
  groupByClientStatus,
  isOnClientQueue,
} from './client-queue';

interface Row {
  readonly id: string;
  readonly internalStatus: string;
  readonly clientStatus: string;
}

const row = (id: string, internalStatus: string, clientStatus: string): Row => ({
  id,
  internalStatus,
  clientStatus,
});

/**
 * The seven seeded briefs as `(internalStatus, clientStatus)` pairs in `demoBriefs` order (which is
 * `updated_at desc`), copied from the `packages/db` handoff. Copied rather than imported: `@tas/domain`
 * has no dependency on `@tas/db` and must not grow one.
 */
const demoPairs: readonly (readonly [string, string])[] = [
  ['approved', 'pending_for_approval'],
  ['static_design_in_progress', 'pending_for_approval'],
  ['ad_submitted', 'pending_for_approval'],
  ['approved', 'pending_for_approval'],
  ['approved', 'approved'],
  ['sent_to_video_editor', 'pending_for_approval'],
  ['launched', 'launched'],
];

const demoRows = demoPairs.map(([internal, client], i) => row(String(i), internal, client));

describe('isOnClientQueue', () => {
  it('includes an internally Approved brief the client has not answered yet', () => {
    expect(isOnClientQueue(row('a', 'approved', 'pending_for_approval'))).toBe(true);
  });

  it('includes an internally Approved brief the client has already approved', () => {
    expect(isOnClientQueue(row('a', 'approved', 'approved'))).toBe(true);
  });

  it('excludes every pre-Approved internal state, on either track', () => {
    for (const internal of [
      'sent_to_designer',
      'static_design_in_progress',
      'sent_to_video_editor',
      'video_editing_in_progress',
      'ad_submitted',
      'images_revisions',
      'videos_revisions',
      'revisions_submitted',
      'on_hold',
    ]) {
      expect(isOnClientQueue(row('a', internal, 'pending_for_approval'))).toBe(false);
    }
  });

  it('excludes a row whose client track is finished, even when internal is Approved', () => {
    expect(isOnClientQueue(row('a', 'approved', 'launched'))).toBe(false);
    expect(isOnClientQueue(row('a', 'launched', 'launched'))).toBe(false);
    // Paused is a launched ad the media buyer stopped: still the media buyer's, still off the board.
    expect(isOnClientQueue(row('a', 'launched', 'paused'))).toBe(false);
    expect(isOnClientQueue(row('a', 'approved', 'paused'))).toBe(false);
  });

  it('keeps an internally Launched brief whose client status is still open', () => {
    expect(isOnClientQueue(row('a', 'launched', 'approved'))).toBe(true);
  });

  it('excludes an internal status this build does not know, rather than leaking it to the client', () => {
    expect(isOnClientQueue(row('a', 'shipped_to_mars', 'pending_for_approval'))).toBe(false);
  });

  it('is exactly isClientTrackOpen and nothing else on the internal side', () => {
    // A row with an unknown CLIENT status still passes the gate: only the internal side gates it.
    expect(isOnClientQueue(row('a', 'approved', 'awaiting_legal'))).toBe(true);
  });
});

describe('clientQueueRows', () => {
  it('keeps the three eligible seeded briefs and drops the launched one', () => {
    expect(clientQueueRows(demoRows).map((entry) => entry.id)).toEqual(['0', '3', '4']);
  });

  it('preserves the order it was handed', () => {
    const rows = [
      row('second', 'approved', 'approved'),
      row('first', 'approved', 'pending_for_approval'),
    ];
    expect(clientQueueRows(rows).map((entry) => entry.id)).toEqual(['second', 'first']);
  });

  it('does not mutate the rows it is handed', () => {
    const rows = [...demoRows];
    const snapshot = structuredClone(rows);
    clientQueueRows(rows);
    expect(rows).toEqual(snapshot);
  });

  it('returns an empty list when nothing has been signed off internally', () => {
    expect(clientQueueRows([row('a', 'ad_submitted', 'pending_for_approval')])).toEqual([]);
  });

  it('accepts any row carrying the two statuses, not just a brief', () => {
    const kept = clientQueueRows([
      { internalStatus: 'approved', clientStatus: 'approved', assignee: 'Dorian Vance' },
    ]);
    expect(kept[0]?.assignee).toBe('Dorian Vance');
  });
});

describe('clientQueueColumns', () => {
  it('is CLIENT_STATUS in PRD §9 order with the media buyer states (launched, paused) removed', () => {
    expect(clientQueueColumns().map((column) => column.key)).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
    ]);
  });

  it('returns the same frozen list every call', () => {
    expect(clientQueueColumns()).toBe(CLIENT_QUEUE_COLUMNS);
  });

  it('carries the label and description straight from CLIENT_STATUS, never a retyped string', () => {
    for (const column of CLIENT_QUEUE_COLUMNS) {
      expect(CLIENT_STATUS).toContainEqual(column);
    }
  });

  it('leaves CLIENT_STATUS itself untouched, launched and paused included', () => {
    expect(CLIENT_STATUS.map((entry) => entry.key)).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
      'launched',
      'paused',
    ]);
  });
});

describe('clientQueueColumnKey', () => {
  it('maps a known client status to itself', () => {
    expect(clientQueueColumnKey('pending_for_approval')).toBe('pending_for_approval');
    expect(clientQueueColumnKey('approved')).toBe('approved');
  });

  it('maps launched and any unknown status to the shared Other column', () => {
    expect(clientQueueColumnKey('launched')).toBe(QUEUE_OTHER_COLUMN.key);
    expect(clientQueueColumnKey('paused')).toBe(QUEUE_OTHER_COLUMN.key);
    expect(clientQueueColumnKey('awaiting_legal')).toBe(QUEUE_OTHER_COLUMN.key);
  });
});

describe('clientQueueColumnEntry', () => {
  it('returns the vocabulary entry for a column the board carries', () => {
    expect(clientQueueColumnEntry('approved')).toEqual(
      CLIENT_STATUS.find((entry) => entry.key === 'approved'),
    );
  });

  it('returns undefined for a status no column carries', () => {
    expect(clientQueueColumnEntry('launched')).toBeUndefined();
    expect(clientQueueColumnEntry('awaiting_legal')).toBeUndefined();
  });
});

describe('groupByClientStatus', () => {
  it('puts the seeded briefs in 2 Pending for Approval, 1 Approved and 0 Revisions Needed', () => {
    const columns = groupByClientStatus(demoRows);
    expect(columns.map((column) => [column.key, column.count])).toEqual([
      ['pending_for_approval', 2],
      ['approved', 1],
      ['revisions_needed', 0],
    ]);
    expect(columns[0]?.rows.map((entry) => entry.id)).toEqual(['0', '3']);
    expect(columns[1]?.rows.map((entry) => entry.id)).toEqual(['4']);
  });

  it('keeps a Revisions Needed row on the board: the client asked, the team has not resubmitted', () => {
    const columns = groupByClientStatus([row('sent-back', 'approved', 'revisions_needed')]);
    const revisions = columns.find((column) => column.key === 'revisions_needed');
    expect(revisions?.rows.map((entry) => entry.id)).toEqual(['sent-back']);
    expect(columns.map((column) => column.key)).not.toContain(QUEUE_OTHER_COLUMN.key);
  });

  it('keeps an empty column with a count of 0 rather than closing it up', () => {
    const columns = groupByClientStatus([row('a', 'approved', 'pending_for_approval')]);
    expect(columns).toHaveLength(CLIENT_QUEUE_COLUMNS.length);
    expect(columns[1]?.key).toBe('approved');
    expect(columns[1]?.count).toBe(0);
    expect(columns[1]?.rows).toEqual([]);
  });

  it('renders every column even when there is nothing on the board at all', () => {
    const columns = groupByClientStatus([]);
    expect(columns.map((column) => column.key)).toEqual([
      'pending_for_approval',
      'approved',
      'revisions_needed',
    ]);
    expect(columns.every((column) => column.count === 0)).toBe(true);
  });

  it('applies the eligibility gate itself, so a pre-Approved brief lands in no column', () => {
    const columns = groupByClientStatus([
      row('early', 'ad_submitted', 'pending_for_approval'),
      row('ready', 'approved', 'pending_for_approval'),
    ]);
    expect(columns.flatMap((column) => column.rows.map((entry) => entry.id))).toEqual(['ready']);
  });

  it('is a no-op when the caller already filtered with clientQueueRows', () => {
    expect(groupByClientStatus(clientQueueRows(demoRows))).toEqual(groupByClientStatus(demoRows));
  });

  it('drops a client-Launched row instead of parking it in Other', () => {
    const columns = groupByClientStatus([row('gone', 'approved', 'launched')]);
    expect(columns.map((column) => column.key)).not.toContain(QUEUE_OTHER_COLUMN.key);
    expect(columns.flatMap((column) => column.rows)).toEqual([]);
  });

  it('adds the shared Other column for an unknown client status so no card vanishes', () => {
    const columns = groupByClientStatus([
      row('known', 'approved', 'approved'),
      row('strange', 'approved', 'awaiting_legal'),
    ]);
    expect(columns).toHaveLength(CLIENT_QUEUE_COLUMNS.length + 1);
    const other = columns[columns.length - 1];
    expect(other?.key).toBe(QUEUE_OTHER_COLUMN.key);
    expect(other?.label).toBe('Other');
    expect(other?.count).toBe(1);
    expect(other?.rows.map((entry) => entry.id)).toEqual(['strange']);
  });

  it('adds no Other column when every client status is one the board knows', () => {
    expect(groupByClientStatus(demoRows).map((column) => column.key)).not.toContain(
      QUEUE_OTHER_COLUMN.key,
    );
  });

  it('puts every eligible row in exactly one column', () => {
    const placed = groupByClientStatus(demoRows).flatMap((column) =>
      column.rows.map((entry) => entry.id),
    );
    expect(placed).toHaveLength(new Set(placed).size);
    expect(placed).toHaveLength(clientQueueRows(demoRows).length);
  });

  it('keeps the order it was handed inside a column', () => {
    const columns = groupByClientStatus([
      row('newest', 'approved', 'pending_for_approval'),
      row('oldest', 'approved', 'pending_for_approval'),
    ]);
    expect(columns[0]?.rows.map((entry) => entry.id)).toEqual(['newest', 'oldest']);
  });

  it('does not mutate the rows it is handed', () => {
    const rows = [...demoRows];
    const snapshot = structuredClone(rows);
    groupByClientStatus(rows);
    expect(rows).toEqual(snapshot);
  });
});

describe('CLIENT_QUEUE_ACTIONS', () => {
  it('is exactly the two controls PRD §10 gives the client', () => {
    expect(CLIENT_QUEUE_ACTIONS.map((action) => [action.key, action.label])).toEqual([
      ['approve', 'Approve'],
      ['request_revisions', 'Request Revisions'],
    ]);
  });

  it('targets only statuses CLIENT_STATUS actually carries', () => {
    const keys = CLIENT_STATUS.map((entry) => entry.key);
    for (const action of CLIENT_QUEUE_ACTIONS) {
      expect(keys).toContain(action.to);
      expect(action.description.length).toBeGreaterThan(0);
    }
  });

  it('moves an approval to Approved, which CLIENT_TRANSITIONS allows from Pending', () => {
    const approve = clientQueueAction('approve');
    expect(approve?.to).toBe('approved');
    expect(canTransitionClient('approved', 'pending_for_approval', approve?.to ?? 'launched')).toBe(
      true,
    );
  });

  it('moves a revision request to Revisions Needed, which PRD §9 branches to from Pending', () => {
    const revisions = clientQueueAction('request_revisions');
    expect(CLIENT_STATUS.map((entry) => entry.key)).toContain('revisions_needed');
    expect(revisions?.to).toBe('revisions_needed');
    expect(CLIENT_TRANSITIONS.pending_for_approval).toContain('revisions_needed');
    expect(
      canTransitionClient('approved', 'pending_for_approval', revisions?.to ?? 'launched'),
    ).toBe(true);
  });

  it('gives every action a target the state machine can actually reach from somewhere', () => {
    for (const action of CLIENT_QUEUE_ACTIONS) {
      const reachable = Object.values(CLIENT_TRANSITIONS).some((targets) =>
        targets.includes(action.to),
      );
      expect(reachable).toBe(true);
    }
  });

  it('refuses every action while the internal track is still closed', () => {
    for (const action of CLIENT_QUEUE_ACTIONS) {
      expect(canTransitionClient('ad_submitted', 'pending_for_approval', action.to)).toBe(false);
    }
  });

  it('returns undefined for a key the table does not carry', () => {
    expect(clientQueueAction('delete_everything')).toBeUndefined();
  });
});

describe('clientQueueActionsFor — only the controls that can succeed', () => {
  const keys = (internal: string, client: string): readonly string[] =>
    clientQueueActionsFor(internal, client).map((action) => action.key);

  it('offers both PRD §9 branches from Pending for Approval once internal has signed off', () => {
    expect(keys('approved', 'pending_for_approval')).toEqual(['approve', 'request_revisions']);
    expect(keys('launched', 'pending_for_approval')).toEqual(['approve', 'request_revisions']);
  });

  it('offers nothing on a creative the client already approved, rather than a dead Approve', () => {
    expect(keys('approved', 'approved')).toEqual([]);
  });

  it('offers nothing while the creative sits in Revisions Needed: the next move is the team’s', () => {
    expect(keys('approved', 'revisions_needed')).toEqual([]);
  });

  it('offers nothing while the internal gate is shut, whatever the client status says', () => {
    expect(keys('ad_submitted', 'pending_for_approval')).toEqual([]);
    expect(keys('static_design_in_progress', 'pending_for_approval')).toEqual([]);
  });

  it('answers with an empty list, never a throw, for statuses this build has no row for', () => {
    expect(keys('approved', 'awaiting_legal')).toEqual([]);
    expect(keys('from_a_newer_build', 'pending_for_approval')).toEqual([]);
  });

  it('never offers a move canTransitionClient would refuse', () => {
    const internals = ['approved', 'launched', 'ad_submitted'];
    const clients = ['pending_for_approval', 'approved', 'revisions_needed', 'launched'];
    for (const internal of internals) {
      for (const client of clients) {
        for (const action of clientQueueActionsFor(internal, client)) {
          expect(
            canTransitionClient(
              internal as Parameters<typeof canTransitionClient>[0],
              client as Parameters<typeof canTransitionClient>[1],
              action.to,
            ),
          ).toBe(true);
        }
      }
    }
  });
});
