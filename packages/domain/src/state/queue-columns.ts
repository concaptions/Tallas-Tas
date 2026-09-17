/**
 * The Internal Queue board's columns (PRD §9, ticket `internal-queue` criteria 2 and 3).
 *
 * The internal ladder in `./creative-status` is two lists, one per track, because a single brief is
 * graded on exactly one of them. The queue is the other view of the same machine: ONE board carrying
 * every brief in the brand, whatever its type, so the strip needs the two ladders merged into a
 * single left-to-right order with the four steps the tracks share (`ad_submitted`,
 * `revisions_submitted`, `approved`, `launched`) appearing once rather than twice.
 *
 * That merge is done HERE, once, and derived from `INTERNAL_STATIC_STATUS` and
 * `INTERNAL_VIDEO_STATUS` rather than retyped — a status added to a ladder shows up on the board
 * with no second edit, and a component never lists a status, compares one to a literal or orders
 * them (CLAUDE.md non-negotiable 2, criterion 2).
 *
 * Pure and total: no I/O, no clock, no row type from `@tas/db`. `groupByInternalStatus` is generic
 * over anything that carries an `internalStatus` string, which is what keeps the dependency edge
 * app → domain and app → db, never domain → db.
 */

import {
  INTERNAL_STATIC_STATUS,
  INTERNAL_VIDEO_STATUS,
  ON_HOLD,
  type InternalStatusKey,
  type InternalStatusOrHoldKey,
  type StatusEntry,
} from './creative-status';

/** The keys both ladders carry, in video-list order. Computed, so it cannot drift from the lists. */
const SHARED_KEYS: readonly InternalStatusKey[] = INTERNAL_VIDEO_STATUS.filter((entry) =>
  INTERNAL_STATIC_STATUS.some((other) => other.key === entry.key),
).map((entry) => entry.key);

function isShared(key: string): boolean {
  return SHARED_KEYS.includes(key as InternalStatusKey);
}

/**
 * The two ladders merged into one sequence, each list's own relative order preserved and every
 * shared step emitted once.
 *
 * Walking the STATIC list and flushing the video-only steps that sit in front of each shared step
 * reproduces PRD §9 exactly — "Sent to Designer → Static Design in Progress / Sent to Video Editor →
 * Video Editing in Progress → … → Ad Submitted → Images Revisions / Videos Revisions → …" — because
 * §9 writes the static half of each pair first.
 */
function mergeTracks(): readonly StatusEntry<InternalStatusKey>[] {
  const video: readonly StatusEntry<InternalStatusKey>[] = INTERNAL_VIDEO_STATUS;
  const merged: StatusEntry<InternalStatusKey>[] = [];
  let cursor = 0;

  const push = (entry: StatusEntry<InternalStatusKey>): void => {
    if (!merged.some((seen) => seen.key === entry.key)) {
      merged.push(entry);
    }
  };

  /** Emit the video steps in front of `key`, then consume video's own copy of `key`. */
  const flushVideoBefore = (key: string | null): void => {
    while (cursor < video.length) {
      const entry = video[cursor];
      if (entry === undefined) {
        return;
      }
      cursor += 1;
      if (entry.key === key) {
        return;
      }
      push(entry);
    }
  };

  for (const entry of INTERNAL_STATIC_STATUS) {
    if (isShared(entry.key)) {
      flushVideoBefore(entry.key);
    }
    push(entry);
  }
  // Anything the video ladder carries past the last shared step. Empty today, correct tomorrow.
  flushVideoBefore(null);

  return merged;
}

/**
 * The column a brief lands in when its stored status is not one this build knows.
 *
 * It exists so a row written by a newer build, or a hand-edited row, is VISIBLE rather than silently
 * dropped between columns — a queue that hides work hides exactly the work that is stuck. It is
 * appended only when something is actually in it, so an ordinary board never shows a spare column.
 */
export const QUEUE_OTHER_COLUMN = {
  key: 'other',
  label: 'Other',
  description:
    'Briefs whose stored internal status is not a step this build knows. Shown so nothing on the board can go missing; empty on a healthy queue.',
} as const satisfies StatusEntry;

export type QueueOtherColumnKey = typeof QUEUE_OTHER_COLUMN.key;
export type QueueColumnKey = InternalStatusOrHoldKey | QueueOtherColumnKey;

/**
 * Every column of the board, in PRD §9 order, with `On Hold` last.
 *
 * `On Hold` is a branch rather than a step — `./creative-status` keeps it out of both linear
 * steppers for that reason — so it cannot sit "between in-progress and Ad Submitted" in a strip that
 * reads left to right as progress. Criterion 2 puts it at the end, where it reads as the siding it
 * is instead of a stage every brief passes through.
 */
export const INTERNAL_QUEUE_COLUMNS: readonly StatusEntry<InternalStatusOrHoldKey>[] = [
  ...mergeTracks(),
  ON_HOLD,
];

/** The board's columns. A function so a caller reads it the way it reads `internalStatusFor`. */
export function internalQueueColumns(): readonly StatusEntry<InternalStatusOrHoldKey>[] {
  return INTERNAL_QUEUE_COLUMNS;
}

/** The column key a stored status belongs to: itself when the board has it, `other` when it does not. */
export function internalQueueColumnKey(status: string): QueueColumnKey {
  return INTERNAL_QUEUE_COLUMNS.some((column) => column.key === status)
    ? (status as InternalStatusOrHoldKey)
    : QUEUE_OTHER_COLUMN.key;
}

/** The entry for a stored status, or `undefined` for one no column carries. */
export function internalQueueColumnEntry(
  status: string,
): StatusEntry<InternalStatusOrHoldKey> | undefined {
  return INTERNAL_QUEUE_COLUMNS.find((column) => column.key === status);
}

/**
 * The minimum a row has to carry to be placed on the board. `BriefRow` from
 * `apps/web/src/lib/briefs-source.ts` satisfies it structurally, so nothing is mapped or re-narrowed
 * on the way in.
 */
export interface QueueRow {
  readonly internalStatus: string;
}

export interface QueueColumn<Row extends QueueRow> extends StatusEntry<QueueColumnKey> {
  readonly rows: readonly Row[];
  /** `rows.length`, carried so a header renders a count without the component reaching into `rows`. */
  readonly count: number;
}

/**
 * Every column of the board with its briefs, in `INTERNAL_QUEUE_COLUMNS` order.
 *
 * EMPTY COLUMNS ARE KEPT (criterion 3): the board's shape is the process, not the data, so a stage
 * with nothing in it renders with a count of 0 rather than closing up — a queue that hides its empty
 * stages hides the work that is not moving. Row order inside a column is the order the rows arrived
 * in, which is `listBriefs`' `updated_at desc`; nothing here sorts.
 */
export function groupByInternalStatus<Row extends QueueRow>(
  rows: readonly Row[],
): readonly QueueColumn<Row>[] {
  const buckets = new Map<QueueColumnKey, Row[]>();
  for (const column of INTERNAL_QUEUE_COLUMNS) {
    buckets.set(column.key, []);
  }
  for (const row of rows) {
    const key = internalQueueColumnKey(row.internalStatus);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }

  const columns: QueueColumn<Row>[] = INTERNAL_QUEUE_COLUMNS.map((entry) => {
    const bucket = buckets.get(entry.key) ?? [];
    return { ...entry, rows: bucket, count: bucket.length };
  });

  const orphans = buckets.get(QUEUE_OTHER_COLUMN.key) ?? [];
  if (orphans.length === 0) {
    return columns;
  }
  return [...columns, { ...QUEUE_OTHER_COLUMN, rows: orphans, count: orphans.length }];
}
