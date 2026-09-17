'use client';

import type { ReactNode } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  cn,
  disabledWriteClassName,
} from '@tas/ui';

import { NOTE_LABEL, NOTE_PLACEHOLDER, PROMOTION_COLUMNS, type PromotionItem } from './fields';

/**
 * The Propagation table (PRD §5, §14.1): one `<table>`, one row per request, the ticket's six
 * columns and the decision cell each row ends with.
 *
 * Presentational and stateless. Every string arrives resolved from `fields.ts` and every decision is
 * handed up through `onDecide`, which is what lets the design-system page mount this table with
 * plain objects and see exactly what the route renders, and what keeps the two Server Actions
 * dispatched from one place (`propagation-workspace.tsx`) instead of from two buttons per row.
 *
 * NOTHING ELSE IN THE ROW IS INTERACTIVE (ticket criterion 6). No checkbox, no row click, no menu,
 * no editing of the proposed value, no per-brand picker and no way to raise a request here. A
 * pending row has exactly three controls — Approve, Reject, and the box the rejection's reason is
 * typed into — and a settled row has none at all.
 *
 * THE DIFF IS TEXT, never an input (criterion 5). The value the template holds today is struck
 * through in `text-text4`, the value being asked for is in `text-text2`, both `font-mono` because
 * they are stored values rather than prose, and each is truncated to one line so a long paragraph
 * cannot set the row's height. The full value is in the cell's `title`.
 *
 * `emptyState` is rendered inside the table body rather than in place of the table, so the headings
 * stay put and the empty case is never a blank rectangle.
 */

/** Which of the two decisions a row is asking for. The words themselves are the buttons' labels. */
export type PromotionDecision = 'approve' | 'reject';

export interface DiffPreviewProps {
  readonly item: PromotionItem;
}

/**
 * The Change cell. Two values and the arrow between them — the whole point of the page in one cell:
 * this is what the template says, and this is what the brand is asking it to say instead.
 *
 * The two values are STACKED at every width, the arrow leading the proposed one. Side by side they
 * would need twice the column, which is what pushed the decision cell off the end of a 1024px
 * workspace; stacked, each value gets the whole cell before it has to truncate, and a 390px phone
 * reads the change down the cell rather than pushing the table sideways.
 */
export function DiffPreview({ item }: DiffPreviewProps) {
  return (
    <span data-slot="diff-preview" className="flex min-w-0 max-w-[16rem] flex-col gap-0.5">
      <span
        data-slot="diff-current"
        title={item.currentValue}
        className="block min-w-0 truncate font-mono text-xs text-text4 line-through"
      >
        {item.currentValue}
      </span>
      <span className="flex min-w-0 items-baseline gap-1">
        <span aria-hidden className="shrink-0 font-mono text-xs text-text4">
          &rarr;
        </span>
        <span
          data-slot="diff-proposed"
          title={item.proposedValue}
          className="block min-w-0 truncate font-mono text-xs text-text2"
        >
          {item.proposedValue}
        </span>
      </span>
    </span>
  );
}

export interface PromotionActionsProps {
  readonly item: PromotionItem;
  /** Demo mode: both buttons are disabled through `DisabledWrite` and explain why on hover. */
  readonly demo: boolean;
  /** True while this row's own decision is in flight. */
  readonly busy: boolean;
  /** The reason typed for this row so far; a rejection needs one. */
  readonly note: string;
  readonly onNote: (requestId: string, note: string) => void;
  readonly onDecide: (requestId: string, decision: PromotionDecision) => void;
  /** The server's message for this row's last attempt, keyed to the note box. */
  readonly noteError: string | null;
}

/**
 * The two controls a pending row ends with, and the box the rejection's reason goes in.
 *
 * REJECT ASKS FOR A REASON, because rejecting is the end of the road for the requester — the change
 * stays in their brand and never reaches the template — and `rejectPromotionAction` refuses an empty
 * one on the server. The box is here rather than in a dialog so the reason is visible next to the
 * change it is about. Approve's note is optional and shares the same box: an admin who explains why
 * they promoted something is doing the next reader a favour, not filling in a required field.
 */
export function PromotionActions({
  item,
  demo,
  busy,
  note,
  onNote,
  onDecide,
  noteError,
}: PromotionActionsProps) {
  const noteId = `promotion-note-${item.id}`;
  const errorId = `${noteId}-error`;

  return (
    <span data-slot="promotion-actions" className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-1.5">
        <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
          <Button
            type="button"
            size="sm"
            disabled={demo || busy}
            className={demo ? disabledWriteClassName : undefined}
            data-slot="approve-request"
            data-request={item.id}
            onClick={() => {
              onDecide(item.id, 'approve');
            }}
          >
            Approve
          </Button>
        </DisabledWrite>
        <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={demo || busy}
            className={demo ? disabledWriteClassName : undefined}
            data-slot="reject-request"
            data-request={item.id}
            onClick={() => {
              onDecide(item.id, 'reject');
            }}
          >
            Reject
          </Button>
        </DisabledWrite>
      </span>
      <label htmlFor={noteId} className="sr-only">
        {NOTE_LABEL} for {item.fieldName}
      </label>
      <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
        <Textarea
          id={noteId}
          rows={2}
          value={note}
          disabled={demo || busy}
          placeholder={NOTE_PLACEHOLDER}
          aria-describedby={noteError === null ? undefined : errorId}
          data-slot="promotion-note"
          data-request={item.id}
          className={cn('min-h-0 w-40 text-xs', demo ? disabledWriteClassName : undefined)}
          onChange={(event) => {
            onNote(item.id, event.target.value);
          }}
        />
      </DisabledWrite>
      {noteError === null ? null : (
        <span id={errorId} data-slot="promotion-note-error" className="text-xs text-bad">
          {noteError}
        </span>
      )}
    </span>
  );
}

