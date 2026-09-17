'use client';

import { useActionState, useState } from 'react';
import { DEMO_WRITE_HINT, DisabledWrite } from '@tas/ui';

import { toggleQaAction, type BriefActionResult, type BriefQaCheck } from '../actions';
import { BRIEF_QA_CHECKS, BRIEF_QA_LABELS } from '../fields';

interface QaChecklistProps {
  readonly briefId: string;
  /** The three stored ticks, in the same shape the columns hold them. */
  readonly checks: Readonly<Record<BriefQaCheck, boolean>>;
  readonly demo: boolean;
}

/**
 * The QA checklist (PRD §5.10, ticket criterion 10): exactly three checkboxes, one per reviewer.
 *
 * Each tick is its own write, so it is submitted on its own through `toggleQaAction` — the NEW
 * state is sent explicitly rather than "flip it", which is what makes a double click idempotent and
 * a stale tab unable to undo somebody else's tick. The action is dispatched directly (no nested
 * `<form>`: this checklist sits inside the rail beside the page's one save form) and the box shows
 * the new state immediately, because a checkbox that waits for a round trip feels broken.
 *
 * In demo mode every box is disabled and the whole group carries the reason on hover through
 * `DisabledWrite` — a disabled input receives no pointer events, so the tooltip has to live on an
 * enabled element around it. The action refuses in demo mode as well, before any validation or
 * connection; this is the visible half of the same guarantee.
 */
export function QaChecklist({ briefId, checks, demo }: QaChecklistProps) {
  const [state, dispatch, pending] = useActionState<BriefActionResult | null, FormData>(
    toggleQaAction,
    null,
  );
  const [ticks, setTicks] = useState(checks);

  const toggle = (check: BriefQaCheck, next: boolean) => {
    setTicks((current) => ({ ...current, [check]: next }));
    const formData = new FormData();
    formData.set('id', briefId);
    formData.set('check', check);
    formData.set('checked', String(next));
    dispatch(formData);
  };

  return (
    <section
      data-slot="brief-qa"
      className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
    >
      <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">QA checklist</h3>
      <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
        <ul className="flex w-full flex-col gap-1.5">
          {BRIEF_QA_CHECKS.map((check) => {
            const id = `brief-qa-${check}`;
            return (
              <li key={check} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={id}
                  checked={ticks[check]}
                  disabled={demo || pending}
                  onChange={(event) => {
                    toggle(check, event.target.checked);
                  }}
                  data-slot="brief-qa-check"
                  data-check={check}
                  className="size-4 shrink-0 rounded-input border border-line2 bg-surface2 accent-[var(--accent)] disabled:cursor-not-allowed"
                />
                <label htmlFor={id} className="text-sm text-text2">
                  {BRIEF_QA_LABELS[check]}
                </label>
              </li>
            );
          })}
        </ul>
      </DisabledWrite>
      {state !== null && !state.ok ? (
        <p data-slot="brief-qa-error" className="text-xs text-bad">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
