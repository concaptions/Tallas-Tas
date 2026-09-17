'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  StatusChip,
} from '@tas/ui';

import { QueueCardFace } from '@/components/queue/queue-card-face';

import {
  approveCreativeAction,
  requestRevisionsAction,
  type ClientQueueActionFailure,
  type ClientQueueActionResult,
} from './actions';
import { clientQueueControl, SAVED_NOTE, type ClientQueueItem } from './fields';

/**
 * One creative on the Client Queue board (ticket `client-queue` criteria 7, 8 and 9).
 *
 * THE CARD IS NOT AN ANCHOR, and that is the one shape it does not share with the Internal Queue's
 * card. PRD §10 gives the client two write controls on a creative, and an `<a>` may not contain a
 * `<button>`: nesting them produces a card where a click lands on whichever element the browser felt
 * like, and a keyboard user tabs into a link that swallows Enter from the buttons inside it. So the
 * card is a container, the NAVIGATION is a link over the face of it — name, tile, assignee, priority,
 * the whole readable body — and the two writes sit below that link as real buttons. Clicking the
 * card's body or pressing Enter on it still lands on `briefPath(id)`, which is what criterion 7 asks
 * for, and the buttons are reachable by keyboard in their own right.
 *
 * WHAT IT SHOWS is `QueueCardFace` from `@/components/queue`, the identical face the Internal Queue
 * card draws, plus the CLIENT-status chip — a `StatusChip` with the domain's own label and tone,
 * never a locally coloured pill. No internal status is rendered anywhere on this card: that track is
 * team-only (CLAUDE.md non-negotiable 10, criterion 4).
 *
 * IN DEMO MODE BOTH CONTROLS ARE INERT and say why. Each is wrapped in `DisabledWrite`, which puts
 * the reason on an enabled element around the button — a disabled button receives no pointer events,
 * so its own `title` would never open — and carries `disabledWriteClassName`, which strips the accent
 * fill that would otherwise make a dead control look clickable. The Server Actions refuse in demo
 * mode too, before any validation or connection; this is the visible half of the same guarantee, not
 * the enforcement of it.
 *
 * THE BUTTONS SUBMIT ONE FIELD: the brief's id. The target status is never submitted — it comes from
 * `CLIENT_QUEUE_ACTIONS` inside the action — so a tampered form cannot name a status of its own.
 */
interface ClientQueueCardProps {
  readonly item: ClientQueueItem;
  /** True when no identity provider is configured, so every write is refused and shown as refused. */
  readonly demo: boolean;
}

interface WriteControlProps {
  readonly briefId: string;
  readonly demo: boolean;
  readonly control: ReturnType<typeof clientQueueControl>;
  readonly state: ClientQueueActionResult | null;
  readonly pending: boolean;
  readonly dispatch: (formData: FormData) => void;
}

/**
 * One write control. A `<form>` rather than an `onClick`, so the action is dispatched with real
 * `FormData` and the control still works before hydration in live mode.
 */
function WriteControl({ briefId, demo, control, state, pending, dispatch }: WriteControlProps) {
  return (
    <form action={dispatch} className="flex min-w-0">
      <input type="hidden" name="id" value={briefId} />
      <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
        <Button
          type="submit"
          size="sm"
          variant={control.key === 'approve' ? 'default' : 'outline'}
          disabled={demo || pending}
          title={demo ? DEMO_WRITE_HINT : control.description}
          data-slot={control.slot}
          data-action={control.key}
          className={demo ? disabledWriteClassName : undefined}
        >
          {control.label}
        </Button>
      </DisabledWrite>
      {state !== null && !state.ok ? (
        <span data-slot={`${control.slot}-error`} className="sr-only">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function ClientQueueCard({ item, demo }: ClientQueueCardProps) {
  const [approveState, approve, approving] = useActionState<
    ClientQueueActionResult | null,
    FormData
  >(approveCreativeAction, null);
  const [reviseState, revise, revising] = useActionState<ClientQueueActionResult | null, FormData>(
    requestRevisionsAction,
    null,
  );

  const failure = [approveState, reviseState].find(
    (state): state is ClientQueueActionFailure => state !== null && !state.ok,
  );
  const saved = [approveState, reviseState].some((state) => state !== null && state.ok);

  return (
    <article
      data-slot="client-queue-card"
      data-brief-id={item.id}
      data-client-status={item.clientStatus}
      className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface p-3"
    >
      <Link
        href={item.href}
        data-slot="client-queue-card-link"
        aria-label={item.name}
        className="flex min-w-0 flex-col gap-2 rounded-input hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-accent-soft focus-visible:outline-none"
      >
        <QueueCardFace face={item} slot="client-queue-card" />
      </Link>

      <span data-slot="client-queue-card-status" className="flex min-w-0">
        <StatusChip tone={item.status.tone} label={item.status.label} />
      </span>

      <div
        role="group"
        aria-label={`Client decision for ${item.name}`}
        className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-line pt-2"
      >
        <WriteControl
          briefId={item.id}
          demo={demo}
          control={clientQueueControl('approve')}
          state={approveState}
          pending={approving}
          dispatch={approve}
        />
        <WriteControl
          briefId={item.id}
          demo={demo}
          control={clientQueueControl('request_revisions')}
          state={reviseState}
          pending={revising}
          dispatch={revise}
        />
      </div>

      {failure === undefined ? null : (
        <p data-slot="client-queue-card-error" className="text-xs text-bad">
          {failure.error}
        </p>
      )}
      {saved ? (
        <p data-slot="client-queue-card-saved" className="text-xs text-ok">
          {SAVED_NOTE}
        </p>
      ) : null}
    </article>
  );
}
