import { CLIENT_STATUS, canTransitionClient, chipTone } from '@tas/domain/state';

import { loadClientQueue } from '@/lib/client-queue-source';
import { isDemoMode } from '@/lib/demo-mode';

import { ClientCard } from './client-card';

export default async function ClientPortalPage() {
  const demo = isDemoMode();
  const { rows, withheld } = await loadClientQueue();

  const briefs = rows.map((row) => {
    const entry = CLIENT_STATUS.find((s) => s.key === row.clientStatus);
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      clientStatus: row.clientStatus,
      clientStatusLabel: entry?.label ?? row.clientStatus,
      clientStatusTone: chipTone(entry?.label ?? row.clientStatus),
      canApprove: canTransitionClient(row.internalStatus, row.clientStatus, 'approved'),
      canRequestRevisions: canTransitionClient(
        row.internalStatus,
        row.clientStatus,
        'revisions_needed',
      ),
    };
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Your Creatives</h1>
        <p className="text-sm text-text2">
          {demo
            ? 'Sample creatives. Connect an account to see your real work.'
            : `${String(briefs.length)} creative${briefs.length === 1 ? '' : 's'} awaiting your review.`}
        </p>
        {withheld > 0 ? (
          <p className="text-xs text-text3">
            {String(withheld)} more in production — they will appear here once the team signs off.
          </p>
        ) : null}
      </div>

      {briefs.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">
          Nothing to review right now. Check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {briefs.map((brief) => (
            <ClientCard key={brief.id} brief={brief} demo={demo} />
          ))}
        </div>
      )}
    </>
  );
}
