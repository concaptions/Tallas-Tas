/**
 * The Client Queue board (PRD §9, §10 — ticket `client-queue` criteria 2, 3, 4, 8).
 *
 * The Internal Queue in `../state/queue-columns` is the team's view of a brief: every stored internal
 * status, whatever the track. This module is the CLIENT's view of the same rows, and PRD §9 makes it a
 * strictly smaller board in two ways:
 *
 *   1. ELIGIBILITY. "A creative appears in the client's interface **only** when Internal Status =
 *      Approved" — so a row is on this board only once `isClientTrackOpen` says the internal track has
 *      signed off, and it leaves again once the client track is finished (`launched` is the media
 *      buyer's column, not an approval the client still owes). That rule is `isOnClientQueue` here and
 *      NOWHERE else: it calls `isClientTrackOpen` from `../state/creative-status` instead of comparing
 *      `internalStatus` to a literal, so the gate keeps exactly one definition (CLAUDE.md
 *      non-negotiable 2 and 4).
 *   2. COLUMNS. `CLIENT_STATUS` itself is untouched — it is the vocabulary of the status column, and
 *      `launched` is a real value a row can hold. The BOARD drops that one column, because a board
 *      whose last column can never be reached from the rows it shows is a lie about the process.
 *
 * Pure and total: no I/O, no clock, no row type from `@tas/db`. Every function is generic over the
 * minimum shape a row has to carry, which is what keeps the dependency edge app → domain and app → db,
 * never domain → db.
 */

import {
  CLIENT_STATUS,
  isClientTrackOpen,
  type ClientStatusKey,
  type InternalStatusKey,
  type StatusEntry,
} from '../state/creative-status';
import {
  QUEUE_OTHER_COLUMN,
  type QueueOtherColumnKey,
  type QueueRow,
} from '../state/queue-columns';

/**
 * The one client status the board does not carry a column for, written once and used by both the
 * eligibility gate and the column list so the two cannot disagree about which status is off the board.
 */
const OFF_QUEUE_CLIENT_STATUS: ClientStatusKey = 'launched';

/**
 * The minimum a row has to carry to be placed on the client board: the internal status the gate reads
 * and the client status it is grouped by. `BriefListRow` from `@tas/db` satisfies it structurally, so
 * nothing is mapped or re-narrowed on the way in.
 */
export interface ClientQueueRow extends QueueRow {
  readonly clientStatus: string;
}

/**
 * PRD §9's rule and nothing else: internally signed off, and not already finished on the client track.
 *
 * `isClientTrackOpen` is typed on the internal vocabulary while a stored row carries a plain string;
 * the cast is safe because the gate only compares for equality, and an unknown status falls through
 * both comparisons to `false` — an unrecognised internal status keeps a row OFF the client board,
 * which is the safe direction for a page clients see (CLAUDE.md non-negotiable 10).
 */
export function isOnClientQueue(row: ClientQueueRow): boolean {
  return (
    isClientTrackOpen(row.internalStatus as InternalStatusKey) &&
    row.clientStatus !== OFF_QUEUE_CLIENT_STATUS
  );
}

/**
 * The rows the client board shows, in the order they arrived (which is `listBriefs`' `updated_at
 * desc`; nothing here sorts). A new array every call — the input is never mutated.
 */
export function clientQueueRows<Row extends ClientQueueRow>(rows: readonly Row[]): readonly Row[] {
  return rows.filter((row) => isOnClientQueue(row));
}

/**
 * `CLIENT_STATUS` in PRD §9 order with `launched` removed — derived from the vocabulary rather than
 * retyped, so a status added to `CLIENT_STATUS` shows up as a column with no second edit.
 */
export const CLIENT_QUEUE_COLUMNS: readonly StatusEntry<ClientStatusKey>[] = CLIENT_STATUS.filter(
  (entry) => entry.key !== OFF_QUEUE_CLIENT_STATUS,
);

/** The board's columns. A function so a caller reads it the way it reads `internalQueueColumns`. */
export function clientQueueColumns(): readonly StatusEntry<ClientStatusKey>[] {
  return CLIENT_QUEUE_COLUMNS;
}

export type ClientQueueColumnKey = ClientStatusKey | QueueOtherColumnKey;

/** The column key a stored client status belongs to: itself when the board has it, `other` when not. */
export function clientQueueColumnKey(status: string): ClientQueueColumnKey {
  return CLIENT_QUEUE_COLUMNS.some((column) => column.key === status)
    ? (status as ClientStatusKey)
    : QUEUE_OTHER_COLUMN.key;
}

