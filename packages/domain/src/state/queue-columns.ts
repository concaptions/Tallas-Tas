/**
 * The Internal Queue board's columns (PRD §9, ticket `internal-queue` criteria 2 and 3).
 *
 * Since the Oct 12 consolidation (`./creative-status`, migration 0067) the internal track is ONE
 * list for both creative tracks, so the board's strip IS that list, in flow order — no merge of two
 * ladders and no `On Hold` siding any more. A component never lists a status, compares one to a
 * literal or orders them (CLAUDE.md non-negotiable 2, criterion 2): it reads this module.
 *
 * Pure and total: no I/O, no clock, no row type from `@tas/db`. `groupByInternalStatus` is generic
 * over anything that carries an `internalStatus` string, which is what keeps the dependency edge
 * app → domain and app → db, never domain → db.
 */

import { INTERNAL_STATUS, type InternalStatusKey, type StatusEntry } from './creative-status';

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
export type QueueColumnKey = InternalStatusKey | QueueOtherColumnKey;

/** Every column of the board, in flow order: the internal vocabulary itself. */
export const INTERNAL_QUEUE_COLUMNS: readonly StatusEntry<InternalStatusKey>[] = INTERNAL_STATUS;

/** The board's columns. A function so a caller reads it the way it reads every other list here. */
export function internalQueueColumns(): readonly StatusEntry<InternalStatusKey>[] {
  return INTERNAL_QUEUE_COLUMNS;
}

/** The column key a stored status belongs to: itself when the board has it, `other` when it does not. */
export function internalQueueColumnKey(status: string): QueueColumnKey {
  return INTERNAL_QUEUE_COLUMNS.some((column) => column.key === status)
    ? (status as InternalStatusKey)
    : QUEUE_OTHER_COLUMN.key;
}

/** The entry for a stored status, or `undefined` for one no column carries. */
export function internalQueueColumnEntry(
  status: string,
): StatusEntry<InternalStatusKey> | undefined {
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