export interface PromotionRowProps extends Omit<PromotionActionsProps, 'busy' | 'note'> {
  /** The id whose decision is in flight, or null. */
  readonly savingId: string | null;
  /** Every row's typed reason, keyed by request id. */
  readonly notes: Readonly<Record<string, string>>;
}

export function PromotionRow({
  item,
  demo,
  savingId,
  notes,
  onNote,
  onDecide,
  noteError,
}: PromotionRowProps) {
  return (
    <TableRow data-slot="promotion-row" data-request={item.id} data-status={item.statusLabel}>
      <TableCell className="px-2 py-2 align-top whitespace-normal sm:px-3">
        {/*
          A chip rather than plain text, because the Brand cell is the one fact in the row that is
          not about the change itself: it is who is asking. `mute` is the tone for a brand that is
          simply there; `warn` is the tone for one that has been soft-deleted since, which is a thing
          an admin settling the request should notice rather than read as an ordinary name.
        */}
        <span data-slot="promotion-brand" className="inline-flex">
          <StatusChip tone={item.brand.muted ? 'warn' : 'mute'} label={item.brand.text} />
        </span>
      </TableCell>
      <TableCell
        data-slot="promotion-table-name"
        className="px-2 py-2 align-top font-mono text-xs text-text2 sm:px-3"
      >
        {item.tableName}
      </TableCell>
      <TableCell
        data-slot="promotion-field-name"
        className="px-2 py-2 align-top font-mono text-xs text-text2 sm:px-3"
      >
        {item.fieldName}
      </TableCell>
      <TableCell className="px-2 py-2 align-top whitespace-normal text-text2 sm:px-3">
        {item.requestedBy}
      </TableCell>
      <TableCell
        data-slot="promotion-requested-at"
        title={item.requestedAtTitle}
        className="px-2 py-2 align-top whitespace-nowrap text-text3 sm:px-3"
      >
        {item.requestedAt}
      </TableCell>
      <TableCell className="px-2 py-2 align-top whitespace-normal sm:px-3">
        <DiffPreview item={item} />
      </TableCell>
      <TableCell className="px-2 py-2 align-top whitespace-normal sm:px-3">
        <span className="flex flex-col gap-2">
          <StatusChip tone={item.statusTone} label={item.statusLabel} />
          {item.pending ? (
            <PromotionActions
              item={item}
              demo={demo}
              busy={savingId === item.id}
              note={notes[item.id] ?? ''}
              onNote={onNote}
              onDecide={onDecide}
              noteError={noteError}
            />
          ) : (
            <span data-slot="promotion-decided" className="flex flex-col gap-1">
              <span className="text-xs text-text3">{item.decidedBy}</span>
              {item.reviewNote === null ? null : (
                <span
                  data-slot="promotion-review-note"
                  className="max-w-[11rem] text-xs leading-relaxed text-text4"
                >
                  {item.reviewNote}
                </span>
              )}
            </span>
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}

export interface PromotionTableProps {
  readonly items: readonly PromotionItem[];
  readonly demo: boolean;
  readonly savingId?: string | null;
  readonly notes?: Readonly<Record<string, string>>;
  readonly onNote: PromotionActionsProps['onNote'];
  readonly onDecide: PromotionActionsProps['onDecide'];
  /** The request whose note box the last failure belongs to, and what it said. */
  readonly noteErrorId?: string | null;
  readonly noteError?: string | null;
  /** Shown across every column when `items` is empty. */
  readonly emptyState?: ReactNode;
}

const NO_NOTES: Readonly<Record<string, string>> = {};

export function PromotionTable({
  items,
  demo,
  savingId = null,
  notes = NO_NOTES,
  onNote,
  onDecide,
  noteErrorId = null,
  noteError = null,
  emptyState,
}: PromotionTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <Table data-slot="promotion-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {PROMOTION_COLUMNS.map((column) => (
              <TableHead key={column} className="px-2 whitespace-normal sm:px-3">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={PROMOTION_COLUMNS.length}
                className="px-2 py-10 whitespace-normal sm:px-3"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <PromotionRow
                key={item.id}
                item={item}
                demo={demo}
                savingId={savingId}
                notes={notes}
                onNote={onNote}
                onDecide={onDecide}
                noteError={noteErrorId === item.id ? noteError : null}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