/** The entry for a stored client status, or `undefined` for one no column carries. */
export function clientQueueColumnEntry(status: string): StatusEntry<ClientStatusKey> | undefined {
  return CLIENT_QUEUE_COLUMNS.find((column) => column.key === status);
}

export interface ClientQueueColumn<
  Row extends ClientQueueRow,
> extends StatusEntry<ClientQueueColumnKey> {
  readonly rows: readonly Row[];
  /** `rows.length`, carried so a header renders a count without the component reaching into `rows`. */
  readonly count: number;
}

/**
 * Every column of the client board with its briefs, in `CLIENT_QUEUE_COLUMNS` order.
 *
 * Mirrors `groupByInternalStatus` deliberately, down to the two rules that make the internal board
 * readable: EMPTY COLUMNS ARE KEPT, because the board's shape is the process and a stage with nothing
 * in it is information; and an unrecognised status lands in the SAME `QUEUE_OTHER_COLUMN` the internal
 * board appends, only when something is actually in it, so a row written by a newer build is visible
 * rather than silently dropped between columns.
 *
 * It applies `clientQueueRows` itself rather than trusting the caller: the eligibility gate is the one
 * thing on this page that must not be forgettable, and running it twice is a no-op.
 */
export function groupByClientStatus<Row extends ClientQueueRow>(
  rows: readonly Row[],
): readonly ClientQueueColumn<Row>[] {
  const buckets = new Map<ClientQueueColumnKey, Row[]>();
  for (const column of CLIENT_QUEUE_COLUMNS) {
    buckets.set(column.key, []);
  }
  for (const row of clientQueueRows(rows)) {
    const key = clientQueueColumnKey(row.clientStatus);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }

  const columns: ClientQueueColumn<Row>[] = CLIENT_QUEUE_COLUMNS.map((entry) => {
    const bucket = buckets.get(entry.key) ?? [];
    return { ...entry, rows: bucket, count: bucket.length };
  });

  const orphans = buckets.get(QUEUE_OTHER_COLUMN.key) ?? [];
  if (orphans.length === 0) {
    return columns;
  }
  return [...columns, { ...QUEUE_OTHER_COLUMN, rows: orphans, count: orphans.length }];
}

export type ClientQueueActionKey = 'approve' | 'request_revisions';

export interface ClientQueueAction {
  readonly key: ClientQueueActionKey;
  /** The button's label. The only place this string is written. */
  readonly label: string;
  /** The client status the action moves the row to. A button never names a status of its own. */
  readonly to: ClientStatusKey;
  readonly description: string;
}

/**
 * The two write controls PRD §10 gives the client ("Client Status, comments / annotations" — this is
 * the status half), each carrying the status it moves the row to so a button cannot invent a
 * transition. The Server Action still asks `canTransitionClient` whether the move is legal for the row
 * it was handed; this table only says what the button is FOR.
 *
 * KNOWN GAP, flagged rather than papered over: PRD §9 reads "Pending for Approval → Approved /
 * Revisions Needed → Launched", but `CLIENT_STATUS` carries no `revisions_needed` key and
 * `CLIENT_TRANSITIONS` therefore has no edge for it — and ticket `client-queue` criterion 2 freezes
 * both. So `request_revisions` is modelled as what it can honestly be today, a return to
 * `pending_for_approval`, and `canTransitionClient` refuses it from every state until the missing
 * status is added in its own ticket. In demo mode both controls are refused anyway, so the board is
 * correct as shipped; the vocabulary gap is the thing to fix, not this table.
 */
export const CLIENT_QUEUE_ACTIONS: readonly ClientQueueAction[] = [
  {
    key: 'approve',
    label: 'Approve',
    to: 'approved',
    description: 'Client signs off on the creative. Moves it to the media buyer queue.',
  },
  {
    key: 'request_revisions',
    label: 'Request Revisions',
    to: 'pending_for_approval',
    description:
      'Client sends the creative back for changes. Returns it to Pending for Approval until CLIENT_STATUS gains a Revisions Needed key.',
  },
];

/** The action for a key, or `undefined`: a control cannot be built from a key the table does not have. */
export function clientQueueAction(key: string): ClientQueueAction | undefined {
  return CLIENT_QUEUE_ACTIONS.find((action) => action.key === key);
}
