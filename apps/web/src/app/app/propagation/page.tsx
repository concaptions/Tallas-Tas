import {
  DEMO_PROPAGATION_ACCESS_NOTE,
  PROPAGATION_ADMIN_NOTE,
  PROPAGATION_NOT_ADMIN_NOTE,
  canSeePropagationPage,
} from '@tas/domain';

import { isDemoMode } from '@/lib/demo-mode';
import { loadPromotionRequestsByStatus } from '@/lib/propagation-source';
import { currentTeamActor } from '@/lib/team-actor';
import { loadTeam } from '@/lib/team-source';

import {
  PROPAGATION_ENFORCEMENT_NOTE,
  resolveStatusFilter,
  statusQuery,
  toPromotionItem,
  type PromotionItem,
} from './fields';
import { PropagationWorkspace } from './propagation-workspace';

/**
 * Propagation (PRD §5: "Sometimes, we test an idea a child base … request comes in to the ADMIN
 * dashboard to approve everything"; §14.1: "One template, propagated").
 *
 * A server component. The rows come from `loadPromotionRequestsByStatus`, which is the in-repo
 * fixtures in demo mode and the agency-scoped query otherwise; the page does not know which and does
 * not branch on it. It renders into the shell's `<main>` and therefore owns no frame, padding or
 * background of its own (ticket criterion 1).
 *
 * ACCESS IS DECIDED HERE, on the server, before a single request reaches the client (criterion 3).
 * The rule is `canSeePropagationPage` from `@tas/domain` — an agency Admin, and strictly nobody
 * else, because approving a promotion writes into the TEMPLATE and every brand inherits the result.
 * The actor is resolved from the session by `currentTeamActor` in live mode and stubbed as an admin
 * in demo mode, where there is no identity provider to ask; the note says the check is stubbed
 * rather than skipped, because it does still run. No component in this route writes
 * `role === 'admin'`, and the two Server Actions ask the same domain predicate again before they
 * write — a disabled button is not a control, and neither is a hidden sidebar link.
 *
 * THE ROSTER READ IS WHAT THE GUARD COSTS. `currentTeamActor` takes rows rather than querying for
 * one person, so the page reads the team once and finds the actor in it, exactly as `/app/team`
 * does. In demo mode neither read touches a database.
 *
 * THE ADDRESS CHOOSES THE STATE. `?status=` is resolved to one of the domain's three keys or `all`
 * and handed to the source; the page itself never filters, never sorts and never writes a status
 * word. An unknown or repeated value falls back to the pending queue rather than throwing.
 *
 * Both timestamps in every row are formatted here, once, with a single `now`: a client that
 * formatted them itself would disagree with the server and break hydration.
 */
export const metadata = {
  title: 'Propagation — TAS Creative Platform',
};

interface PropagationPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Live mode, guard says no. No queue, no counts, no brand names and no diff — just the rule, in
 * words, naming the role that can act so the reader knows who to go to rather than only that they
 * cannot.
 */
function NotAdmin() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Propagation</h1>
      </header>
      <section
        data-slot="not-admin"
        className="flex max-w-prose flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{PROPAGATION_NOT_ADMIN_NOTE}</p>
        <p className="text-sm text-text3">{PROPAGATION_ADMIN_NOTE}</p>
        <p className="text-xs text-text4">{PROPAGATION_ENFORCEMENT_NOTE}</p>
      </section>
    </div>
  );
}

export default async function PropagationPage({ searchParams }: PropagationPageProps) {
  const params = await searchParams;
  const filter = resolveStatusFilter(params.status);

  const [{ rows: team }, { rows }] = await Promise.all([
    loadTeam(),
    loadPromotionRequestsByStatus(statusQuery(filter)),
  ]);

  if (!canSeePropagationPage(await currentTeamActor(team))) {
    return <NotAdmin />;
  }

  const demo = isDemoMode();
  const now = new Date();
  const items: PromotionItem[] = rows.map((row) => toPromotionItem(row, now));

  return (
    <PropagationWorkspace
      items={items}
      demo={demo}
      filter={filter}
      adminNote={PROPAGATION_ADMIN_NOTE}
      demoAccessNote={demo ? DEMO_PROPAGATION_ACCESS_NOTE : null}
    />
  );
}
