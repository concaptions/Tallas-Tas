'use client';

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@tas/ui';

import {
  approvePromotionAction,
  rejectPromotionAction,
  type PromotionActionResult,
} from './actions';
import { CustomFieldsSection, type CustomFieldItem } from './custom-fields-section';
import { PropagationControls, type ChildBrandItem } from './propagation-controls';
import {
  EMPTY_BODY,
  PROMOTION_FILTERS,
  PROPAGATION_ENFORCEMENT_NOTE,
  REJECT_PROMPT,
  emptyAction,
  emptyTitle,
  filterNote,
  promotionCountLabel,
  type PromotionItem,
  type PromotionStatusFilter,
} from './fields';
import { PromotionTable, type PromotionDecision } from './promotion-row';

/**
 * The Propagation screen (PRD §5: "request comes in to the ADMIN dashboard to approve everything";
 * §14.1: "One template, propagated. A change to the template updates every brand").
 *
 * WHAT THE PAGE IS FOR, said before anything else: a change made in one brand can ask to become part
 * of the template every brand inherits, and nothing is promoted automatically. That is CLAUDE.md
 * non-negotiable 2 in the product's own words, and it is the reason the page exists at all rather
 * than a paragraph of decoration — the note is `PROPAGATION_ADMIN_NOTE` from `@tas/domain`, so the
 * sentence the guard enforces and the sentence the reader gets are the same one.
 *
 * THE FILTER IS THE ADDRESS. `?status=` is a real navigation rather than a History-API rewrite,
 * because unlike every other filter in this app it changes which ROWS exist: the server reads one
 * state and hands down exactly those. So each option is a `Link`, the default state has a clean
 * `/app/propagation` with no query at all, and "here is what we rejected" is a link you can paste
 * into Slack. It is also the only way to reach the empty state, which says so in words.
 *
 * THE ONLY WRITES ARE THE TWO BUTTONS ON A PENDING ROW. One `useActionState` per decision rather
 * than one per row: the result carries `requestId`, so a success reconciles exactly one row and
 * `settledAt` changes on every decision, which is what makes two settlements in a row re-render.
 * There is no optimistic edit here — unlike a switch, a decision REMOVES the row from the queue, and
 * guessing at that before the server agrees would make a failed write look like a successful one.
 * The table re-reads itself: both actions `revalidatePath` on success.
 *
 * IN DEMO MODE EVERY CONTROL IN EVERY ROW IS DISABLED (ticket criterion 10), through `DisabledWrite`
 * + `disabledWriteClassName` from `@tas/ui` with the tooltip "Sign in required to save changes", and
 * both actions refuse again on the server before any validation, actor lookup or connection. The
 * disabled button is the courtesy; the action is the guarantee.
 */
export interface PropagationWorkspaceProps {
  readonly items: readonly PromotionItem[];
  readonly customFields: readonly CustomFieldItem[];
  readonly childBrands: readonly ChildBrandItem[];
  readonly demo: boolean;
  /** The state the address asked for, already resolved by `resolveStatusFilter`. */
  readonly filter: PromotionStatusFilter;
  /** The extra sentence demo mode appends to the admin note, or null in live mode. */
  readonly demoAccessNote: string | null;
  /** The sentence from `@tas/domain` stating what this page is for. */
  readonly adminNote: string;
}

/** What the decision in flight is addressed to, so only that row goes inert while it runs. */
interface PendingDecision {
  readonly requestId: string;
  readonly decision: PromotionDecision;
}

