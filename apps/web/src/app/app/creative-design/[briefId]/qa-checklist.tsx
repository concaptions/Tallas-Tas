'use client';

import { useActionState, useState } from 'react';
import { DEMO_WRITE_HINT, DisabledWrite, SectionLabel } from '@tas/ui';
import {
  canSubmitToClient,
  qaChecklistFor,
  qaProgressLabel,
  type CreativeTrack,
} from '@tas/domain/state';

import { QaCheckRow } from '@/components/status/qa-check-row';
import { notApplicableTag } from '@/app/app/creative-sheet/focus-mode';

import { toggleQaAction, type BriefActionResult, type BriefQaCheck } from '../actions';

interface QaChecklistProps {
  readonly briefId: string;
  /** The three stored ticks, in the same shape the columns hold them. */
  readonly checks: Readonly<Record<BriefQaCheck, boolean>>;
  /** Which ticks this brief needs: the video track asks the editor, the static track the designer. */
  readonly track: CreativeTrack;
  readonly demo: boolean;
}

/** The progress line's tone (B4.V1's recipe): ok once the gate is open, warn while a tick is missing. */
const GATE_CLASS = {
  open: 'text-[11px] text-ok',
  shut: 'text-[11px] text-warn',
} as const;

/**
 * The QA checklist (PRD §5.10, ticket criterion 10): exactly three checkboxes, one per reviewer.
 *
 * Each tick is its own write, so it is submitted on its own through `toggleQaAction` — the NEW
 * state is sent explicitly rather than "flip it", which is what makes a double click idempotent and
 * a stale tab unable to undo somebody else's tick. The action is dispatched directly (no nested
 * `<form>`: this checklist sits inside the rail beside the page's one save form) and the box shows
 * the new state immediately, because a checkbox that waits for a round trip feels broken.
 *
 * The page is a full-record view, so all three ticks are listed (B4.V3): the one the other track
 * owns is drawn struck through with its N/A tag, a required tick that is still unset carries
 * `Required`, and the line under the list says how far the gate is from opening — the same
 * `qaChecklistFor` / `qaProgressLabel` the rail's Advance and Focus Mode read, so the checklist
 * names the tick the disabled button is waiting for.
 *
 * In demo mode every box is disabled and the whole group carries the reason on hover through
 * `DisabledWrite` — a disabled input receives no pointer events, so the tooltip has to live on an
 * enabled element around it. The action refuses in demo mode as well, before any validation or
 * connection; this is the visible half of the same guarantee.
 */
export function QaChecklist({ briefId, checks, track, demo }: QaChecklistProps) {
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

  // From the LOCAL ticks, so the tags and the progress line move with the box, not the round trip.
  const open = canSubmitToClient(track, ticks);

  return (
    <section
      data-slot="brief-qa"
      className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
    >
      <SectionLabel>QA checklist</SectionLabel>
      <DisabledWrite active={demo} hint={DEMO_WRITE_HINT} className="w-full">
        <ul className="flex w-full flex-col gap-1.5">
          {qaChecklistFor(track, ticks).map((check) => (
            <QaCheckRow
              key={check.key}
              id={`brief-qa-${check.key}`}
              checkKey={check.key}
              inputSlot="brief-qa-check"
              label={check.label}
              required={check.required}
              checked={check.checked}
              disabled={demo || pending}
              notApplicableTag={notApplicableTag(track)}
              onCheckedChange={(next) => {
                toggle(check.key, next);
              }}
            />
          ))}
        </ul>
      </DisabledWrite>
      <p
        data-slot="brief-qa-gate"
        data-open={open ? 'true' : 'false'}
        className={open ? GATE_CLASS.open : GATE_CLASS.shut}
      >
        {qaProgressLabel(track, ticks)}
      </p>
      {state !== null && !state.ok ? (
        <p data-slot="brief-qa-error" className="text-xs text-bad">
          {state.error}
        </p>
      ) : null}
    </section>
  );
}
