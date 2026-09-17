import { DEMO_TEAM_ACCESS_NOTE, canSeeTeamPage } from '@tas/domain';

import { isDemoMode } from '@/lib/demo-mode';
import { currentTeamActor } from '@/lib/team-actor';
import { loadTeam } from '@/lib/team-source';

import {
  TEAM_ACCESS_ENFORCEMENT_NOTE,
  TEAM_ACCESS_NOTE,
  TEAM_NOT_AUTHORISED_TITLE,
  toTeamItem,
  type TeamItem,
} from './fields';
import { TeamWorkspace } from './team-workspace';

/**
 * Team (PRD §11, §3): who works here, with their role and the brands they are on.
 *
 * A server component. The rows come from `loadTeam()`, which is the in-repo fixtures in demo mode
 * and the agency-scoped query otherwise; the page does not know which and does not branch on it. It
 * renders into the shell's `<main>` and therefore owns no frame, padding or background of its own.
 *
 * ACCESS IS DECIDED HERE, on the server, before a single row reaches the client (criterion 7). The
 * rule is `canSeeTeamPage` from `@tas/domain` — an agency Admin or a Client Success Manager — and
 * the actor is resolved from the session in live mode and stubbed as an admin in demo mode, where
 * there is no identity provider to ask. Hiding the sidebar link would not be a control: this is,
 * and the note above the table says as much.
 *
 * Both strings in the Last active column are formatted here, once, with a single `now`: a client
 * that formatted them itself would disagree with the server and break hydration.
 */
interface TeamPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Live mode, guard says no. No roster, no counts, no names — just the rule, in words. */
function NotAuthorised() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Team</h1>
      </header>
      <section
        data-slot="team-not-authorised"
        className="flex flex-col gap-2 rounded-card border border-line bg-surface2 p-6"
      >
        <p className="text-sm font-medium text-text">{TEAM_NOT_AUTHORISED_TITLE}</p>
        <p className="text-sm text-text3">
          {TEAM_ACCESS_NOTE} {TEAM_ACCESS_ENFORCEMENT_NOTE}
        </p>
      </section>
    </div>
  );
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const [{ rows }, params] = await Promise.all([loadTeam(), searchParams]);
  const demo = isDemoMode();

  if (!canSeeTeamPage(await currentTeamActor(rows))) {
    return <NotAuthorised />;
  }

  const now = new Date();
  const items: TeamItem[] = rows.map((row) => toTeamItem(row, now));

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <TeamWorkspace
      items={items}
      demo={demo}
      initialSearch={initialSearch}
      demoAccessNote={demo ? DEMO_TEAM_ACCESS_NOTE : null}
    />
  );
}
