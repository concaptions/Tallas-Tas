'use client';

import { useActionState } from 'react';
import { Button, StatusChip } from '@tas/ui';

import type { ClientQueueActionResult } from './actions';
import { approveCreativeAction, requestRevisionsAction } from './actions';

interface ClientBrief {
  readonly id: string;
  readonly name: string;
  readonly platform: string | null;
  readonly clientStatus: string;
  readonly clientStatusLabel: string;
  readonly clientStatusTone: 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'mute';
  readonly canApprove: boolean;
  readonly canRequestRevisions: boolean;
}

export function ClientCard({
  brief,
  demo,
}: {
  readonly brief: ClientBrief;
  readonly demo: boolean;
}) {
  const [approveState, approve, approving] = useActionState<
    ClientQueueActionResult | null,
    FormData
  >(approveCreativeAction, null);
  const [reviseState, revise, revising] = useActionState<ClientQueueActionResult | null, FormData>(
    requestRevisionsAction,
    null,
  );

  const failure = [approveState, reviseState].find(
    (s): s is ClientQueueActionResult & { ok: false } => s !== null && !s.ok,
  );
  const saved = [approveState, reviseState].some((s) => s !== null && s.ok);

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate font-mono text-sm text-text">{brief.name}</h3>
        <StatusChip tone={brief.clientStatusTone} label={brief.clientStatusLabel} />
      </div>
      {brief.platform ? <p className="text-xs text-text3">{brief.platform}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {brief.canApprove ? (
          <form action={approve}>
            <input type="hidden" name="id" value={brief.id} />
            <Button type="submit" size="sm" disabled={demo || approving}>
              Approve
            </Button>
          </form>
        ) : null}
        {brief.canRequestRevisions ? (
          <form action={revise}>
            <input type="hidden" name="id" value={brief.id} />
            <Button type="submit" size="sm" variant="outline" disabled={demo || revising}>
              Request Revisions
            </Button>
          </form>
        ) : null}
        {!brief.canApprove && !brief.canRequestRevisions ? (
          <p className="text-xs text-text3">No actions available.</p>
        ) : null}
      </div>

      {failure !== undefined ? <p className="text-xs text-bad">{failure.error}</p> : null}
      {saved ? <p className="text-xs text-ok">Saved.</p> : null}
    </article>
  );
}