export function PropagationWorkspace({
  items,
  customFields,
  childBrands,
  demo,
  filter,
  demoAccessNote,
  adminNote,
}: PropagationWorkspaceProps) {
  const [notes, setNotes] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<PromotionActionResult | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const inFlight = useRef<PendingDecision | null>(null);

  const [approved, approve, approving] = useActionState<PromotionActionResult | null, FormData>(
    approvePromotionAction,
    null,
  );
  const [rejected, reject, rejecting] = useActionState<PromotionActionResult | null, FormData>(
    rejectPromotionAction,
    null,
  );

  /**
   * One handler, two actions. A success clears that row's typed reason and says what happened in the
   * label the DOMAIN produced (`statusLabel`), never one composed here; a failure keeps the reason,
   * so the admin does not retype it, and the message goes under the note box it belongs to.
   *
   * Idempotent, because an effect may run twice for one state: re-applying the same outcome is the
   * same outcome. `inFlight` is deliberately NOT cleared here — it is what addresses the message to
   * a row, and `approving`/`rejecting` already say whether anything is still running.
   */
  const settleResult = useCallback((result: PromotionActionResult | null) => {
    if (result === null) {
      return;
    }
    if (result.ok) {
      setError(null);
      setSettled(`${result.statusLabel} — that request has left the queue.`);
      setNotes((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== result.requestId)),
      );
      return;
    }
    setSettled(null);
    setError(result);
  }, []);

  useEffect(() => {
    settleResult(approved);
  }, [approved, settleResult]);

  useEffect(() => {
    settleResult(rejected);
  }, [rejected, settleResult]);

  const onNote = useCallback((requestId: string, note: string) => {
    setNotes((current) => ({ ...current, [requestId]: note }));
  }, []);

  const onDecide = useCallback(
    (requestId: string, decision: PromotionDecision) => {
      inFlight.current = { requestId, decision };
      setSettled(null);

      const formData = new FormData();
      formData.set('request', requestId);
      formData.set('note', notes[requestId] ?? '');
      startTransition(() => {
        if (decision === 'approve') {
          approve(formData);
        } else {
          reject(formData);
        }
      });
    },
    [approve, notes, reject],
  );

  const attempt = inFlight.current;
  const savingId = (approving || rejecting) && attempt !== null ? attempt.requestId : null;
  const failure = error !== null && !error.ok ? error : null;
  const way = emptyAction(filter);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex min-w-0 flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Propagation</h1>
        <p className="text-sm text-text2">
          <span data-slot="promotion-count">{promotionCountLabel(items.length)}</span> —{' '}
          {filterNote(filter)}
        </p>
        <p
          data-slot="admin-note"
          className="max-w-prose rounded-card border border-line bg-surface2 p-3 text-sm text-text3"
        >
          {adminNote}
          {demoAccessNote === null ? null : <> {demoAccessNote}</>}
        </p>
        <p data-slot="enforcement-note" className="max-w-prose text-xs text-text4">
          {PROPAGATION_ENFORCEMENT_NOTE}
        </p>
        {failure === null ? null : (
          <p data-slot="decision-error" className="text-sm text-bad">
            {failure.error}
          </p>
        )}
        {settled === null ? null : (
          <p data-slot="decision-saved" className="text-sm text-ok">
            {settled}
          </p>
        )}
      </header>

      <section aria-labelledby="propagation-heading" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 id="propagation-heading" className="text-sm font-medium text-text2">
            Requests
          </h2>
          <div
            data-slot="status-filter"
            role="group"
            aria-label="Filter promotion requests by status"
            className="flex min-w-0 flex-wrap items-center gap-1.5"
          >
            {PROMOTION_FILTERS.map((option) => {
              const active = option.key === filter;
              return (
                <Button
                  key={option.key}
                  asChild
                  size="sm"
                  variant={active ? 'secondary' : 'outline'}
                  className="h-8 max-w-full truncate"
                >
                  <Link
                    href={option.href}
                    data-slot="status-filter-option"
                    data-status={option.key}
                    data-active={active}
                    aria-current={active ? 'page' : undefined}
                  >
                    {option.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>

        {demo || items.length === 0 ? null : (
          <p data-slot="reject-prompt" className="text-xs text-text4">
            {REJECT_PROMPT}
          </p>
        )}

        <PromotionTable
          items={items}
          demo={demo}
          savingId={savingId}
          notes={notes}
          onNote={onNote}
          onDecide={onDecide}
          noteErrorId={attempt?.requestId ?? null}
          noteError={failure?.fieldErrors?.note ?? null}
          emptyState={
            <div
              data-slot="propagation-empty"
              className="flex flex-col items-center gap-3 text-center"
            >
              <p className="text-sm font-medium text-text2">{emptyTitle(filter)}</p>
              <p className="max-w-prose text-[13px] leading-relaxed text-text3">{EMPTY_BODY}</p>
              <Button asChild variant="outline" size="sm" data-slot="empty-action">
                <Link href={way.href}>{way.label}</Link>
              </Button>
            </div>
          }
        />
      </section>

      <PropagationControls childBrands={childBrands} demo={demo} />

      <CustomFieldsSection fields={customFields} demo={demo} />
    </div>
  );
}
