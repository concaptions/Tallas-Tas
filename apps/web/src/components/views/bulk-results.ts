/**
 * The result shapes every bulk Server Action answers `useGridSelection` with (Ticket 8). They are
 * STRUCTURALLY IDENTICAL to the Creative Sheet's `review-actions.ts` shapes (`DeleteResult`,
 * `BulkMoveResult`, the duplicate result) so a later refactor can move the sheet onto the hook
 * without touching its wire format. Types only — no `'use server'`, importable from client and
 * server modules alike.
 */

/** A refused bulk write: demo mode, an expired session, a bad id list, a failed save. */
export interface BulkFailure {
  readonly ok: false;
  readonly error: string;
}

export interface BulkDeleteSuccess {
  readonly ok: true;
  /** The rows the soft delete actually marked; ids the brand did not own resolve to nothing. */
  readonly deleted: readonly string[];
}

export type BulkDeleteResult = BulkDeleteSuccess | BulkFailure;

export interface BulkStatusSuccess {
  readonly ok: true;
  readonly moved: readonly string[];
  /** The rows the state machine refused, each with the reason, so the bar can say which and why. */
  readonly refused: readonly {
    readonly id: string;
    readonly name: string;
    readonly reason: string;
  }[];
}

export type BulkStatusResult = BulkStatusSuccess | BulkFailure;

export interface BulkDuplicateSuccess {
  readonly ok: true;
  readonly created: readonly { readonly id: string; readonly name: string }[];
  readonly skipped: number;
}

export type BulkDuplicateResult = BulkDuplicateSuccess | BulkFailure;
